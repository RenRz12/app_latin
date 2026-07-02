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
