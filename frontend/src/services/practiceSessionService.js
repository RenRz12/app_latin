import { apiClient } from './apiClient.js'

export async function getPracticeSessions() {
  const response = await apiClient.get('/practice-sessions')
  return response.data
}

export async function createPracticeSession(payload) {
  const response = await apiClient.post('/practice-sessions', payload)
  return response.data
}

export async function updatePracticeSession(sessionId, payload) {
  const response = await apiClient.put(`/practice-sessions/${sessionId}`, payload)
  return response.data
}

export async function deletePracticeSession(sessionId) {
  await apiClient.delete(`/practice-sessions/${sessionId}`)
}
