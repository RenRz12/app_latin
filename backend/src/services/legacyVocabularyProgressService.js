import { Op } from 'sequelize'
import { sequelize } from '../database/sequelize.js'
import { Exercise } from '../models/Exercise.js'
import { PracticeSession } from '../models/PracticeSession.js'
import { Vocabulary } from '../models/Vocabulary.js'
import { VocabularyChapter } from '../models/VocabularyChapter.js'
import { VocabularyReviewEvent } from '../models/VocabularyReviewEvent.js'
import { UserVocabularyProgress } from '../models/UserVocabularyProgress.js'
import {
  getVocabularyWord,
  normalizeVocabularyWord,
  parseActivityData,
} from '../utils/vocabularyWords.js'
import { evaluateSubmittedAnswer } from './answerEvaluationService.js'
import { DEFAULT_LOCAL_USER_ID } from './localUserService.js'
import { recordVocabularyReview } from './vocabularyProgressService.js'

const FRONTEND_RESULT_MAP = {
  correct: 'CORRECT',
  almost: 'PARTIAL',
  partial: 'PARTIAL',
  incorrect: 'INCORRECT',
}

function parseChapter(value, fallback) {
  const chapter = Number(value)
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= 35
    ? chapter
    : fallback
}

function targetMeaning(exercise, exerciseType) {
  if (exerciseType === 'translation_es_la') return exercise.question
  return exercise.correctAnswer
}

function inferReviewType(exercise, fallbackExerciseType) {
  const exerciseType = exercise.exerciseType || fallbackExerciseType
  if (exerciseType === 'translation_es_la') return 'PRODUCTION'
  if (exerciseType === 'fill_blank') {
    const prompt = normalizeVocabularyWord(exercise.prompt)
    return prompt.includes('palabra latina') ? 'PRODUCTION' : 'RECOGNITION'
  }
  return 'RECOGNITION'
}

function getStoredResult(answerState, exercise) {
  const storedStatus = String(answerState?.evaluation?.status || '').toLowerCase()
  if (FRONTEND_RESULT_MAP[storedStatus]) {
    return FRONTEND_RESULT_MAP[storedStatus]
  }
  if (!answerState?.selectedAnswer?.trim()) return null
  return evaluateSubmittedAnswer(
    answerState.selectedAnswer,
    exercise.correctAnswer,
  ).result
}

function getExerciseKey(exercise, index) {
  return String(exercise.id || `vocabulary-sample-${index}`)
}

async function updateStoredExerciseTarget(exercise, vocabularyId, transaction) {
  const exerciseId = Number(exercise.id)
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) return null

  const storedExercise = await Exercise.findByPk(exerciseId, { transaction })
  if (!storedExercise) return null
  const currentIds = Array.isArray(storedExercise.targetVocabularyIds)
    ? storedExercise.targetVocabularyIds
    : []
  if (currentIds.length === 1 && Number(currentIds[0]) === vocabularyId) {
    return storedExercise
  }
  await storedExercise.update(
    { targetVocabularyIds: [vocabularyId] },
    { transaction },
  )
  return storedExercise
}

export async function resolveLegacyVocabularyTarget(
  exercise,
  {
    fallbackExerciseType,
    chapterFrom = 1,
    chapterTo = 35,
    transaction = null,
    createMissing = true,
  } = {},
) {
  const existingTargetId = Array.isArray(exercise.targetVocabularyIds)
    ? Number(exercise.targetVocabularyIds[0])
    : null
  if (Number.isInteger(existingTargetId) && existingTargetId > 0) {
    const existingTarget = await Vocabulary.findByPk(existingTargetId, {
      transaction,
    })
    if (existingTarget) return { vocabulary: existingTarget, created: false }
  }

  const word = getVocabularyWord(exercise, fallbackExerciseType)
  if (!word.normalized || word.normalized.includes(' ')) {
    return { vocabulary: null, created: false, word }
  }

  const matches = await Vocabulary.findAll({
    where: { normalizedLemma: word.normalized },
    order: [
      ['firstAppearanceChapter', 'ASC'],
      ['id', 'ASC'],
    ],
    transaction,
  })
  let vocabulary =
    matches.find((candidate) => candidate.importStatus === 'VERIFIED') ||
    matches[0] ||
    null
  let created = false
  const firstChapter = parseChapter(chapterFrom, 1)
  const lastChapter = parseChapter(chapterTo, firstChapter)
  const exerciseType = exercise.exerciseType || fallbackExerciseType
  const meaning = String(targetMeaning(exercise, exerciseType) || '').trim()

  if (!vocabulary && createMissing) {
    vocabulary = await Vocabulary.create(
      {
        lemma: word.raw,
        normalizedLemma: word.normalized,
        meaningEs: meaning || null,
        partOfSpeech: 'UNKNOWN',
        homographKey: '',
        firstAppearanceChapter: firstChapter,
        morphologyData: {
          source: 'legacy_vocabulary_practice',
          declaredChapterRange: [firstChapter, lastChapter],
        },
        importStatus: 'NEEDS_REVIEW',
        sourceReference:
          'Práctica de vocabulario — capítulo exacto pendiente de verificación',
      },
      { transaction },
    )
    await VocabularyChapter.findOrCreate({
      where: { vocabularyId: vocabulary.id, chapter: firstChapter },
      defaults: { vocabularyId: vocabulary.id, chapter: firstChapter },
      transaction,
    })
    created = true
  } else if (vocabulary && !vocabulary.meaningEs && meaning) {
    await vocabulary.update({ meaningEs: meaning }, { transaction })
  }

  if (vocabulary) {
    await updateStoredExerciseTarget(exercise, vocabulary.id, transaction)
  }
  return { vocabulary, created, word }
}

export async function attachVocabularyTargetsToExercises(
  exercises,
  {
    exerciseType,
    chapterFrom,
    chapterTo,
    transaction = null,
  } = {},
) {
  const results = []
  for (const exercise of exercises) {
    const resolution = await resolveLegacyVocabularyTarget(exercise, {
      fallbackExerciseType: exerciseType,
      chapterFrom,
      chapterTo,
      transaction,
    })
    if (!resolution.vocabulary) {
      throw Object.assign(
        new Error(
          `No se pudo vincular "${resolution.word?.raw || 'la palabra'}" con el vocabulario.`,
        ),
        { statusCode: 400 },
      )
    }
    results.push({
      exercise,
      vocabulary: resolution.vocabulary,
      created: resolution.created,
    })
  }
  return results
}

export async function syncVocabularySessionProgress(
  session,
  { transaction = null, backfilled = false } = {},
) {
  const sessionData = session.get ? session.get({ plain: true }) : session
  if (sessionData.practiceKind !== 'vocabulary') {
    return { recorded: 0, skipped: 0, unresolved: 0, createdVocabulary: 0 }
  }

  const activity = parseActivityData(sessionData.activityData)
  const exercises = Array.isArray(activity.exercises) ? activity.exercises : []
  const answerStates = activity.progress?.answerStateByExercise || {}
  const sourceKeys = exercises.map(
    (exercise, index) =>
      `legacy-practice:${sessionData.id}:exercise:${getExerciseKey(exercise, index)}`,
  )
  const existingEvents = sourceKeys.length
    ? await VocabularyReviewEvent.findAll({
        where: { sourceKey: { [Op.in]: sourceKeys } },
        attributes: ['sourceKey'],
        transaction,
        raw: true,
      })
    : []
  const existingKeys = new Set(existingEvents.map((event) => event.sourceKey))
  const summary = {
    recorded: 0,
    skipped: 0,
    unresolved: 0,
    createdVocabulary: 0,
  }
  const baseDate = new Date(sessionData.completedAt || Date.now())

  for (const [index, exercise] of exercises.entries()) {
    const exerciseKey = getExerciseKey(exercise, index)
    const sourceKey = `legacy-practice:${sessionData.id}:exercise:${exerciseKey}`
    if (existingKeys.has(sourceKey)) {
      summary.skipped += 1
      continue
    }

    const answerState = answerStates[exerciseKey]
    const result = getStoredResult(answerState, exercise)
    if (!result) {
      summary.skipped += 1
      continue
    }

    const resolution = await resolveLegacyVocabularyTarget(exercise, {
      fallbackExerciseType: activity.exerciseType,
      chapterFrom: activity.chapterFrom,
      chapterTo: activity.chapterTo,
      transaction,
    })
    if (!resolution.vocabulary) {
      summary.unresolved += 1
      continue
    }
    if (resolution.created) summary.createdVocabulary += 1

    const reviewedAt = new Date(baseDate.getTime() + index)
    const recorded = await recordVocabularyReview({
      userId: sessionData.userId || DEFAULT_LOCAL_USER_ID,
      vocabularyId: resolution.vocabulary.id,
      reviewType: inferReviewType(exercise, activity.exerciseType),
      result,
      reviewedAt,
      exerciseId: Number.isInteger(Number(exercise.id))
        ? Number(exercise.id)
        : null,
      sourceKey,
      metadata: {
        source: 'LEGACY_PRACTICE',
        practiceSessionId: sessionData.id,
        exerciseType: exercise.exerciseType || activity.exerciseType,
        selectedAnswer: answerState.selectedAnswer,
        backfilled,
      },
      transaction,
    })
    if (recorded.duplicate) summary.skipped += 1
    else summary.recorded += 1
  }

  return summary
}

export async function backfillLegacyVocabularyProgress() {
  const sessions = await PracticeSession.findAll({
    where: { practiceKind: 'vocabulary' },
    order: [
      ['completedAt', 'ASC'],
      ['id', 'ASC'],
    ],
  })
  const total = {
    sessions: sessions.length,
    recorded: 0,
    skipped: 0,
    unresolved: 0,
    createdVocabulary: 0,
    promotedFromProduction: 0,
  }

  await sequelize.transaction(async (transaction) => {
    for (const session of sessions) {
      if (!session.userId) {
        await session.update(
          { userId: DEFAULT_LOCAL_USER_ID },
          { transaction },
        )
      }
      const summary = await syncVocabularySessionProgress(session, {
        transaction,
        backfilled: true,
      })
      total.recorded += summary.recorded
      total.skipped += summary.skipped
      total.unresolved += summary.unresolved
      total.createdVocabulary += summary.createdVocabulary
    }

    const productionEvidence = await UserVocabularyProgress.findAll({
      where: {
        learningStage: 'NEW',
        correctProduction: { [Op.gt]: 0 },
      },
      transaction,
    })
    for (const progress of productionEvidence) {
      await progress.update(
        {
          learningStage:
            progress.correctProduction >= 2
              ? 'CONTEXT_RECOGNITION'
              : 'RECOGNITION',
        },
        { transaction },
      )
      total.promotedFromProduction += 1
    }
  })

  return total
}
