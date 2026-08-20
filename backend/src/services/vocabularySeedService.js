import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Vocabulary } from '../models/Vocabulary.js'
import { importVocabularyEntries } from './vocabularyImportService.js'

const currentFile = fileURLToPath(import.meta.url)
const seedPath = path.resolve(
  path.dirname(currentFile),
  '../../seed/familia-romana-vocabulary.json',
)

export async function ensureVocabularySeed() {
  const vocabularyCount = await Vocabulary.count()
  if (vocabularyCount > 0) {
    return { imported: false, vocabularyCount }
  }

  const seed = JSON.parse(await readFile(seedPath, 'utf8'))
  const operation = await importVocabularyEntries(seed.entries)
  return {
    imported: true,
    vocabularyCount: seed.entries.length,
    operation,
  }
}
