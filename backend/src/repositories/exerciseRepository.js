import { Exercise } from '../models/Exercise.js'

export async function createExercise(exerciseData) {
  return Exercise.create(exerciseData)
}

export async function findRecentExercises(limit = 20) {
  return Exercise.findAll({
    order: [['createdAt', 'DESC']],
    limit,
  })
}
