export function normalizeVocabularyWord(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es-AR')
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function getVocabularyWord(exercise, fallbackExerciseType) {
  const exerciseType = exercise?.exerciseType || fallbackExerciseType
  const normalizedPrompt = normalizeVocabularyWord(exercise?.prompt)
  const asksForLatinWord =
    exerciseType === 'translation_es_la' ||
    (exerciseType === 'fill_blank' && normalizedPrompt.includes('palabra latina'))
  const rawWord = asksForLatinWord
    ? exercise?.correctAnswer
    : String(exercise?.question || '').replace(/\s+significa\b.*$/iu, '')

  return {
    raw: String(rawWord || '').trim(),
    normalized: normalizeVocabularyWord(rawWord),
  }
}

export function parseActivityData(activityData) {
  if (typeof activityData !== 'string') return activityData || {}

  try {
    return JSON.parse(activityData)
  } catch {
    return {}
  }
}
