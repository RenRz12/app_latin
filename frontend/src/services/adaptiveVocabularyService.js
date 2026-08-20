import { apiClient } from './apiClient.js'

export async function createAdaptiveVocabularySession(sessionSize = 20) {
  const response = await apiClient.post('/practice-sessions/adaptive', {
    sessionSize,
    mode: 'NORMAL',
  })
  return response.data
}

export async function getAdaptiveVocabularySession(sessionId) {
  const response = await apiClient.get(`/practice-sessions/adaptive/${sessionId}`)
  return response.data
}

export async function generateAdaptiveVocabularyExercises(sessionId) {
  const response = await apiClient.post(
    `/practice-sessions/adaptive/${sessionId}/generate`,
  )
  return response.data
}

export async function createAdaptiveVocabularyPrompt(sessionId) {
  const response = await apiClient.post(
    `/practice-sessions/adaptive/${sessionId}/prompt`,
  )
  return response.data
}

export async function importAdaptiveVocabularyExercises(sessionId, payload) {
  const response = await apiClient.post(
    `/practice-sessions/adaptive/${sessionId}/import`,
    payload,
  )
  return response.data
}

export async function answerAdaptiveVocabularyExercise(exerciseId, answer, responseTimeMs) {
  const response = await apiClient.post(
    `/practice-sessions/adaptive/exercises/${exerciseId}/answer`,
    { answer, responseTimeMs },
  )
  return response.data
}
