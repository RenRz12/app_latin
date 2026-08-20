import { apiClient } from './apiClient.js'

export async function getAuthenticationSession() {
  const response = await apiClient.get('/auth/session')
  return response.data
}

export async function loginWithPassword(password) {
  const response = await apiClient.post('/auth/login', { password })
  return response.data
}

export async function logout() {
  await apiClient.post('/auth/logout')
}
