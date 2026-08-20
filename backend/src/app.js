import express from 'express'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { env, validateRuntimeEnvironment } from './config/env.js'
import { corsMiddleware } from './config/cors.js'
import { runDatabaseMigrations } from './database/migrate.js'
import { errorHandler } from './middlewares/errorHandler.js'
import './models/index.js'
import { apiRoutes } from './routes/index.js'
import { ensureDefaultLocalUser } from './services/localUserService.js'
import { backfillLegacyVocabularyProgress } from './services/legacyVocabularyProgressService.js'
import { ensureVocabularySeed } from './services/vocabularySeedService.js'

const currentFile = fileURLToPath(import.meta.url)
const frontendDistribution = path.resolve(
  path.dirname(currentFile),
  '../../frontend/dist',
)

validateRuntimeEnvironment()

const app = express()

app.set('trust proxy', 1)
app.use(corsMiddleware)
app.use(express.json())
app.use('/api', apiRoutes)

if (existsSync(frontendDistribution)) {
  app.use(express.static(frontendDistribution))
  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(path.join(frontendDistribution, 'index.html'))
  })
}

app.use(errorHandler)

try {
  await runDatabaseMigrations()
  await ensureDefaultLocalUser()
  const vocabularySeed = await ensureVocabularySeed()
  if (vocabularySeed.imported) {
    console.log(
      `Vocabulario inicial cargado: ${vocabularySeed.vocabularyCount} entradas.`,
    )
  }
  const backfill = await backfillLegacyVocabularyProgress()
  if (backfill.recorded > 0) {
    console.log(
      `Progreso histórico de vocabulario recuperado: ${backfill.recorded} respuestas.`,
    )
  }

  app.listen(env.port, () => {
    console.log(`Backend escuchando en http://localhost:${env.port}`)
  })
} catch (error) {
  console.error('No se pudo iniciar el backend.', error)
  process.exit(1)
}
