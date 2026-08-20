import { sequelize } from '../database/sequelize.js'
import { PracticeSession } from '../models/PracticeSession.js'
import { AppError } from '../utils/AppError.js'
import { getVocabularyWord, parseActivityData } from '../utils/vocabularyWords.js'
import {
  backfillLegacyVocabularyProgress,
  syncVocabularySessionProgress,
} from './legacyVocabularyProgressService.js'
import { DEFAULT_LOCAL_USER_ID } from './localUserService.js'

const allowedPracticeKinds = new Set([
  'verb_tense',
  'declension',
  'vocabulary',
  'combined',
])
const allowedStatuses = new Set(['in_progress', 'completed'])

export async function listPracticeSessions() {
  return PracticeSession.findAll({
    order: [['completedAt', 'DESC']],
  })
}

export async function deletePracticeSession(sessionId) {
  const normalizedId = Number(sessionId)

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new AppError('La practica seleccionada no es valida.')
  }

  const session = await PracticeSession.findByPk(normalizedId)

  if (!session) {
    throw new AppError('La practica ya no existe.', 404)
  }

  await session.destroy()
}

export async function listPracticedVocabularyWords() {
  const sessions = await PracticeSession.findAll({
    attributes: ['activityData'],
    where: { practiceKind: 'vocabulary' },
    raw: true,
  })
  const words = new Set()

  sessions.forEach((session) => {
    const activity = parseActivityData(session.activityData)
    const exercises = Array.isArray(activity.exercises) ? activity.exercises : []

    exercises.forEach((exercise) => {
      const word = getVocabularyWord(exercise, activity.exerciseType)
      if (word.normalized) words.add(word.normalized)
    })
  })

  return [...words]
}

export { backfillLegacyVocabularyProgress }

export async function savePracticeSession(payload, sessionId = null) {
  const {
    practiceKind,
    practiceLabel,
    detailLabel,
    correctAnswers,
    totalAnswers,
    activityData,
    status = 'completed',
  } = payload

  if (!allowedPracticeKinds.has(practiceKind)) {
    throw new AppError('El tipo de practica no es valido.')
  }

  if (!practiceLabel?.trim() || !detailLabel?.trim()) {
    throw new AppError('La practica necesita un titulo y un detalle.')
  }

  if (!allowedStatuses.has(status)) {
    throw new AppError('El estado de la practica no es valido.')
  }

  if (
    !Number.isInteger(correctAnswers) ||
    !Number.isInteger(totalAnswers) ||
    correctAnswers < 0 ||
    totalAnswers < 0 ||
    correctAnswers > totalAnswers
  ) {
    throw new AppError('Los resultados de la practica no son validos.')
  }

  if (status === 'completed' && totalAnswers === 0) {
    throw new AppError('Una practica terminada debe incluir respuestas.')
  }

  if (!activityData || typeof activityData !== 'object' || Array.isArray(activityData)) {
    throw new AppError('No se recibieron los datos necesarios para repetir la practica.')
  }

  const accuracy = totalAnswers > 0
    ? Math.round((correctAnswers / totalAnswers) * 10000) / 100
    : 0
  const values = {
    practiceKind,
    practiceLabel: practiceLabel.trim(),
    detailLabel: detailLabel.trim(),
    status,
    correctAnswers,
    totalAnswers,
    accuracy,
    activityData,
    userId: DEFAULT_LOCAL_USER_ID,
    completedAt: new Date(),
  }

  return sequelize.transaction(async (transaction) => {
    let session
    if (sessionId === null) {
      session = await PracticeSession.create(values, { transaction })
    } else {
      const normalizedId = Number(sessionId)

      if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
        throw new AppError('La practica seleccionada no es valida.')
      }

      session = await PracticeSession.findByPk(normalizedId, { transaction })

      if (!session) {
        throw new AppError('La practica ya no existe.', 404)
      }

      await session.update(values, { transaction })
    }

    await syncVocabularySessionProgress(session, { transaction })
    return session
  })
}
