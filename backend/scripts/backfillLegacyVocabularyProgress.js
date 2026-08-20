import { sequelize } from '../src/database/sequelize.js'
import { runDatabaseMigrations } from '../src/database/migrate.js'
import { backfillLegacyVocabularyProgress } from '../src/services/legacyVocabularyProgressService.js'
import { ensureDefaultLocalUser } from '../src/services/localUserService.js'

try {
  await runDatabaseMigrations()
  await ensureDefaultLocalUser()
  const summary = await backfillLegacyVocabularyProgress()
  console.log(JSON.stringify(summary, null, 2))
  await sequelize.close()
} catch (error) {
  console.error('No se pudo recuperar el progreso histórico.', error)
  await sequelize.close()
  process.exit(1)
}
