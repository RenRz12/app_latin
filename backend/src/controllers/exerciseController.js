import { generateExercise, listExercises } from '../services/exerciseService.js'

export async function createExercise(request, response, next) {
  try {
    const exercise = await generateExercise(request.body)
    response.status(201).json(exercise)
  } catch (error) {
    next(error)
  }
}

export async function getExercises(_request, response, next) {
  try {
    const exercises = await listExercises()
    response.json(exercises)
  } catch (error) {
    next(error)
  }
}
