import assert from 'node:assert/strict'
import { after, test } from 'node:test'

process.env.DATABASE_STORAGE = ':memory:'

const { sequelize } = await import('../src/database/sequelize.js')
const { runDatabaseMigrations } = await import('../src/database/migrate.js')
const { models } = await import('../src/models/index.js')

after(async () => {
  await sequelize.close()
})

test('corrige el catálogo existente sin cambiar los identificadores ni el progreso', async () => {
  await sequelize.sync({ force: true })
  const legacyWords = []
  for (const [index, normalizedLemma] of [
    'corisistere',
    'honus',
    'inulus',
    'mium',
    'nasusim',
  ].entries()) {
    const word = await models.Vocabulary.create({
      lemma: normalizedLemma,
      normalizedLemma,
      meaningEs: null,
      partOfSpeech: index % 2 ? 'NOUN' : 'UNKNOWN',
      firstAppearanceChapter: 5,
      morphologyData: { indexEntry: normalizedLemma },
      importStatus: 'VERIFIED',
    })
    await models.VocabularyChapter.create({
      vocabularyId: word.id,
      chapter: 5,
      firstOccurrenceLine: index + 1,
    })
    legacyWords.push(word)
  }
  const user = await models.User.create({ displayName: 'Progreso conservado' })
  await models.UserVocabularyProgress.create({
    userId: user.id,
    vocabularyId: legacyWords[1].id,
    learningStage: 'RECOGNITION',
    recognitionScore: 40,
  })

  await runDatabaseMigrations()

  const corrected = await models.Vocabulary.findAll({ order: [['id', 'ASC']] })
  assert.deepEqual(
    corrected.map((word) => word.normalizedLemma),
    ['consistere', 'hortus', 'anulus', 'lilium', 'nasus'],
  )
  assert.deepEqual(
    corrected.map((word) => word.id),
    legacyWords.map((word) => word.id),
  )
  assert.equal(corrected[1].lemma, 'hortus')
  assert.equal(corrected[1].meaningEs, 'jardín')
  assert.equal(
    (await models.UserVocabularyProgress.findOne()).vocabularyId,
    legacyWords[1].id,
  )
  const chapterByVocabularyId = new Map(
    (await models.VocabularyChapter.findAll()).map((link) => [
      link.vocabularyId,
      link.chapter,
    ]),
  )
  assert.equal(chapterByVocabularyId.get(legacyWords[0].id), 8)
  assert.equal(chapterByVocabularyId.get(legacyWords[2].id), 8)
})
