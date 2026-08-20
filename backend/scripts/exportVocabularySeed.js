import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sequelize } from '../src/database/sequelize.js'
import { Vocabulary } from '../src/models/Vocabulary.js'
import { VocabularyChapter } from '../src/models/VocabularyChapter.js'
import '../src/models/index.js'

const currentFile = fileURLToPath(import.meta.url)
const outputPath = path.resolve(
  path.dirname(currentFile),
  '../seed/familia-romana-vocabulary.json',
)

try {
  const vocabulary = await Vocabulary.findAll({
    include: [{ model: VocabularyChapter, as: 'chapters', required: true }],
    order: [
      ['firstAppearanceChapter', 'ASC'],
      ['normalizedLemma', 'ASC'],
    ],
  })
  if (!vocabulary.length) {
    throw new Error('La base local no contiene vocabulario para exportar.')
  }

  const entries = vocabulary.map((word) => {
    const values = word.toJSON()
    const chapters = values.chapters
      .map(({ chapter, firstOccurrenceLine }) => ({ chapter, firstOccurrenceLine }))
      .sort((left, right) => left.chapter - right.chapter)
    delete values.id
    delete values.createdAt
    delete values.updatedAt
    delete values.chapters
    return { ...values, chapters }
  })

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Familia Romana — Index Vocabulorum',
    entries,
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Semilla exportada: ${entries.length} entradas en ${outputPath}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await sequelize.close()
}
