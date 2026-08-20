import { sequelize } from './sequelize.js'
import { runDatabaseMigrations } from './migrate.js'
import { ensureDefaultLocalUser } from '../services/localUserService.js'
import { backfillLegacyVocabularyProgress } from '../services/legacyVocabularyProgressService.js'
import { ensureVocabularySeed } from '../services/vocabularySeedService.js'

try {
  const migrated = await runDatabaseMigrations()
  await ensureDefaultLocalUser()
  await ensureVocabularySeed()
  const backfill = await backfillLegacyVocabularyProgress()
  console.log(
    migrated
      ? 'Migraciones aplicadas y base de datos sincronizada correctamente.'
      : 'Base de datos sincronizada correctamente; no había migraciones pendientes.',
  )
  if (backfill.recorded > 0) {
    console.log(
      `Se recuperaron ${backfill.recorded} respuestas históricas de vocabulario.`,
    )
  }
  await sequelize.close()
} catch (error) {
  console.error('No se pudo sincronizar la base de datos.', error)
  process.exit(1)
}
