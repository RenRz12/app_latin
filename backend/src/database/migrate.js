import { DataTypes, QueryTypes } from 'sequelize'
import { sequelize } from './sequelize.js'
import '../models/index.js'
import { VOCABULARY_CATALOG_FIXES } from '../data/vocabularyCatalogFixes.js'

const ADAPTIVE_VOCABULARY_MIGRATION = '202608140001-adaptive-vocabulary'
const ADAPTIVE_REVIEW_ENGINE_MIGRATION = '202608140002-adaptive-review-engine'
const LEGACY_VOCABULARY_SYNC_MIGRATION =
  '202608190001-legacy-vocabulary-progress-sync'
const VOCABULARY_CATALOG_FIXES_MIGRATION =
  '202608230001-vocabulary-catalog-fixes'

async function ensureMigrationTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY NOT NULL,
      appliedAt DATETIME NOT NULL
    )
  `)
}

async function migrationWasApplied(name) {
  const rows = await sequelize.query(
    'SELECT name FROM schema_migrations WHERE name = :name LIMIT 1',
    { replacements: { name }, type: QueryTypes.SELECT },
  )
  return rows.length > 0
}

async function removeEmptyFailedBackup(queryInterface, transaction) {
  const tables = await queryInterface.showAllTables({ transaction })
  if (!tables.includes('vocabulary_backup')) return

  const [row] = await sequelize.query(
    'SELECT COUNT(*) AS count FROM vocabulary_backup',
    {
      type: QueryTypes.SELECT,
      transaction,
    },
  )
  if (Number(row.count) !== 0) {
    throw new Error(
      'Existe vocabulary_backup con datos; no se eliminará automáticamente.',
    )
  }
  await queryInterface.dropTable('vocabulary_backup', { transaction })
}

export async function runDatabaseMigrations() {
  await sequelize.sync()
  await ensureMigrationTable()
  const queryInterface = sequelize.getQueryInterface()
  let appliedAny = false

  if (!(await migrationWasApplied(ADAPTIVE_VOCABULARY_MIGRATION))) {
    await sequelize.transaction(async (transaction) => {
      const progressColumns = await queryInterface.describeTable(
        'user_vocabulary_progress',
        {
          transaction,
        },
      )
      if (!progressColumns.lastSuccessfulRecallAt) {
        await queryInterface.addColumn(
          'user_vocabulary_progress',
          'lastSuccessfulRecallAt',
          { type: DataTypes.DATE, allowNull: true },
          { transaction },
        )
      }

      const chapterColumns = await queryInterface.describeTable(
        'vocabulary_chapters',
        {
          transaction,
        },
      )
      if (!chapterColumns.createdAt) {
        await queryInterface.addColumn(
          'vocabulary_chapters',
          'createdAt',
          { type: DataTypes.DATE, allowNull: true },
          { transaction },
        )
        await sequelize.query(
          'UPDATE vocabulary_chapters SET createdAt = CURRENT_TIMESTAMP WHERE createdAt IS NULL',
          { transaction },
        )
      }

      await removeEmptyFailedBackup(queryInterface, transaction)
      await sequelize.query(
        'INSERT INTO schema_migrations (name, appliedAt) VALUES (:name, :appliedAt)',
        {
          replacements: {
            name: ADAPTIVE_VOCABULARY_MIGRATION,
            appliedAt: new Date(),
          },
          transaction,
        },
      )
    })
    appliedAny = true
  }

  if (!(await migrationWasApplied(ADAPTIVE_REVIEW_ENGINE_MIGRATION))) {
    await sequelize.transaction(async (transaction) => {
      const sessionColumns = await queryInterface.describeTable(
        'practice_sessions',
        { transaction },
      )
      const sessionAdditions = {
        userId: { type: DataTypes.INTEGER, allowNull: true },
        sessionMode: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'LEGACY',
        },
        currentBook: { type: DataTypes.STRING, allowNull: true },
        currentReadingChapter: { type: DataTypes.INTEGER, allowNull: true },
        sessionSize: { type: DataTypes.INTEGER, allowNull: true },
        planData: { type: DataTypes.JSON, allowNull: true },
      }
      for (const [column, definition] of Object.entries(sessionAdditions)) {
        if (!sessionColumns[column]) {
          await queryInterface.addColumn(
            'practice_sessions',
            column,
            definition,
            { transaction },
          )
        }
      }

      const exerciseColumns = await queryInterface.describeTable('exercises', {
        transaction,
      })
      const exerciseAdditions = {
        sessionId: { type: DataTypes.INTEGER, allowNull: true },
        targetVocabularyIds: { type: DataTypes.JSON, allowNull: true },
        adaptiveExerciseType: { type: DataTypes.STRING, allowNull: true },
        grammarTargets: { type: DataTypes.JSON, allowNull: true },
        usedVocabulary: { type: DataTypes.JSON, allowNull: true },
        generationMetadata: { type: DataTypes.JSON, allowNull: true },
      }
      for (const [column, definition] of Object.entries(exerciseAdditions)) {
        if (!exerciseColumns[column]) {
          await queryInterface.addColumn('exercises', column, definition, {
            transaction,
          })
        }
      }

      const progressColumns = await queryInterface.describeTable(
        'user_vocabulary_progress',
        {
          transaction,
        },
      )
      if (!progressColumns.consecutiveIncorrect) {
        await queryInterface.addColumn(
          'user_vocabulary_progress',
          'consecutiveIncorrect',
          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          { transaction },
        )
      }

      const eventColumns = await queryInterface.describeTable(
        'vocabulary_review_events',
        {
          transaction,
        },
      )
      if (!eventColumns.exerciseId) {
        await queryInterface.addColumn(
          'vocabulary_review_events',
          'exerciseId',
          { type: DataTypes.INTEGER, allowNull: true },
          { transaction },
        )
      }
      if (!eventColumns.metadata) {
        await queryInterface.addColumn(
          'vocabulary_review_events',
          'metadata',
          { type: DataTypes.JSON, allowNull: true },
          { transaction },
        )
      }

      const indexDefinitions = [
        [
          'practice_sessions',
          ['userId', 'sessionMode', 'completedAt'],
          'practice_sessions_user_mode_date',
        ],
        ['exercises', ['sessionId'], 'exercises_session_id'],
        [
          'vocabulary_review_events',
          ['exerciseId'],
          'vocabulary_review_events_exercise_id',
        ],
      ]
      for (const [table, fields, name] of indexDefinitions) {
        const indexes = await queryInterface.showIndex(table, { transaction })
        if (!indexes.some((index) => index.name === name)) {
          await queryInterface.addIndex(table, fields, { name, transaction })
        }
      }

      await sequelize.query(
        'INSERT INTO schema_migrations (name, appliedAt) VALUES (:name, :appliedAt)',
        {
          replacements: {
            name: ADAPTIVE_REVIEW_ENGINE_MIGRATION,
            appliedAt: new Date(),
          },
          transaction,
        },
      )
    })
    appliedAny = true
  }

  if (!(await migrationWasApplied(LEGACY_VOCABULARY_SYNC_MIGRATION))) {
    await sequelize.transaction(async (transaction) => {
      const eventColumns = await queryInterface.describeTable(
        'vocabulary_review_events',
        { transaction },
      )
      if (!eventColumns.sourceKey) {
        await queryInterface.addColumn(
          'vocabulary_review_events',
          'sourceKey',
          { type: DataTypes.STRING, allowNull: true },
          { transaction },
        )
      }

      const eventIndexes = await queryInterface.showIndex(
        'vocabulary_review_events',
        { transaction },
      )
      if (
        !eventIndexes.some(
          (index) =>
            index.name === 'vocabulary_review_events_source_key_unique',
        )
      ) {
        await queryInterface.addIndex(
          'vocabulary_review_events',
          ['sourceKey'],
          {
            name: 'vocabulary_review_events_source_key_unique',
            unique: true,
            transaction,
          },
        )
      }

      await sequelize.query(
        'INSERT INTO schema_migrations (name, appliedAt) VALUES (:name, :appliedAt)',
        {
          replacements: {
            name: LEGACY_VOCABULARY_SYNC_MIGRATION,
            appliedAt: new Date(),
          },
          transaction,
        },
      )
    })
    appliedAny = true
  }

  if (!(await migrationWasApplied(VOCABULARY_CATALOG_FIXES_MIGRATION))) {
    await sequelize.transaction(async (transaction) => {
      for (const fix of VOCABULARY_CATALOG_FIXES) {
        const [legacyWord] = await sequelize.query(
          `SELECT id
           FROM vocabulary
           WHERE normalizedLemma = :legacyNormalizedLemma
           LIMIT 1`,
          {
            replacements: {
              legacyNormalizedLemma: fix.legacyNormalizedLemma,
            },
            type: QueryTypes.SELECT,
            transaction,
          },
        )
        if (!legacyWord) continue

        const [canonicalWord] = await sequelize.query(
          `SELECT id
           FROM vocabulary
           WHERE normalizedLemma = :normalizedLemma
             AND id <> :legacyId
           LIMIT 1`,
          {
            replacements: {
              normalizedLemma: fix.normalizedLemma,
              legacyId: legacyWord.id,
            },
            type: QueryTypes.SELECT,
            transaction,
          },
        )
        if (canonicalWord) {
          throw new Error(
            `No se puede corregir ${fix.legacyNormalizedLemma}: el lema ${fix.normalizedLemma} ya existe.`,
          )
        }

        await sequelize.query(
          `UPDATE vocabulary
           SET lemma = :lemma,
               normalizedLemma = :normalizedLemma,
               meaningEs = :meaningEs,
               partOfSpeech = :partOfSpeech,
               firstAppearanceChapter = :firstAppearanceChapter,
               nominative = :nominative,
               genitive = :genitive,
               gender = :gender,
               principalParts = :principalParts,
               morphologyData = :morphologyData,
               importStatus = 'VERIFIED',
               updatedAt = :updatedAt
           WHERE id = :id`,
          {
            replacements: {
              ...fix,
              id: legacyWord.id,
              principalParts: fix.principalParts
                ? JSON.stringify(fix.principalParts)
                : null,
              morphologyData: JSON.stringify(fix.morphologyData),
              updatedAt: new Date(),
            },
            transaction,
          },
        )
        await sequelize.query(
          `UPDATE vocabulary_chapters
           SET chapter = :chapter,
               firstOccurrenceLine = :firstOccurrenceLine
           WHERE vocabularyId = :vocabularyId`,
          {
            replacements: {
              vocabularyId: legacyWord.id,
              chapter: fix.firstAppearanceChapter,
              firstOccurrenceLine: fix.firstOccurrenceLine,
            },
            transaction,
          },
        )
      }

      await sequelize.query(
        'INSERT INTO schema_migrations (name, appliedAt) VALUES (:name, :appliedAt)',
        {
          replacements: {
            name: VOCABULARY_CATALOG_FIXES_MIGRATION,
            appliedAt: new Date(),
          },
          transaction,
        },
      )
    })
    appliedAny = true
  }

  await sequelize.query('PRAGMA optimize')
  return appliedAny
}
