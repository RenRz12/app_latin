import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const authenticationRequiredEvent = 'app-latin:authentication-required'

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthenticationRequest = error.config?.url?.startsWith('/auth/')
    if (
      error.response?.status === 401 &&
      !isAuthenticationRequest &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new Event(authenticationRequiredEvent))
    }
    return Promise.reject(error)
  },
)

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
