import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export function getApiErrorMessage(error) {
  if (error.message === 'Network Error') {
    return 'No se pudo conectar con el backend. Revisa que este prendido y que CORS permita el origen del frontend.'
  }

  return (
    error.response?.data?.message ||
    error.message ||
    'No se pudo completar la operacion.'
  )
}
