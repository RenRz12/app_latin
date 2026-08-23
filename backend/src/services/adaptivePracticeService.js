import { ADAPTIVE_REVIEW_CONFIG } from '../config/adaptiveReviewConfig.js'
import { sequelize } from '../database/sequelize.js'
import { Exercise } from '../models/Exercise.js'
import { PracticeSession } from '../models/PracticeSession.js'
import { User } from '../models/User.js'
import { Vocabulary } from '../models/Vocabulary.js'
import { VocabularyReviewEvent } from '../models/VocabularyReviewEvent.js'
import {
  createExercises,
  findExercisesBySession,
} from '../repositories/exerciseRepository.js'
import { AppError } from '../utils/AppError.js'
import { isPracticeReadyVocabulary } from '../utils/vocabularyEligibility.js'
import {
  evaluateOpenVocabularyAnswerWithAi,
  generateAdaptiveExercisesWithAi,
} from './aiExerciseService.js'
import { evaluateVocabularyExerciseAnswer } from './answerEvaluationService.js'
import { planExercisesForVocabulary } from './exercisePlannerService.js'
import {
  buildAdaptiveExercisePrompt,
  buildExerciseGenerationRequest,
  validateAdaptiveGeneratedExercises,
} from './exercisePromptBuilderService.js'
import { getReadingProgress } from './adaptiveVocabularyService.js'
import { DEFAULT_LOCAL_USER_ID } from './localUserService.js'
import { selectAdaptiveVocabulary } from './reviewSchedulerService.js'
import { selectSupportVocabulary } from './supportVocabularyService.js'
import { recordVocabularyReview } from './vocabularyProgressService.js'
import { getProfileSettings } from './profileSettingsService.js'

const EXERCISE_TO_REVIEW_TYPE = {
  VOCABULARY_MULTIPLE_CHOICE: 'RECOGNITION',
  CONTEXT_MEANING: 'CONTEXT',
  TRANSLATION_LA_ES: 'CONTEXT',
  TRANSLATION_ES_LA: 'PRODUCTION',
  INFLECTION_COMPLETION: 'MORPHOLOGY',
  INFLECTION_MULTIPLE_CHOICE: 'MORPHOLOGY',
  GUIDED_RECALL: 'GUIDED_RECALL',
  LEMMA_IDENTIFICATION: 'MORPHOLOGY',
  MORPHOLOGY_PRODUCTION: 'MORPHOLOGY',
  FREE_PRODUCTION: 'PRODUCTION',
}

const EXERCISE_TO_LEGACY_TYPE = {
  VOCABULARY_MULTIPLE_CHOICE: 'multiple_choice',
  CONTEXT_MEANING: 'translation_la_es',
  TRANSLATION_LA_ES: 'translation_la_es',
  TRANSLATION_ES_LA: 'translation_es_la',
  INFLECTION_COMPLETION: 'fill_blank',
  INFLECTION_MULTIPLE_CHOICE: 'multiple_choice',
  GUIDED_RECALL: 'fill_blank',
  LEMMA_IDENTIFICATION: 'fill_blank',
  MORPHOLOGY_PRODUCTION: 'fill_blank',
  FREE_PRODUCTION: 'translation_es_la',
}

function parseJson(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

function normalizeSessionSize(value) {
  const size = Number(value ?? ADAPTIVE_REVIEW_CONFIG.defaultSessionSize)
  if (
    !Number.isInteger(size) ||
    size < ADAPTIVE_REVIEW_CONFIG.minimumSessionSize ||
    size > ADAPTIVE_REVIEW_CONFIG.maximumSessionSize
  ) {
    throw new AppError(
      `La sesión debe contener entre ${ADAPTIVE_REVIEW_CONFIG.minimumSessionSize} y ${ADAPTIVE_REVIEW_CONFIG.maximumSessionSize} objetivos.`,
    )
  }
  return size
}

function normalizeSessionMode(mode = 'NORMAL') {
  const normalized = String(mode).toUpperCase()
  if (!ADAPTIVE_REVIEW_CONFIG.distributions[normalized]) {
    throw new AppError('El modo de sesión adaptativa no es válido.')
  }
  return normalized
}

function serializeExercise(exercise) {
  return {
    id: exercise.id,
    sessionId: exercise.sessionId,
    targetVocabularyIds: parseJson(exercise.targetVocabularyIds, []),
    exerciseType: exercise.adaptiveExerciseType,
    grammarTargets: parseJson(exercise.grammarTargets, []),
    prompt: exercise.prompt,
    question: exercise.question,
    options: parseJson(exercise.options, []),
    answer: exercise.correctAnswer,
    correctAnswer: exercise.correctAnswer,
    explanation: exercise.explanation,
    usedVocabulary: parseJson(exercise.usedVocabulary, []),
    source: exercise.source,
  }
}

function serializeSession(session, exercises = []) {
  return {
    id: session.id,
    userId: session.userId,
    status: session.status,
    sessionMode: session.sessionMode,
    currentBook: session.currentBook,
    currentReadingChapter: session.currentReadingChapter,
    sessionSize: session.sessionSize,
    plan: parseJson(session.planData, null),
    correctAnswers: session.correctAnswers,
    totalAnswers: session.totalAnswers,
    accuracy: session.accuracy,
    exercises: exercises.map(serializeExercise),
  }
}

async function findAdaptiveSession(sessionId, transaction = null) {
  const normalizedId = Number(sessionId)
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new AppError('La sesión adaptativa no es válida.')
  }
  const session = await PracticeSession.findByPk(normalizedId, { transaction })
  if (!session || session.sessionMode === 'LEGACY') {
    throw new AppError('No se encontró la sesión adaptativa.', 404)
  }
  return session
}

export async function createAdaptivePracticeSession({
  userId = DEFAULT_LOCAL_USER_ID,
  sessionSize,
  mode = 'NORMAL',
  now = new Date(),
} = {}) {
  const sessionNow = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(sessionNow.getTime())) throw new AppError('La fecha de la sesión no es válida.')
  const normalizedUserId = Number(userId)
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new AppError('El usuario de la sesión no es válido.')
  }
  const size = normalizeSessionSize(sessionSize)
  const sessionMode = normalizeSessionMode(mode)
  const user = await User.findByPk(normalizedUserId)
  if (!user) throw new AppError('No se encontró el usuario.', 404)
  const readingProgress = await getReadingProgress(normalizedUserId)
  const profileSettings = await getProfileSettings()
  const chapterFrom = Number(profileSettings.vocabularyChapterFrom)
  const chapterTo = Number(profileSettings.vocabularyChapterTo)
  const candidates = await selectAdaptiveVocabulary({
    userId: normalizedUserId,
    currentChapter: chapterTo,
    chapterFrom,
    chapterTo,
    sessionSize: size,
    mode: sessionMode,
    now: sessionNow,
  })
  if (!candidates.length) {
    throw new AppError('No hay vocabulario elegible para esta sesión.', 409)
  }

  const items = planExercisesForVocabulary(candidates)
  const plan = {
    version: 2,
    userId: normalizedUserId,
    createdAt: sessionNow.toISOString(),
    currentBook: readingProgress.book,
    currentReadingChapter: chapterTo,
    targetChapterFrom: chapterFrom,
    targetChapterTo: chapterTo,
    recordedReadingChapter: readingProgress.currentChapter,
    requestedSessionSize: size,
    sessionSize: items.length,
    mode: sessionMode,
    distribution: ADAPTIVE_REVIEW_CONFIG.distributions[sessionMode],
    items,
  }
  const session = await PracticeSession.create({
    practiceKind: 'vocabulary',
    practiceLabel: 'Repaso adaptativo',
    detailLabel: `${readingProgress.book} · capítulos ${chapterFrom}-${chapterTo}`,
    status: 'in_progress',
    correctAnswers: 0,
    totalAnswers: 0,
    accuracy: 0,
    activityData: { adaptive: true, planVersion: 2 },
    userId: normalizedUserId,
    sessionMode,
    currentBook: readingProgress.book,
    currentReadingChapter: chapterTo,
    sessionSize: items.length,
    planData: plan,
    completedAt: sessionNow,
  })
  return serializeSession(session)
}

export async function getAdaptivePracticeSession(sessionId) {
  const session = await findAdaptiveSession(sessionId)
  const exercises = await findExercisesBySession(session.id)
  return serializeSession(session, exercises)
}

export async function createAdaptiveSessionPrompt(sessionId) {
  const session = await findAdaptiveSession(sessionId)
  const storedPlan = parseJson(session.planData, {})
  const vocabularyIds = storedPlan.items.map((item) => Number(item.vocabularyId))
  const vocabulary = await Vocabulary.findAll({ where: { id: vocabularyIds } })
  const vocabularyById = new Map(vocabulary.map((word) => [word.id, word]))
  const refreshedItems = storedPlan.items.map((item) => {
    const word = vocabularyById.get(Number(item.vocabularyId))
    if (!isPracticeReadyVocabulary(word)) {
      throw new AppError(
        'Esta sesión contiene vocabulario pendiente de revisión. Crea una sesión nueva para continuar.',
        409,
      )
    }
    return {
      ...item,
      lemma: word.lemma,
      normalizedLemma: word.normalizedLemma,
      meaning: word.meaningEs,
      partOfSpeech: word.partOfSpeech,
      chapterOrigin: word.firstAppearanceChapter,
      morphologyReference: {
        nominative: word.nominative,
        genitive: word.genitive,
        gender: word.gender,
        declension: word.declension,
        principalParts: word.principalParts,
        conjugation: word.conjugation,
        adjectiveForms: word.adjectiveForms,
        sourceForms: word.morphologyData?.sourceForms || [],
      },
    }
  })
  const refreshedPlan = { ...storedPlan, items: refreshedItems }
  const planChanged =
    JSON.stringify(storedPlan.items) !== JSON.stringify(refreshedItems)

  if (
    !planChanged &&
    storedPlan.generationRequest &&
    storedPlan.generationPrompt
  ) {
    return {
      sessionId: session.id,
      generationRequest: storedPlan.generationRequest,
      prompt: storedPlan.generationPrompt,
      reused: true,
    }
  }

  const targetVocabularyIds = refreshedItems.map((item) => item.vocabularyId)
  const supportVocabulary = await selectSupportVocabulary({
    userId: session.userId,
    readingChapter: session.currentReadingChapter,
    targetVocabularyIds,
  })
  const generationRequest = buildExerciseGenerationRequest(
    refreshedPlan,
    supportVocabulary,
  )
  const prompt = buildAdaptiveExercisePrompt(generationRequest)
  await session.update({
    planData: {
      ...refreshedPlan,
      generationRequest,
      generationPrompt: prompt,
    },
  })
  return { sessionId: session.id, generationRequest, prompt, reused: false }
}

async function persistAdaptiveExercises(
  session,
  generationRequest,
  prompt,
  generatedPayload,
  source,
) {
  const generatedExercises = validateAdaptiveGeneratedExercises(
    generatedPayload,
    generationRequest,
  )

  return sequelize.transaction(async (transaction) => {
    const existingExercises = await findExercisesBySession(session.id, {
      transaction,
    })
    if (existingExercises.length) {
      return {
        sessionId: session.id,
        generationRequest,
        prompt,
        exercises: existingExercises.map(serializeExercise),
        reused: true,
      }
    }
    const storedPlan = parseJson(session.planData, {})
    const rows = await createExercises(
      generatedExercises.map((exercise, index) => {
        const planItem = storedPlan.items[index]
        return {
          topic: 'vocabulary',
          vocabularyLevel: 1,
          vocabularyChapterFrom: 1,
          vocabularyChapterTo: session.currentReadingChapter,
          exerciseType: EXERCISE_TO_LEGACY_TYPE[exercise.exerciseType],
          prompt: exercise.prompt.trim(),
          question: exercise.question.trim(),
          options: exercise.options,
          correctAnswer: exercise.answer.trim(),
          explanation: exercise.explanation.trim(),
          source,
          sessionId: session.id,
          targetVocabularyIds: exercise.targetVocabularyIds,
          adaptiveExerciseType: exercise.exerciseType,
          grammarTargets: exercise.grammarTargets,
          usedVocabulary: exercise.usedVocabulary,
          generationMetadata: {
            sourceBucket: planItem.sourceBucket,
            reason: planItem.reason,
            practiceMode: planItem.practiceMode,
            priorityScore: planItem.priorityScore,
            acceptableAnswers: exercise.acceptableAnswers,
            targetForm: exercise.targetForm,
            evaluationMode: generationRequest.targetVocabulary[index].evaluationMode,
            macronsRequired:
              generationRequest.requirements.macronsRequiredInAnswer,
          },
        }
      }),
      { transaction },
    )
    const enrichedPlan = {
      ...storedPlan,
      generationRequest,
      generationPrompt: prompt,
      generatedAt: new Date().toISOString(),
    }
    await session.update(
      {
        planData: enrichedPlan,
        activityData: {
          adaptive: true,
          planVersion: 2,
          exerciseIds: rows.map((row) => row.id),
        },
      },
      { transaction },
    )
    return {
      sessionId: session.id,
      generationRequest,
      prompt,
      exercises: rows.map(serializeExercise),
      reused: false,
    }
  })
}

export async function generateAdaptiveSessionExercises(sessionId) {
  const session = await findAdaptiveSession(sessionId)
  const existingExercises = await findExercisesBySession(session.id)
  const storedPlan = parseJson(session.planData, {})
  if (existingExercises.length) {
    return {
      sessionId: session.id,
      generationRequest: storedPlan.generationRequest,
      prompt: storedPlan.generationPrompt,
      exercises: existingExercises.map(serializeExercise),
      reused: true,
    }
  }
  const prepared = await createAdaptiveSessionPrompt(session.id)
  const generatedPayload = await generateAdaptiveExercisesWithAi(
    prepared.generationRequest,
    prepared.prompt,
  )
  return persistAdaptiveExercises(
    session,
    prepared.generationRequest,
    prepared.prompt,
    generatedPayload,
    generatedPayload.source,
  )
}

export async function importAdaptiveSessionExercises(sessionId, payload) {
  const session = await findAdaptiveSession(sessionId)
  const prepared = await createAdaptiveSessionPrompt(session.id)
  return persistAdaptiveExercises(
    session,
    prepared.generationRequest,
    prepared.prompt,
    payload,
    'manual_chatgpt',
  )
}

export async function submitAdaptiveExerciseAnswer({
  exerciseId,
  userId = DEFAULT_LOCAL_USER_ID,
  answer,
  responseTimeMs = null,
  answeredAt = new Date(),
}) {
  if (!String(answer || '').trim())
    throw new AppError('La respuesta no puede estar vacía.')
  const answerDate = answeredAt instanceof Date ? answeredAt : new Date(answeredAt)
  if (Number.isNaN(answerDate.getTime())) {
    throw new AppError('La fecha de respuesta no es válida.')
  }
  const normalizedUserId = Number(userId)
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new AppError('El usuario de la respuesta no es válido.')
  }
  const normalizedResponseTime =
    responseTimeMs == null ? null : Number(responseTimeMs)
  if (
    normalizedResponseTime != null &&
    (!Number.isInteger(normalizedResponseTime) || normalizedResponseTime < 0)
  ) {
    throw new AppError('El tiempo de respuesta no es válido.')
  }

  return sequelize.transaction(async (transaction) => {
    const exercise = await Exercise.findByPk(Number(exerciseId), {
      transaction,
    })
    if (!exercise || !exercise.sessionId || !exercise.adaptiveExerciseType) {
      throw new AppError('No se encontró el ejercicio adaptativo.', 404)
    }
    const session = await findAdaptiveSession(exercise.sessionId, transaction)
    if (Number(session.userId) !== normalizedUserId) {
      throw new AppError('El ejercicio no pertenece al usuario indicado.', 403)
    }
    const generationMetadata = parseJson(exercise.generationMetadata, {})
    const grammarTargets = parseJson(exercise.grammarTargets, [])
    const finalEvaluation = await evaluateVocabularyExerciseAnswer(
      {
        userAnswer: answer,
        expectedAnswer: exercise.correctAnswer,
        acceptableAnswers: generationMetadata.acceptableAnswers || [],
        exerciseType: exercise.adaptiveExerciseType,
        question: exercise.question,
        grammarTargets,
        targetForm: generationMetadata.targetForm,
        macronsRequired: Boolean(generationMetadata.macronsRequired),
      },
      { semanticEvaluator: evaluateOpenVocabularyAnswerWithAi },
    )
    const targetVocabularyIds = parseJson(exercise.targetVocabularyIds, [])
    if (!targetVocabularyIds.length) {
      throw new AppError(
        'El ejercicio no conserva su vocabulario objetivo.',
        500,
      )
    }
    const existingEvent = await VocabularyReviewEvent.findOne({
      where: { userId: normalizedUserId, exerciseId: exercise.id },
      transaction,
    })
    if (existingEvent)
      throw new AppError('Este ejercicio ya fue respondido.', 409)

    const reviewType = EXERCISE_TO_REVIEW_TYPE[exercise.adaptiveExerciseType]
    const progressUpdates = []
    for (const vocabularyId of targetVocabularyIds) {
      progressUpdates.push(
        await recordVocabularyReview({
          userId: normalizedUserId,
          vocabularyId: Number(vocabularyId),
          reviewType,
          result: finalEvaluation.result,
          responseTimeMs: normalizedResponseTime,
          reviewedAt: answerDate,
          exerciseId: exercise.id,
          exerciseType: exercise.adaptiveExerciseType,
          errorTypes: finalEvaluation.errorTypes,
          morphologyEvaluated:
            grammarTargets.some((target) =>
              ['nominative', 'accusative', 'genitive', 'dative', 'ablative',
                'singular', 'plural', 'agreement', 'nominal_morphology',
                'first_person', 'second_person', 'third_person',
                'present_active'].includes(target),
            ) ||
            ['INFLECTION_COMPLETION', 'INFLECTION_MULTIPLE_CHOICE',
              'GUIDED_RECALL', 'LEMMA_IDENTIFICATION',
              'MORPHOLOGY_PRODUCTION', 'FREE_PRODUCTION'].includes(
              exercise.adaptiveExerciseType,
            ),
          screeningMode:
            generationMetadata.practiceMode === 'BACKLOG_SCREENING',
          metadata: {
            sessionId: session.id,
            sourceBucket: generationMetadata.sourceBucket,
            reason: generationMetadata.reason,
            adaptiveExerciseType: exercise.adaptiveExerciseType,
            grammarTargets,
            responseTimeMs: normalizedResponseTime,
          },
          transaction,
        }),
      )
    }

    const totalAnswers = session.totalAnswers + 1
    const correctAnswers =
      session.correctAnswers + (finalEvaluation.result === 'CORRECT' ? 1 : 0)
    const exerciseCount = await Exercise.count({
      where: { sessionId: session.id },
      transaction,
    })
    await session.update(
      {
        totalAnswers,
        correctAnswers,
        accuracy: Math.round((correctAnswers / totalAnswers) * 10000) / 100,
        status: totalAnswers >= exerciseCount ? 'completed' : 'in_progress',
        completedAt: answerDate,
      },
      { transaction },
    )

    return {
      exerciseId: exercise.id,
      evaluation: finalEvaluation,
      progress: progressUpdates.map(({ progress, event }) => ({
        vocabularyId: progress.vocabularyId,
        learningStage: progress.learningStage,
        recognitionScore: progress.recognitionScore,
        productionScore: progress.productionScore,
        morphologyScore: progress.morphologyScore,
        lapseCount: progress.lapseCount,
        nextReviewAt: progress.nextReviewAt,
        reviewEventId: event.id,
      })),
      session: {
        id: session.id,
        status: session.status,
        correctAnswers: session.correctAnswers,
        totalAnswers: session.totalAnswers,
        accuracy: session.accuracy,
      },
    }
  })
}
