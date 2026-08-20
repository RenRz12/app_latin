import { sequelize } from '../database/sequelize.js'
import { ADAPTIVE_REVIEW_CONFIG } from '../config/adaptiveReviewConfig.js'
import { User } from '../models/User.js'
import {
  LEARNING_STAGES,
  UserVocabularyProgress,
} from '../models/UserVocabularyProgress.js'
import { Vocabulary } from '../models/Vocabulary.js'
import {
  REVIEW_RESULTS,
  REVIEW_TYPES,
  VocabularyReviewEvent,
} from '../models/VocabularyReviewEvent.js'
import { DEFAULT_LOCAL_USER_ID } from './localUserService.js'
import { applyVocabularyExerciseResult } from './vocabularyExercisePolicyService.js'

const SCORE_DELTAS = ADAPTIVE_REVIEW_CONFIG.scheduling.scoreDeltas
const MINIMUM_INTERVAL_BY_STAGE =
  ADAPTIVE_REVIEW_CONFIG.scheduling.minimumIntervalByStage

const RECOGNITION_TYPES = new Set(['RECOGNITION', 'CONTEXT'])
const RECALL_TYPES = new Set(['GUIDED_RECALL', 'PRODUCTION'])

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function stageIndex(stage) {
  return Math.max(0, LEARNING_STAGES.indexOf(stage))
}

function highestQualifiedStage(progress) {
  const thresholds = ADAPTIVE_REVIEW_CONFIG.stageThresholds
  const morphologyAttempts =
    Number(progress.correctMorphology || 0) +
    Number(progress.failedMorphology || 0)
  const morphologyReady =
    morphologyAttempts === 0 ||
    Number(progress.morphologyScore || 0) >= thresholds.mastered.morphologyScore
  const elapsedLearningTime =
    progress.firstSeenAt && progress.lastCorrectAt
      ? new Date(progress.lastCorrectAt).getTime() -
        new Date(progress.firstSeenAt).getTime()
      : 0
  const hasSpacedPractice =
    elapsedLearningTime >=
    thresholds.mastered.minimumLearningDays * 24 * 60 * 60 * 1000

  if (
    progress.recognitionScore >= thresholds.mastered.recognitionScore &&
    progress.productionScore >= thresholds.mastered.productionScore &&
    morphologyReady &&
    progress.successfulRecall >= thresholds.mastered.recallSuccesses &&
    progress.correctProduction >= thresholds.mastered.productionSuccesses &&
    progress.longestStreak >= thresholds.mastered.streak &&
    hasSpacedPractice
  ) {
    return 'MASTERED'
  }
  if (
    progress.productionScore >= thresholds.production.score &&
    progress.successfulRecall >= thresholds.production.recallSuccesses &&
    progress.correctProduction >= thresholds.production.productionSuccesses
  ) {
    return 'PRODUCTION'
  }
  if (
    progress.recognitionScore >= thresholds.guidedRecall.recognitionScore &&
    progress.successfulRecall >= thresholds.guidedRecall.recallSuccesses
  ) {
    return 'GUIDED_RECALL'
  }
  if (
    progress.correctProduction >= 1 ||
    progress.successfulRecall >= thresholds.guidedRecall.recallSuccesses
  ) {
    return 'GUIDED_RECALL'
  }
  if (progress.successfulRecall >= 1) {
    return 'CONTEXT_RECOGNITION'
  }
  if (
    progress.recognitionScore >= thresholds.contextRecognition.score &&
    progress.successfulRecognition >= thresholds.contextRecognition.successes
  ) {
    return 'CONTEXT_RECOGNITION'
  }
  if (
    progress.recognitionScore >= thresholds.recognition.score ||
    progress.successfulRecognition >= thresholds.recognition.successes
  ) {
    return 'RECOGNITION'
  }
  return 'NEW'
}

export function evaluateLearningStage(
  progress,
  { previousStage = progress.learningStage || 'NEW', result = 'CORRECT' } = {},
) {
  const previousIndex = stageIndex(previousStage)

  if (result === 'INCORRECT') {
    const errorsBeforeDemotion =
      ADAPTIVE_REVIEW_CONFIG.stageThresholds.errorsBeforeDemotion
    const shouldDemote =
      progress.consecutiveIncorrect >= errorsBeforeDemotion &&
      progress.consecutiveIncorrect % errorsBeforeDemotion === 0
    return shouldDemote
      ? LEARNING_STAGES[Math.max(0, previousIndex - 1)]
      : previousStage
  }

  if (result !== 'CORRECT') {
    return previousStage
  }

  const qualifiedIndex = stageIndex(highestQualifiedStage(progress))
  return LEARNING_STAGES[
    Math.max(previousIndex, Math.min(qualifiedIndex, previousIndex + 1))
  ]
}

function calculateScheduling(previous, result, resultingStage) {
  const scheduling = ADAPTIVE_REVIEW_CONFIG.scheduling
  const previousInterval = Number(previous.reviewIntervalDays || 1)
  const previousEase = Number(previous.easeFactor || 2.3)
  let easeFactor = previousEase
  let interval

  if (result === 'CORRECT') {
    easeFactor = clamp(
      previousEase + scheduling.correctEaseDelta,
      scheduling.minimumEase,
      scheduling.maximumEase,
    )
    interval = Math.max(
      MINIMUM_INTERVAL_BY_STAGE[resultingStage],
      previous.timesReviewed === 0 ? 1 : previousInterval * easeFactor,
    )
  } else if (result === 'PARTIAL') {
    easeFactor = clamp(
      previousEase + scheduling.partialEaseDelta,
      scheduling.minimumEase,
      scheduling.maximumEase,
    )
    interval = Math.max(
      1,
      previousInterval * scheduling.partialIntervalMultiplier,
    )
  } else {
    easeFactor = clamp(
      previousEase + scheduling.incorrectEaseDelta,
      scheduling.minimumEase,
      scheduling.maximumEase,
    )
    interval = Math.max(
      1,
      previousInterval * scheduling.incorrectIntervalMultiplier,
    )
  }

  return {
    easeFactor: Number(easeFactor.toFixed(2)),
    reviewIntervalDays: Number(interval.toFixed(2)),
  }
}

export function calculateVocabularyProgressUpdate(
  currentProgress,
  review,
  now = new Date(),
) {
  if (!REVIEW_TYPES.includes(review.reviewType)) {
    throw Object.assign(new Error('El tipo de repaso no es válido.'), {
      statusCode: 400,
    })
  }
  if (!REVIEW_RESULTS.includes(review.result)) {
    throw Object.assign(new Error('El resultado del repaso no es válido.'), {
      statusCode: 400,
    })
  }

  const previous = currentProgress.get
    ? currentProgress.get({ plain: true })
    : { ...currentProgress }
  const update = { ...previous }
  const delta = SCORE_DELTAS[review.result]
  const scoreAdjustments = review.scoreAdjustments || null
  const isCorrect = review.result === 'CORRECT'
  const isIncorrect = review.result === 'INCORRECT'

  update.timesSeen = (previous.timesSeen || 0) + 1
  update.timesReviewed = (previous.timesReviewed || 0) + 1
  update.firstSeenAt = previous.firstSeenAt || now
  update.lastSeenAt = now
  update.lastReviewedAt = now
  update.currentStreak = isCorrect ? (previous.currentStreak || 0) + 1 : 0
  update.longestStreak = Math.max(
    previous.longestStreak || 0,
    update.currentStreak,
  )
  update.lapseCount = (previous.lapseCount || 0) + (isIncorrect ? 1 : 0)
  update.consecutiveIncorrect = isIncorrect
    ? (previous.consecutiveIncorrect || 0) + 1
    : 0

  if (isCorrect) update.lastCorrectAt = now
  if (isIncorrect) update.lastIncorrectAt = now
  if (isCorrect && RECALL_TYPES.has(review.reviewType))
    update.lastSuccessfulRecallAt = now

  if (scoreAdjustments) {
    for (const field of [
      'recognitionScore',
      'productionScore',
      'morphologyScore',
    ]) {
      if (scoreAdjustments[field] == null) continue
      update[field] = clamp(
        Number(previous[field] || 0) + Number(scoreAdjustments[field]),
        0,
        100,
      )
    }
  }

  if (RECOGNITION_TYPES.has(review.reviewType)) {
    if (!scoreAdjustments) {
    update.recognitionScore = clamp(
      (previous.recognitionScore || 0) + delta,
      0,
      100,
    )
    }
    update.successfulRecognition =
      (previous.successfulRecognition || 0) + (isCorrect ? 1 : 0)
    update.failedRecognition =
      (previous.failedRecognition || 0) + (isIncorrect ? 1 : 0)
  } else if (RECALL_TYPES.has(review.reviewType)) {
    if (!scoreAdjustments) {
    update.productionScore = clamp(
      (previous.productionScore || 0) + delta,
      0,
      100,
    )
    }
    update.successfulRecall =
      (previous.successfulRecall || 0) + (isCorrect ? 1 : 0)
    update.failedRecall = (previous.failedRecall || 0) + (isIncorrect ? 1 : 0)
    if (review.reviewType === 'PRODUCTION') {
      update.correctProduction =
        (previous.correctProduction || 0) + (isCorrect ? 1 : 0)
      update.failedProduction =
        (previous.failedProduction || 0) + (isIncorrect ? 1 : 0)
    }
  } else {
    if (!scoreAdjustments) {
    update.morphologyScore = clamp(
      (previous.morphologyScore || 0) + delta,
      0,
      100,
    )
    }
    update.correctMorphology =
      (previous.correctMorphology || 0) + (isCorrect ? 1 : 0)
    update.failedMorphology =
      (previous.failedMorphology || 0) + (isIncorrect ? 1 : 0)
  }

  update.learningStage = evaluateLearningStage(update, {
    previousStage: previous.learningStage || 'NEW',
    result: review.result,
  })
  if (
    review.screeningMode &&
    review.result === 'CORRECT' &&
    update.successfulRecognition >= 2 &&
    stageIndex(update.learningStage) < stageIndex('CONTEXT_RECOGNITION')
  ) {
    update.recognitionScore = Math.max(update.recognitionScore, 55)
    update.learningStage = 'CONTEXT_RECOGNITION'
  }
  Object.assign(
    update,
    calculateScheduling(previous, review.result, update.learningStage),
  )
  update.nextReviewAt = new Date(
    now.getTime() + update.reviewIntervalDays * 24 * 60 * 60 * 1000,
  )

  const mutableFields = [
    'learningStage',
    'recognitionScore',
    'productionScore',
    'morphologyScore',
    'timesSeen',
    'timesReviewed',
    'successfulRecognition',
    'failedRecognition',
    'successfulRecall',
    'failedRecall',
    'correctProduction',
    'failedProduction',
    'correctMorphology',
    'failedMorphology',
    'currentStreak',
    'longestStreak',
    'lapseCount',
    'consecutiveIncorrect',
    'reviewIntervalDays',
    'easeFactor',
    'firstSeenAt',
    'lastSeenAt',
    'lastReviewedAt',
    'lastSuccessfulRecallAt',
    'lastCorrectAt',
    'lastIncorrectAt',
    'nextReviewAt',
  ]

  return Object.fromEntries(
    mutableFields.map((field) => [field, update[field]]),
  )
}

export async function recordVocabularyReview({
  userId = DEFAULT_LOCAL_USER_ID,
  vocabularyId,
  reviewType,
  result,
  responseTimeMs = null,
  reviewedAt = new Date(),
  exerciseId = null,
  sourceKey = null,
  metadata = null,
  screeningMode = false,
  exerciseType = null,
  errorTypes = [],
  morphologyEvaluated = true,
  transaction = null,
}) {
  const reviewDate =
    reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt)
  if (Number.isNaN(reviewDate.getTime())) {
    throw Object.assign(new Error('La fecha del repaso no es válida.'), {
      statusCode: 400,
    })
  }

  const saveReview = async (activeTransaction) => {
    if (sourceKey) {
      const existingEvent = await VocabularyReviewEvent.findOne({
        where: { sourceKey },
        transaction: activeTransaction,
      })
      if (existingEvent) {
        const progress = await UserVocabularyProgress.findOne({
          where: {
            userId: existingEvent.userId,
            vocabularyId: existingEvent.vocabularyId,
          },
          transaction: activeTransaction,
        })
        return { progress, event: existingEvent, duplicate: true }
      }
    }

    const [user, vocabulary] = await Promise.all([
      User.findByPk(userId, { transaction: activeTransaction }),
      Vocabulary.findByPk(vocabularyId, { transaction: activeTransaction }),
    ])

    if (!user)
      throw Object.assign(new Error('No se encontró el usuario.'), {
        statusCode: 404,
      })
    if (!vocabulary) {
      throw Object.assign(new Error('No se encontró la palabra.'), {
        statusCode: 404,
      })
    }

    const [progress] = await UserVocabularyProgress.findOrCreate({
      where: { userId, vocabularyId },
      defaults: { userId, vocabularyId },
      transaction: activeTransaction,
    })
    const previousStage = progress.learningStage
    const previousScores = {
      recognitionScore: Number(progress.recognitionScore || 0),
      productionScore: Number(progress.productionScore || 0),
      morphologyScore: Number(progress.morphologyScore || 0),
    }
    const evidence = exerciseType
      ? applyVocabularyExerciseResult(progress, exerciseType, result, {
          errorTypes,
          morphologyEvaluated,
        })
      : null
    const update = calculateVocabularyProgressUpdate(
      progress,
      {
        reviewType,
        result,
        screeningMode,
        scoreAdjustments: evidence?.scoreAdjustments,
      },
      reviewDate,
    )

    await progress.update(update, { transaction: activeTransaction })
    const event = await VocabularyReviewEvent.create(
      {
        userId,
        vocabularyId,
        reviewType,
        result,
        previousStage,
        resultingStage: update.learningStage,
        responseTimeMs,
        exerciseId,
        sourceKey,
        metadata: {
          ...(metadata || {}),
          screeningMode,
          exerciseType,
          evaluatedSkill: evidence?.evaluatedSkill || reviewType,
          evaluatedSkills: evidence?.evaluatedSkills || [reviewType],
          evidenceWeight: evidence?.evidenceWeight || 1,
          errorTypes,
          previousScores,
          resultingScores: {
            recognitionScore: Number(update.recognitionScore || 0),
            productionScore: Number(update.productionScore || 0),
            morphologyScore: Number(update.morphologyScore || 0),
          },
          scoreAdjustments: evidence?.scoreAdjustments || {
            [RECOGNITION_TYPES.has(reviewType)
              ? 'recognitionScore'
              : RECALL_TYPES.has(reviewType)
                ? 'productionScore'
                : 'morphologyScore']: SCORE_DELTAS[result],
          },
        },
        reviewedAt: reviewDate,
      },
      { transaction: activeTransaction },
    )

    return { progress, event }
  }

  return transaction
    ? saveReview(transaction)
    : sequelize.transaction(saveReview)
}
