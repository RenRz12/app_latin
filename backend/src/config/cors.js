import cors from 'cors'
import { env } from './env.js'

const defaultClientOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
]

const allowedOrigins = [...new Set([...defaultClientOrigins, ...env.clientOrigins])]

const reflectAllowedOrigin = cors({
  credentials: true,
  origin: true,
})

function normalizedOrigin(value) {
  if (!value) return ''

  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

export function originIsAllowed(origin, ownOrigin = '') {
  if (!origin) return true

  const normalizedRequestOrigin = normalizedOrigin(origin)
  if (!normalizedRequestOrigin) return false

  return (
    allowedOrigins.some(
      (allowedOrigin) => normalizedOrigin(allowedOrigin) === normalizedRequestOrigin,
    ) ||
    (ownOrigin && normalizedOrigin(ownOrigin) === normalizedRequestOrigin)
  )
}

export function corsMiddleware(request, response, next) {
  const origin = request.get('origin') || ''
  const ownOrigin = `${request.protocol}://${request.get('host')}`

  if (!originIsAllowed(origin, ownOrigin)) {
    next(new Error(`Origen no permitido por CORS: ${origin}`))
    return
  }

  reflectAllowedOrigin(request, response, next)
}
