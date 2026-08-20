import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

process.env.DATABASE_STORAGE = ':memory:'

const { sequelize } = await import('../src/database/sequelize.js')
const { models } = await import('../src/models/index.js')
const { ensureDefaultLocalUser } = await import(
  '../src/services/localUserService.js'
)
const {
  backfillLegacyVocabularyProgress,
} = await import('../src/services/legacyVocabularyProgressService.js')
const { savePracticeSession } = await import(
  '../src/services/practiceSessionService.js'
)
const { importManualExercises } = await import(
  '../src/services/exerciseService.js'
)

function exerciseData(overrides = {}) {
  return {
    topic: 'vocabulary',
    vocabularyLevel: 1,
    vocabularyChapterFrom: 10,
    vocabularyChapterTo: 15,
    exerciseType: 'translation_la_es',
    prompt: 'Traduce al español.',
    question: 'mīles',
    options: [],
    correctAnswer: 'soldado',
    explanation: 'mīles significa soldado.',
    source: 'manual_chatgpt',
    ...overrides,
  }
}

function vocabularyData(overrides = {}) {
  return {
    lemma: 'mīles',
    normalizedLemma: 'miles',
    meaningEs: 'soldado',
    partOfSpeech: 'NOUN',
    firstAppearanceChapter: 12,
    morphologyData: {},
    importStatus: 'VERIFIED',
    ...overrides,
  }
}

before(async () => {
  await sequelize.sync({ force: true })
})

beforeEach(async () => {
  await sequelize.truncate({ cascade: true, restartIdentity: true })
  await ensureDefaultLocalUser()
})

after(async () => {
  await sequelize.close()
})

test('una práctica normal actualiza reconocimiento y producción sin duplicar eventos', async () => {
  const [miles, gladius, hostis] = await Promise.all([
    models.Vocabulary.create(vocabularyData()),
    models.Vocabulary.create(
      vocabularyData({
        lemma: 'gladius',
        normalizedLemma: 'gladius',
        meaningEs: 'espada',
      }),
    ),
    models.Vocabulary.create(
      vocabularyData({
        lemma: 'hostis',
        normalizedLemma: 'hostis',
        meaningEs: 'enemigo',
      }),
    ),
  ])
  const exercises = await models.Exercise.bulkCreate([
    exerciseData(),
    exerciseData({
      exerciseType: 'translation_es_la',
      question: 'espada',
      correctAnswer: 'gladius',
    }),
    exerciseData({ question: 'hostis', correctAnswer: 'enemigo' }),
  ])
  const answerStateByExercise = {
    [exercises[0].id]: {
      selectedAnswer: 'Soldado',
      evaluation: { status: 'correct' },
    },
    [exercises[1].id]: {
      selectedAnswer: 'Gladius',
      evaluation: { status: 'correct' },
    },
    [exercises[2].id]: {
      selectedAnswer: 'amigo',
      evaluation: { status: 'incorrect' },
    },
  }
  const payload = {
    practiceKind: 'vocabulary',
    practiceLabel: 'Vocabulario',
    detailLabel: 'Caps. 10-15',
    status: 'completed',
    correctAnswers: 2,
    totalAnswers: 3,
    activityData: {
      chapterFrom: 10,
      chapterTo: 15,
      exerciseType: 'translation_la_es',
      exercises: exercises.map((exercise) => exercise.get({ plain: true })),
      progress: { answerStateByExercise },
    },
  }

  const session = await savePracticeSession(payload)
  const progressRows = await models.UserVocabularyProgress.findAll({
    order: [['vocabularyId', 'ASC']],
    raw: true,
  })

  assert.equal(session.userId, 1)
  assert.equal(progressRows.length, 3)
  assert.equal(
    progressRows.find((row) => row.vocabularyId === miles.id).recognitionScore,
    12,
  )
  assert.equal(
    progressRows.find((row) => row.vocabularyId === miles.id).productionScore,
    0,
  )
  assert.equal(
    progressRows.find((row) => row.vocabularyId === gladius.id).productionScore,
    12,
  )
  assert.equal(
    progressRows.find((row) => row.vocabularyId === gladius.id).learningStage,
    'RECOGNITION',
  )
  assert.equal(
    progressRows.find((row) => row.vocabularyId === hostis.id).lapseCount,
    1,
  )
  assert.equal(await models.VocabularyReviewEvent.count(), 3)

  await savePracticeSession(payload, session.id)
  assert.equal(await models.VocabularyReviewEvent.count(), 3)
  assert.equal(
    await models.UserVocabularyProgress.max('timesReviewed'),
    1,
  )

  const linkedExercises = await models.Exercise.findAll({
    order: [['id', 'ASC']],
  })
  assert.deepEqual(linkedExercises[0].targetVocabularyIds, [miles.id])
  assert.deepEqual(linkedExercises[1].targetVocabularyIds, [gladius.id])
  assert.deepEqual(linkedExercises[2].targetVocabularyIds, [hostis.id])
})

test('recupera respuestas históricas y crea un objetivo canónico si faltaba', async () => {
  const exercise = await models.Exercise.create(
    exerciseData({ question: 'cauda', correctAnswer: 'cola' }),
  )
  await models.PracticeSession.create({
    practiceKind: 'vocabulary',
    practiceLabel: 'Vocabulario',
    detailLabel: 'Caps. 10-15',
    status: 'completed',
    correctAnswers: 0,
    totalAnswers: 1,
    accuracy: 0,
    completedAt: new Date('2026-08-19T18:00:00Z'),
    activityData: {
      chapterFrom: 10,
      chapterTo: 15,
      exerciseType: 'translation_la_es',
      exercises: [exercise.get({ plain: true })],
      progress: {
        answerStateByExercise: {
          [exercise.id]: {
            selectedAnswer: 'cóla',
            evaluation: { status: 'almost' },
          },
        },
      },
    },
  })

  const first = await backfillLegacyVocabularyProgress()
  const second = await backfillLegacyVocabularyProgress()
  const vocabulary = await models.Vocabulary.findOne({
    where: { normalizedLemma: 'cauda' },
  })
  const progress = await models.UserVocabularyProgress.findOne({
    where: { vocabularyId: vocabulary.id },
  })
  const event = await models.VocabularyReviewEvent.findOne()

  assert.equal(first.recorded, 1)
  assert.equal(first.createdVocabulary, 1)
  assert.equal(second.recorded, 0)
  assert.equal(await models.VocabularyReviewEvent.count(), 1)
  assert.equal(vocabulary.meaningEs, 'cola')
  assert.equal(vocabulary.importStatus, 'NEEDS_REVIEW')
  assert.equal(progress.recognitionScore, 4)
  assert.equal(event.result, 'PARTIAL')
  assert.match(event.sourceKey, /^legacy-practice:/)
  assert.deepEqual((await exercise.reload()).targetVocabularyIds, [vocabulary.id])
})

test('los ejercicios nuevos quedan vinculados a su lema desde la importación', async () => {
  const [exercise] = await importManualExercises({
    topic: 'vocabulary',
    vocabularyLevel: 1,
    vocabularyChapterFrom: 10,
    vocabularyChapterTo: 15,
    exerciseType: 'translation_la_es',
    exercises: [
      {
        exerciseType: 'translation_la_es',
        prompt: 'Traduce al español.',
        question: 'cauda',
        options: [],
        correctAnswer: 'cola',
        explanation: 'cauda significa cola.',
      },
    ],
  })
  const vocabulary = await models.Vocabulary.findOne({
    where: { normalizedLemma: 'cauda' },
  })

  assert.ok(vocabulary)
  assert.deepEqual(exercise.targetVocabularyIds, [vocabulary.id])
  assert.deepEqual(
    (await models.Exercise.findByPk(exercise.id)).targetVocabularyIds,
    [vocabulary.id],
  )
})
