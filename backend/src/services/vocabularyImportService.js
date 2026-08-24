import { Vocabulary } from '../models/Vocabulary.js'
import { VocabularyChapter } from '../models/VocabularyChapter.js'

const IMPORTABLE_FIELDS = [
  'lemma',
  'normalizedLemma',
  'meaningEs',
  'partOfSpeech',
  'homographKey',
  'firstAppearanceChapter',
  'nominative',
  'genitive',
  'gender',
  'declension',
  'principalParts',
  'conjugation',
  'adjectiveForms',
  'morphologyData',
  'importStatus',
  'sourceReference',
]

function entryKey(entry) {
  return `${entry.normalizedLemma}\u0000${entry.partOfSpeech}\u0000${entry.homographKey || ''}`
}

function comparable(value) {
  return JSON.stringify(value ?? null)
}

export function validateVocabularyPayload(entries) {
  const errors = []
  const keys = new Set()

  if (!Array.isArray(entries) || entries.length === 0) {
    return ['La extracción no contiene entradas de vocabulario.']
  }

  entries.forEach((entry, index) => {
    const label = `Entrada ${index + 1}`
    if (!entry.lemma || !entry.normalizedLemma) errors.push(`${label}: falta el lema.`)
    if (!entry.partOfSpeech) errors.push(`${label}: falta la categoría gramatical.`)
    if (!Array.isArray(entry.chapters) || entry.chapters.length === 0) {
      errors.push(`${label}: no tiene relación con ningún capítulo.`)
    }
    const chapterNumbers = (entry.chapters || []).map((item) => Number(item.chapter))
    if (chapterNumbers.some((chapter) => chapter < 1 || chapter > 35)) {
      errors.push(`${label}: contiene un capítulo fuera del rango 1–35.`)
    }
    if (chapterNumbers.length && Math.min(...chapterNumbers) !== entry.firstAppearanceChapter) {
      errors.push(`${label}: el primer capítulo no coincide con sus relaciones.`)
    }
    if (new Set(chapterNumbers).size !== chapterNumbers.length) {
      errors.push(`${label}: repite una relación vocabulario-capítulo.`)
    }

    const key = entryKey(entry)
    if (keys.has(key)) errors.push(`${label}: clave canónica duplicada en la extracción.`)
    keys.add(key)
  })

  return errors
}

function buildIncomingValues(entry, existing = null) {
  const values = Object.fromEntries(IMPORTABLE_FIELDS.map((field) => [field, entry[field] ?? null]))
  values.homographKey = entry.homographKey || ''
  values.firstAppearanceChapter = existing
    ? Math.min(existing.firstAppearanceChapter, entry.firstAppearanceChapter)
    : entry.firstAppearanceChapter

  if (existing) {
    const manuallyEnrichableFields = [
      'meaningEs',
      'nominative',
      'genitive',
      'gender',
      'declension',
      'principalParts',
      'conjugation',
      'adjectiveForms',
    ]
    for (const field of manuallyEnrichableFields) {
      if (entry[field] == null && existing[field] != null) values[field] = existing[field]
    }
    if (existing.importStatus === 'VERIFIED') values.importStatus = 'VERIFIED'
  }
  return values
}

function hasModelChanges(model, values) {
  return IMPORTABLE_FIELDS.some((field) => comparable(model[field]) !== comparable(values[field]))
}

async function buildDryRun(entries) {
  const existingWords = await Vocabulary.findAll({
    include: [{ model: VocabularyChapter, as: 'chapters', required: false }],
  })
  const byKey = new Map(existingWords.map((word) => [entryKey(word), word]))
  let wordsToCreate = 0
  let wordsToUpdate = 0
  let wordsUnchanged = 0
  let chapterLinksToCreate = 0
  let chapterLinksToUpdate = 0
  const chapters = Object.fromEntries(
    Array.from({ length: 35 }, (_value, index) => [
      index + 1,
      {
        detectedOccurrences: 0,
        uniqueLemmas: 0,
        newVocabulary: 0,
        existingVocabulary: 0,
        chapterAssociationsToAdd: 0,
      },
    ]),
  )

  for (const entry of entries) {
    const existing = byKey.get(entryKey(entry))
    const existingLinks = new Map(existing?.chapters.map((link) => [link.chapter, link]) || [])
    for (const chapter of entry.chapters) {
      const stats = chapters[chapter.chapter]
      stats.uniqueLemmas += 1
      stats.detectedOccurrences += (entry.occurrences || []).filter(
        (occurrence) => occurrence.chapter === chapter.chapter,
      ).length
      if (existing) stats.existingVocabulary += 1
      else stats.newVocabulary += 1
      if (!existingLinks.has(chapter.chapter)) stats.chapterAssociationsToAdd += 1
    }
    if (!existing) {
      wordsToCreate += 1
      chapterLinksToCreate += entry.chapters.length
      continue
    }
    if (hasModelChanges(existing, buildIncomingValues(entry, existing))) wordsToUpdate += 1
    else wordsUnchanged += 1

    const chapterLinks = existingLinks
    for (const chapter of entry.chapters) {
      const link = chapterLinks.get(chapter.chapter)
      if (!link) chapterLinksToCreate += 1
      else if (
        chapter.firstOccurrenceLine &&
        (!link.firstOccurrenceLine || chapter.firstOccurrenceLine < link.firstOccurrenceLine)
      ) {
        chapterLinksToUpdate += 1
      }
    }
  }

  return {
    dryRun: true,
    wordsToCreate,
    wordsToUpdate,
    wordsUnchanged,
    chapterLinksToCreate,
    chapterLinksToUpdate,
    chapters,
  }
}

async function importInitialVocabularySeed(entries) {
  return Vocabulary.sequelize.transaction(async (transaction) => {
    const existingCount = await Vocabulary.count({ transaction })
    if (existingCount > 0) {
      throw new Error(
        'La importación inicial por lotes requiere una tabla de vocabulario vacía.',
      )
    }

    const words = await Vocabulary.bulkCreate(
      entries.map((entry) => buildIncomingValues(entry)),
      { transaction, returning: true },
    )
    const wordsByKey = new Map(words.map((word) => [entryKey(word), word]))
    const chapterLinks = entries.flatMap((entry) => {
      const word = wordsByKey.get(entryKey(entry))
      if (!word) {
        throw new Error(`No se pudo vincular el lema ${entry.lemma}.`)
      }
      return entry.chapters.map((chapter) => ({
        vocabularyId: word.id,
        chapter: chapter.chapter,
        firstOccurrenceLine: chapter.firstOccurrenceLine || null,
      }))
    })

    await VocabularyChapter.bulkCreate(chapterLinks, { transaction })

    return {
      dryRun: false,
      wordsCreated: words.length,
      wordsUpdated: 0,
      wordsUnchanged: 0,
      chapterLinksCreated: chapterLinks.length,
      chapterLinksUpdated: 0,
    }
  })
}

export async function importVocabularyEntries(
  entries,
  { dryRun = false, initialSeed = false } = {},
) {
  const validationErrors = validateVocabularyPayload(entries)
  if (validationErrors.length) {
    throw new Error(`Extracción inválida:\n${validationErrors.slice(0, 20).join('\n')}`)
  }
  if (dryRun) return buildDryRun(entries)
  if (initialSeed) return importInitialVocabularySeed(entries)

  return Vocabulary.sequelize.transaction(async (transaction) => {
    const summary = {
      dryRun: false,
      wordsCreated: 0,
      wordsUpdated: 0,
      wordsUnchanged: 0,
      chapterLinksCreated: 0,
      chapterLinksUpdated: 0,
    }

    for (const entry of entries) {
      const where = {
        normalizedLemma: entry.normalizedLemma,
        partOfSpeech: entry.partOfSpeech,
        homographKey: entry.homographKey || '',
      }
      let word = await Vocabulary.findOne({ where, transaction })
      if (!word) {
        word = await Vocabulary.create(buildIncomingValues(entry), { transaction })
        summary.wordsCreated += 1
      } else {
        const values = buildIncomingValues(entry, word)
        if (hasModelChanges(word, values)) {
          await word.update(values, { transaction })
          summary.wordsUpdated += 1
        } else {
          summary.wordsUnchanged += 1
        }
      }

      for (const chapter of entry.chapters) {
        const [link, created] = await VocabularyChapter.findOrCreate({
          where: { vocabularyId: word.id, chapter: chapter.chapter },
          defaults: { firstOccurrenceLine: chapter.firstOccurrenceLine || null },
          transaction,
        })
        if (created) {
          summary.chapterLinksCreated += 1
        } else if (
          chapter.firstOccurrenceLine &&
          (!link.firstOccurrenceLine || chapter.firstOccurrenceLine < link.firstOccurrenceLine)
        ) {
          await link.update({ firstOccurrenceLine: chapter.firstOccurrenceLine }, { transaction })
          summary.chapterLinksUpdated += 1
        }
      }
    }

    return summary
  })
}

export async function validateImportedVocabulary() {
  const [words, links] = await Promise.all([
    Vocabulary.findAll({ include: [{ model: VocabularyChapter, as: 'chapters' }] }),
    VocabularyChapter.count(),
  ])
  const issues = []
  const chapterSet = new Set()
  for (const word of words) {
    if (!word.chapters.length) issues.push(`El vocabulario ${word.id} no tiene capítulos.`)
    const firstChapter = Math.min(...word.chapters.map((link) => link.chapter))
    if (firstChapter !== word.firstAppearanceChapter) {
      issues.push(`El vocabulario ${word.id} tiene un primer capítulo incoherente.`)
    }
    word.chapters.forEach((link) => chapterSet.add(link.chapter))
  }

  const duplicates = await Vocabulary.findAll({
    attributes: [
      'normalizedLemma',
      'partOfSpeech',
      'homographKey',
      [Vocabulary.sequelize.fn('COUNT', Vocabulary.sequelize.col('id')), 'count'],
    ],
    group: ['normalizedLemma', 'partOfSpeech', 'homographKey'],
    having: Vocabulary.sequelize.literal('COUNT(id) > 1'),
    raw: true,
  })
  if (duplicates.length) issues.push(`Existen ${duplicates.length} claves canónicas duplicadas.`)

  return {
    valid: issues.length === 0,
    vocabularyCount: words.length,
    chapterLinkCount: links,
    representedChapters: [...chapterSet].sort((left, right) => left - right),
    issues,
  }
}
