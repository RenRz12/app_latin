import { apiClient } from './apiClient.js'

export async function getProfileSettings() {
  const response = await apiClient.get('/profile-settings')
  return response.data
}

export async function updateProfileSettings(payload) {
  const response = await apiClient.put('/profile-settings', payload)
  return response.data
}

export async function getVocabularyMetrics(chapterFrom, chapterTo, userId = 1) {
  const response = await apiClient.get('/vocabulary/metrics', {
    params: { userId, chapterFrom, chapterTo },
  })
  return response.data
}
