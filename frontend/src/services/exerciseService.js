import { apiClient } from './apiClient.js'

export async function generateExercise(payload) {
  const response = await apiClient.post('/exercises/generate', payload)
  return response.data
}

export async function createExercisePrompt(payload) {
  const response = await apiClient.post('/exercises/prompt', payload)
  return response.data
}

export async function importExercises(payload) {
  const response = await apiClient.post('/exercises/import', payload)
  return response.data
}

export async function getExercises() {
  const response = await apiClient.get('/exercises')
  return response.data
}
