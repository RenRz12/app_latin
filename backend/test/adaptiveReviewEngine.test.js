import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

process.env.DATABASE_STORAGE = ':memory:'
process.env.AI_PROVIDER = 'mock'

const { sequelize } = await import('../src/database/sequelize.js')
const { models } = await import('../src/models/index.js')
const {
  allocateBucketSlots,
  calculateVocabularyPriority,
  selectVocabularyCandidates,
} = await import('../src/services/reviewSchedulerService.js')
const { selectExerciseType } =
  await import('../src/services/exercisePlannerService.js')
const {
  buildAdaptiveExercisePrompt,
  buildExerciseGenerationRequest,
  validateAdaptiveGeneratedExercises,
} = await import('../src/services/exercisePromptBuilderService.js')
const {
  createAdaptivePracticeSession,
  generateAdaptiveSessionExercises,
  getAdaptivePracticeSession,
  submitAdaptiveExerciseAnswer,
} = await import('../src/services/adaptivePracticeService.js')
const { calculateVocabularyProgressUpdate, recordVocabularyReview } =
  await import('../src/services/vocabularyProgressService.js')
const { evaluateSubmittedAnswer } =
  await import('../src/services/answerEvaluationService.js')
const { getVocabularyMetrics } =
  await import('../src/services/adaptiveVocabularyService.js')

const NOW = new Date('2026-08-14T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

function progress(overrides = {}) {
  return {
    learningStage: 'NEW',
    recognitionScore: 0,
    productionScore: 0,
    morphologyScore: 0,
    timesSeen: 0,
    timesReviewed: 0,
    successfulRecognition: 0,
    failedRecognition: 0,
    successfulRecall: 0,
    failedRecall: 0,
    correctProduction: 0,
    failedProduction: 0,
    correctMorphology: 0,
    failedMorphology: 0,
    currentStreak: 0,
    longestStreak: 0,
    lapseCount: 0,
    consecutiveIncorrect: 0,
    reviewIntervalDays: 1,
    easeFactor: 2.3,
    firstSeenAt: null,
    lastReviewedAt: null,
    lastCorrectAt: null,
    nextReviewAt: null,
    ...overrides,
  }
}

function word(id, chapter, overrides = {}) {
  return {
    id,
    lemma: `verbum${id}`,
    normalizedLemma: `verbum${id}`,
    meaningEs: `palabra ${id}`,
    partOfSpeech: id % 3 === 0 ? 'VERB' : id % 3 === 1 ? 'NOUN' : 'ADJECTIVE',
    firstAppearanceChapter: chapter,
    morphologyData: { rawOccurrences: 2 },
    chapters: [{ chapter }],
    ...overrides,
  }
}

before(async () => {
  await sequelize.sync({ force: true })
})

beforeEach(async () => {
  await sequelize.truncate({ cascade: true, restartIdentity: true })
})

after(async () => {
  await sequelize.close()
})

test('una palabra vencida tiene mayor prioridad que una MASTERED revisada hoy', () => {
  const dueCandidate = {
    vocabulary: word(1, 10),
    sourceBucket: 'DUE',
    progress: progress({
      learningStage: 'RECOGNITION',
      nextReviewAt: new Date(NOW.getTime() - DAY_MS),
      lastReviewedAt: new Date(NOW.getTime() - 5 * DAY_MS),
    }),
    recent: { correct: 0, incorrect: 0 },
  }
  const masteredCandidate = {
    vocabulary: word(2, 2),
    sourceBucket: 'MAINTENANCE',
    progress: progress({
      learningStage: 'MASTERED',
      recognitionScore: 95,
      productionScore: 90,
      morphologyScore: 80,
      currentStreak: 8,
      lastReviewedAt: NOW,
      nextReviewAt: new Date(NOW.getTime() + 30 * DAY_MS),
    }),
    recent: { correct: 2, incorrect: 0 },
  }

  assert.ok(
    calculateVocabularyPriority(dueCandidate, {
      currentChapter: 26,
      now: NOW,
    }) >
      calculateVocabularyPriority(masteredCandidate, {
        currentChapter: 26,
        now: NOW,
      }),
  )
})

test('la producción débil favorece recuperación o producción', () => {
  const choices = [0, 1, 2, 3].map((itemIndex) =>
    selectExerciseType(
      progress({
        recognitionScore: 95,
        productionScore: 30,
        learningStage: 'GUIDED_RECALL',
      }),
      { itemIndex },
    ),
  )
  assert.equal(
    choices.every((type) =>
      ['GUIDED_RECALL', 'TRANSLATION_ES_LA', 'INFLECTION_COMPLETION', 'FREE_PRODUCTION'].includes(type),
    ),
    true,
  )
  assert.ok(new Set(choices).size >= 2)
})

test('la morfología débil favorece MORPHOLOGY', () => {
  assert.equal(
    selectExerciseType(
      progress({
        learningStage: 'PRODUCTION',
        recognitionScore: 90,
        productionScore: 85,
        morphologyScore: 35,
      }),
    ),
    'INFLECTION_COMPLETION',
  )
})

test('selecciona backlog, vocabulario actual y mantenimiento sin duplicados', () => {
  const vocabulary = [
    ...Array.from({ length: 5 }, (_value, index) => word(index + 1, 26)),
    ...Array.from({ length: 14 }, (_value, index) =>
      word(index + 6, 16 + (index % 10)),
    ),
    ...Array.from({ length: 4 }, (_value, index) =>
      word(index + 20, 4 + index),
    ),
    ...Array.from({ length: 6 }, (_value, index) =>
      word(index + 24, 8 + index),
    ),
  ]
  const progressByVocabularyId = new Map()
  for (let id = 20; id <= 23; id += 1) {
    progressByVocabularyId.set(
      id,
      progress({
        vocabularyId: id,
        learningStage: 'MASTERED',
        recognitionScore: 95,
        productionScore: 90,
        morphologyScore: 75,
        timesReviewed: 10,
        lastReviewedAt: new Date(NOW.getTime() - 20 * DAY_MS),
        nextReviewAt: new Date(NOW.getTime() + 10 * DAY_MS),
      }),
    )
  }
  for (let id = 24; id <= 29; id += 1) {
    progressByVocabularyId.set(
      id,
      progress({
        vocabularyId: id,
        learningStage: 'RECOGNITION',
        recognitionScore: 40,
        nextReviewAt: new Date(NOW.getTime() - DAY_MS),
      }),
    )
  }

  const selected = selectVocabularyCandidates({
    vocabulary,
    progressByVocabularyId,
    currentChapter: 26,
    sessionSize: 20,
    now: NOW,
  })
  const buckets = new Set(selected.map((candidate) => candidate.sourceBucket))
  assert.equal(selected.length, 20)
  assert.equal(
    new Set(selected.map((candidate) => candidate.vocabulary.id)).size,
    20,
  )
  assert.equal(buckets.has('BACKLOG'), true)
  assert.equal(buckets.has('CURRENT'), true)
  assert.equal(buckets.has('MAINTENANCE'), true)
  assert.equal(buckets.has('DUE'), true)
})

test('redistribuye los lugares si no existe vocabulario CURRENT', () => {
  const vocabulary = Array.from({ length: 12 }, (_value, index) =>
    word(index + 1, 5 + index),
  )
  const selected = selectVocabularyCandidates({
    vocabulary,
    currentChapter: 26,
    sessionSize: 10,
    now: NOW,
  })
  assert.equal(selected.length, 10)
  assert.equal(
    selected.some((candidate) => candidate.sourceBucket === 'CURRENT'),
    false,
  )
})

test('la distribución normal de 20 objetivos es 8/6/4/2', () => {
  assert.deepEqual(
    allocateBucketSlots(20, {
      DUE: 0.4,
      BACKLOG: 0.3,
      CURRENT: 0.2,
      MAINTENANCE: 0.1,
    }),
    { DUE: 8, BACKLOG: 6, CURRENT: 4, MAINTENANCE: 2 },
  )
})

test('el pedido y el prompt son restrictivos y no exponen al usuario', () => {
  const plan = {
    currentBook: 'Familia Romana',
    currentReadingChapter: 26,
    items: [
      {
        vocabularyId: 123,
        lemma: 'quercus',
        meaning: 'encina',
        partOfSpeech: 'NOUN',
        learningStage: 'GUIDED_RECALL',
        selectedExerciseType: 'TRANSLATION_ES_LA',
        grammarTargets: ['ablative', 'singular'],
        weakestSkill: 'PRODUCTION',
        chapterOrigin: 19,
        morphologyReference: {},
        practiceMode: 'STANDARD',
      },
    ],
  }
  const request = buildExerciseGenerationRequest(plan, [
    {
      vocabularyId: 456,
      lemma: 'silva',
      meaning: 'bosque',
      partOfSpeech: 'NOUN',
    },
  ])
  const prompt = buildAdaptiveExercisePrompt(request)

  assert.deepEqual(
    request.targetVocabulary.map((target) => target.id),
    [123],
  )
  assert.equal(request.targetVocabulary[0].lemma, 'quercus')
  assert.equal(request.targetVocabulary[0].exerciseType, 'TRANSLATION_ES_LA')
  assert.deepEqual(request.targetVocabulary[0].grammarTarget, ['ablative', 'singular'])
  assert.equal(request.supportVocabulary[0].vocabularyId, 456)
  assert.equal(request.requirements.useMacronsForDisplay, true)
  assert.equal(JSON.stringify(request).includes('userId'), false)
  assert.match(prompt, /solamente JSON válido/i)
  assert.match(prompt, /No devuelvas scores/i)
  assert.match(prompt, /No devuelvas scores/i)

  assert.equal(
    validateAdaptiveGeneratedExercises(
      {
        exercises: [
          {
            targetVocabularyIds: [123],
            exerciseType: 'TRANSLATION_ES_LA',
            prompt: 'Producí el lema.',
            question: 'encina',
            options: [],
            answer: 'quercus',
            acceptableAnswers: [],
            explanation: 'Quercus significa encina.',
            grammarTargets: ['ablative', 'singular'],
            targetForm: 'quercus',
            usedVocabulary: [123, 456],
          },
        ],
      },
      request,
    ).length,
    1,
  )
})

test('rechaza ejercicios que no utilizan realmente el target', () => {
  const request = buildExerciseGenerationRequest(
    {
      currentBook: 'Familia Romana',
      currentReadingChapter: 15,
      items: [{
        vocabularyId: 9,
        lemma: 'quercus',
        meaning: 'encina',
        partOfSpeech: 'NOUN',
        chapterOrigin: 15,
        learningStage: 'RECOGNITION',
        weakestSkill: 'RECOGNITION',
        selectedExerciseType: 'CONTEXT_MEANING',
        grammarTargets: ['meaning_in_context'],
        morphologyReference: {},
        practiceMode: 'STANDARD',
      }],
    },
    [],
  )
  assert.throws(
    () => validateAdaptiveGeneratedExercises({ exercises: [{
      targetVocabularyIds: [9],
      exerciseType: 'CONTEXT_MEANING',
      prompt: 'Interpretá la palabra.',
      question: 'Marcus ambulat.',
      options: [],
      answer: 'encina',
      acceptableAnswers: [],
      explanation: 'La oración no contiene el target.',
      grammarTargets: ['meaning_in_context'],
      targetForm: 'quercus',
      usedVocabulary: [9],
    }] }, request),
    /no utiliza realmente la palabra objetivo/i,
  )
})

test('un screening correcto repetido acelera sin saltar a MASTERED', () => {
  const first = calculateVocabularyProgressUpdate(
    progress(),
    { reviewType: 'RECOGNITION', result: 'CORRECT', screeningMode: true },
    NOW,
  )
  const second = calculateVocabularyProgressUpdate(
    first,
    { reviewType: 'RECOGNITION', result: 'CORRECT', screeningMode: true },
    new Date(NOW.getTime() + DAY_MS),
  )
  assert.equal(first.learningStage, 'RECOGNITION')
  assert.equal(second.learningStage, 'CONTEXT_RECOGNITION')
  assert.notEqual(second.learningStage, 'MASTERED')
})

test('una sola respuesta incorrecta no destruye MASTERED', () => {
  const updated = calculateVocabularyProgressUpdate(
    progress({
      learningStage: 'MASTERED',
      recognitionScore: 95,
      productionScore: 90,
      morphologyScore: 80,
      lapseCount: 4,
      consecutiveIncorrect: 0,
      currentStreak: 5,
      reviewIntervalDays: 30,
    }),
    { reviewType: 'PRODUCTION', result: 'INCORRECT' },
    NOW,
  )
  assert.equal(updated.learningStage, 'MASTERED')
  assert.equal(updated.lapseCount, 5)
  assert.equal(updated.consecutiveIncorrect, 1)
})

test('un acento simula una vocal larga y los macrones solo se exigen si son objetivo', () => {
  assert.equal(evaluateSubmittedAnswer('míles', 'mīles').result, 'CORRECT')
  assert.equal(evaluateSubmittedAnswer('miles', 'mīles').result, 'CORRECT')
  assert.equal(
    evaluateSubmittedAnswer('miles', 'mīles', { macronsRequired: true }).result,
    'PARTIAL',
  )
})

async function seedAdaptiveScenario() {
  const user = await models.User.create({ displayName: 'Usuario adaptativo' })
  await models.ProfileSettings.create({
    id: 1,
    vocabularyChapterFrom: 1,
    vocabularyChapterTo: 26,
  })
  await models.ReadingProgress.create({
    userId: user.id,
    book: 'Familia Romana',
    currentChapter: 26,
  })
  const words = []
  for (let index = 0; index < 30; index += 1) {
    const chapter =
      index < 5 ? 26 : index < 20 ? 16 + (index % 10) : 3 + (index % 8)
    const vocabulary = await models.Vocabulary.create({
      lemma: `lemma${index + 1}`,
      normalizedLemma: `lemma${index + 1}`,
      meaningEs: `significado ${index + 1}`,
      partOfSpeech: index % 3 === 0 ? 'VERB' : 'NOUN',
      firstAppearanceChapter: chapter,
      morphologyData: { rawOccurrences: index + 1 },
      importStatus: 'VERIFIED',
    })
    await models.VocabularyChapter.create({
      vocabularyId: vocabulary.id,
      chapter,
    })
    words.push(vocabulary)
  }
  for (const vocabulary of words.slice(20, 24)) {
    await models.UserVocabularyProgress.create({
      userId: user.id,
      vocabularyId: vocabulary.id,
      learningStage: 'MASTERED',
      recognitionScore: 95,
      productionScore: 90,
      morphologyScore: 80,
      timesReviewed: 12,
      lastReviewedAt: new Date(NOW.getTime() - 20 * DAY_MS),
      nextReviewAt: new Date(NOW.getTime() + 10 * DAY_MS),
    })
  }
  for (const vocabulary of words.slice(24)) {
    await models.UserVocabularyProgress.create({
      userId: user.id,
      vocabularyId: vocabulary.id,
      learningStage: 'RECOGNITION',
      recognitionScore: 40,
      productionScore: 5,
      nextReviewAt: new Date(NOW.getTime() - 2 * DAY_MS),
      lastReviewedAt: new Date(NOW.getTime() - 5 * DAY_MS),
    })
  }
  return { user, words }
}

test('crea un plan persistente, genera sin cambiar progreso y actualiza solo al responder', async () => {
  const { user } = await seedAdaptiveScenario()
  const session = await createAdaptivePracticeSession({
    userId: user.id,
    sessionSize: 10,
    now: NOW,
  })
  const eventCountBeforeGeneration = await models.VocabularyReviewEvent.count()
  const progressCountBeforeGeneration =
    await models.UserVocabularyProgress.count()
  const generated = await generateAdaptiveSessionExercises(session.id)

  assert.equal(session.plan.items.length, 10)
  assert.equal(generated.exercises.length, 10)
  assert.equal(
    await models.VocabularyReviewEvent.count(),
    eventCountBeforeGeneration,
  )
  assert.equal(
    await models.UserVocabularyProgress.count(),
    progressCountBeforeGeneration,
  )
  assert.deepEqual(
    (await getAdaptivePracticeSession(session.id)).plan.items,
    session.plan.items,
  )

  const firstExercise = generated.exercises[0]
  const correct = await submitAdaptiveExerciseAnswer({
    exerciseId: firstExercise.id,
    userId: user.id,
    answer: firstExercise.answer,
    answeredAt: new Date(NOW.getTime() + 1000),
  })
  const secondExercise = generated.exercises[1]
  const incorrect = await submitAdaptiveExerciseAnswer({
    exerciseId: secondExercise.id,
    userId: user.id,
    answer: 'respuesta deliberadamente incorrecta',
    answeredAt: new Date(NOW.getTime() + 2000),
  })

  assert.equal(correct.evaluation.result, 'CORRECT')
  assert.equal(incorrect.evaluation.result, 'INCORRECT')
  assert.equal(incorrect.progress[0].lapseCount >= 1, true)
  assert.equal(
    await models.VocabularyReviewEvent.count(),
    eventCountBeforeGeneration + 2,
  )
  const storedEvent = await models.VocabularyReviewEvent.findOne({
    where: { exerciseId: firstExercise.id },
  })
  const metadata = typeof storedEvent.metadata === 'string'
    ? JSON.parse(storedEvent.metadata)
    : storedEvent.metadata
  assert.equal(metadata.exerciseType, firstExercise.exerciseType)
  assert.ok(metadata.evaluatedSkill)
  assert.deepEqual(metadata.errorTypes, [])
  assert.ok(metadata.previousScores)
  assert.ok(metadata.resultingScores)
  const supportEvents = await Promise.all(
    generated.generationRequest.supportVocabulary.map((support) =>
      models.VocabularyReviewEvent.count({
        where: { userId: user.id, vocabularyId: support.vocabularyId },
      }),
    ),
  )
  assert.equal(supportEvents.every((count) => count === 0), true)
})

test('las métricas separan capítulo leído de consolidación de vocabulario', async () => {
  const { user } = await seedAdaptiveScenario()
  const metrics = await getVocabularyMetrics(user.id, NOW)

  assert.equal(metrics.readingProgress.currentChapter, 26)
  assert.equal(metrics.vocabularyCoverage.eligibleVocabulary, 30)
  assert.equal(metrics.vocabularyCoverage.counts.MASTERED, 4)
  assert.equal(metrics.vocabularyCoverage.counts.DUE, 6)
  assert.equal(metrics.vocabularyCoverage.chapterCoverage.length, 26)
  assert.ok(metrics.vocabularyCoverage.consolidationBands.length > 0)
})

test('cada habilidad actualiza solamente su score principal y siempre registra evento', async () => {
  const user = await models.User.create({ displayName: 'Scores separados' })
  const vocabulary = await models.Vocabulary.create({
    lemma: 'mīles',
    normalizedLemma: 'miles',
    meaningEs: 'soldado',
    partOfSpeech: 'NOUN',
    firstAppearanceChapter: 12,
    morphologyData: {},
  })
  await recordVocabularyReview({
    userId: user.id,
    vocabularyId: vocabulary.id,
    reviewType: 'RECOGNITION',
    result: 'CORRECT',
  })
  await recordVocabularyReview({
    userId: user.id,
    vocabularyId: vocabulary.id,
    reviewType: 'PRODUCTION',
    result: 'CORRECT',
  })
  const { progress: finalProgress } = await recordVocabularyReview({
    userId: user.id,
    vocabularyId: vocabulary.id,
    reviewType: 'MORPHOLOGY',
    result: 'CORRECT',
  })

  assert.equal(finalProgress.recognitionScore, 12)
  assert.equal(finalProgress.productionScore, 12)
  assert.equal(finalProgress.morphologyScore, 12)
  assert.equal(await models.VocabularyReviewEvent.count(), 3)
})
