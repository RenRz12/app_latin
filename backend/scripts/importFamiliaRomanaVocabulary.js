import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sequelize } from '../src/database/sequelize.js'
import '../src/models/index.js'
import {
  importVocabularyEntries,
  validateImportedVocabulary,
} from '../src/services/vocabularyImportService.js'

const currentFile = fileURLToPath(import.meta.url)
const scriptsDirectory = path.dirname(currentFile)
const backendDirectory = path.resolve(scriptsDirectory, '..')

function parseArguments(argv) {
  const options = {
    dryRun: false,
    pdf: process.env.FAMILIA_ROMANA_PDF || '',
    python: process.env.PYTHON_BIN || 'python',
    report: path.join(backendDirectory, 'reports', 'vocabulary-import-report.json'),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--pdf') options.pdf = argv[++index]
    else if (argument === '--python') options.python = argv[++index]
    else if (argument === '--report') options.report = path.resolve(argv[++index])
    else throw new Error(`Argumento desconocido: ${argument}`)
  }
  if (!options.pdf) throw new Error('Indicá el PDF con --pdf o FAMILIA_ROMANA_PDF.')
  return options
}

function extractVocabulary(options) {
  const extractor = path.join(scriptsDirectory, 'extract_familia_romana_vocabulary.py')
  const result = spawnSync(options.python, ['-X', 'utf8', extractor, path.resolve(options.pdf)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `El extractor terminó con código ${result.status}.`)
  }
  const payload = JSON.parse(result.stdout)
  if (payload.error) throw new Error(payload.error)
  return payload
}

function assertCoherentExtraction(payload) {
  const missingChapters = payload.report.missingChapters || []
  if (payload.entries.length < 1000) {
    throw new Error(`La extracción solo produjo ${payload.entries.length} entradas; se cancela.`)
  }
  if (missingChapters.length) {
    throw new Error(`Faltan los capítulos ${missingChapters.join(', ')}; se cancela.`)
  }
}

function printChapterSummary(chapters) {
  console.log('Cap. | lemas | apariciones')
  for (const [chapter, values] of Object.entries(chapters)) {
    console.log(
      `${chapter.padStart(4)} | ${String(values.uniqueLemmas).padStart(5)} | ${String(values.detectedOccurrences).padStart(11)}`,
    )
  }
}

function printDryRunSummary(chapters) {
  console.log('Cap. | formas | lemas | nuevas | existentes | relaciones nuevas')
  for (const [chapter, values] of Object.entries(chapters)) {
    console.log(
      `${chapter.padStart(4)} | ${String(values.detectedOccurrences).padStart(6)} | ` +
        `${String(values.uniqueLemmas).padStart(5)} | ${String(values.newVocabulary).padStart(6)} | ` +
        `${String(values.existingVocabulary).padStart(10)} | ` +
        `${String(values.chapterAssociationsToAdd).padStart(16)}`,
    )
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const payload = extractVocabulary(options)
  assertCoherentExtraction(payload)
  await sequelize.authenticate()

  const operation = await importVocabularyEntries(payload.entries, { dryRun: options.dryRun })
  const validation = options.dryRun ? null : await validateImportedVocabulary()
  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? 'dry-run' : 'import',
    pdfFile: path.basename(options.pdf),
    ...payload.report,
    operation,
    validation,
  }

  await mkdir(path.dirname(options.report), { recursive: true })
  await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`${options.dryRun ? 'Simulación' : 'Importación'} completada.`)
  console.log(
    `${payload.report.uniqueVocabularyEntries} lemas; ${payload.report.detectedOccurrences} apariciones; ` +
      `${payload.report.needsReviewEntries} entradas por revisar.`,
  )
  if (options.dryRun) printDryRunSummary(operation.chapters)
  else printChapterSummary(payload.report.chapters)
  const { chapters: _chapterOperation, ...operationTotals } = operation
  console.log('Operación:', operationTotals)
  if (validation) console.log('Validación:', validation)
  console.log(`Informe: ${options.report}`)
}

try {
  await main()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await sequelize.close()
}
