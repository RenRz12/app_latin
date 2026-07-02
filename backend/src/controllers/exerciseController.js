import {
  createManualPrompt,
  generateExercise,
  importManualExercises,
  listExercises,
} from '../services/exerciseService.js'

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

export function createExercisePrompt(request, response, next) {
  try {
    const prompt = createManualPrompt(request.body)
    response.json(prompt)
  } catch (error) {
    next(error)
  }
}

export async function importExercises(request, response, next) {
  try {
    const exercises = await importManualExercises(request.body)
    response.status(201).json({
      count: exercises.length,
      exercises,
    })
  } catch (error) {
    next(error)
  }
}
