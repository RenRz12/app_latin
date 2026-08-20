import { Exercise } from '../models/Exercise.js'

export async function createExercise(exerciseData, options = {}) {
  return Exercise.create(exerciseData, { transaction: options.transaction })
}

export async function createExercises(exercisesData, options = {}) {
  return Exercise.bulkCreate(exercisesData, {
    returning: true,
    transaction: options.transaction,
  })
}

export async function findExercisesBySession(sessionId, options = {}) {
  return Exercise.findAll({
    where: { sessionId },
    order: [['id', 'ASC']],
    transaction: options.transaction,
  })
}

export async function findRecentExercises(limit = 20) {
  return Exercise.findAll({
    order: [['createdAt', 'DESC']],
    limit,
  })
}
