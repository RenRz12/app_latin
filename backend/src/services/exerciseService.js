import {
  allowedExerciseTypes,
  allowedTopics,
  allowedVocabularyLevels,
  mockExercisesByTopic,
  vocabularyByLevel,
} from '../data/exerciseCatalog.js'
import {
  createExercise,
  findRecentExercises,
} from '../repositories/exerciseRepository.js'
import { AppError } from '../utils/AppError.js'

function validateExerciseRequest({ topic, vocabularyLevel, exerciseType }) {
  if (!allowedTopics.includes(topic)) {
    throw new AppError('El tema solicitado no existe.', 400)
  }

  if (!allowedVocabularyLevels.includes(Number(vocabularyLevel))) {
    throw new AppError('El nivel de vocabulario debe estar entre 1 y 4.', 400)
  }

  if (!allowedExerciseTypes.includes(exerciseType)) {
    throw new AppError('El tipo de ejercicio solicitado no existe.', 400)
  }
}

export async function generateExercise(params) {
  const normalizedParams = {
    topic: params.topic,
    vocabularyLevel: Number(params.vocabularyLevel),
    exerciseType: params.exerciseType,
  }

  validateExerciseRequest(normalizedParams)

  const baseExercise = mockExercisesByTopic[normalizedParams.topic]
  const exercise = await createExercise({
    ...normalizedParams,
    ...baseExercise,
    source: 'mock',
  })

  return {
    id: exercise.id,
    topic: exercise.topic,
    vocabularyLevel: exercise.vocabularyLevel,
    exerciseType: exercise.exerciseType,
    vocabulary: vocabularyByLevel[exercise.vocabularyLevel],
    prompt: exercise.prompt,
    question: exercise.question,
    options: exercise.options,
    correctAnswer: exercise.correctAnswer,
    explanation: exercise.explanation,
    source: exercise.source,
  }
}

export async function listExercises() {
  return findRecentExercises()
}
