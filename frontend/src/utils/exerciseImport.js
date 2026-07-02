export function readExercisesFromPastedJson(text) {
  const parsed = JSON.parse(text)

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (Array.isArray(parsed.exercises)) {
    return parsed.exercises
  }

  throw new Error('El JSON debe ser un array o un objeto con la propiedad exercises.')
}

export function inferExerciseTypeFromExercises(exercises, fallbackType) {
  if (exercises.some((exercise) => Array.isArray(exercise.options) && exercise.options.length > 0)) {
    return 'multiple_choice'
  }

  if (exercises.some((exercise) => exercise.question?.includes('____'))) {
    return 'fill_blank'
  }

  return fallbackType || 'translation'
}
