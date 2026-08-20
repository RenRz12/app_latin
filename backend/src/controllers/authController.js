import { env } from '../config/env.js'
import {
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  passwordMatches,
  requestIsAuthenticated,
} from '../services/authService.js'
import { AppError } from '../utils/AppError.js'

const loginAttempts = new Map()
const attemptWindowMs = 15 * 60 * 1000
const maximumAttempts = 8

function attemptKey(request) {
  return request.ip || request.socket.remoteAddress || 'unknown'
}

function activeAttempts(request, now = Date.now()) {
  const key = attemptKey(request)
  const record = loginAttempts.get(key)
  if (!record || now - record.startedAt >= attemptWindowMs) {
    const fresh = { count: 0, startedAt: now }
    loginAttempts.set(key, fresh)
    return fresh
  }
  return record
}

export function getAuthenticationSession(request, response) {
  response.json({
    authenticated: requestIsAuthenticated(request),
    authenticationRequired: Boolean(env.appPassword),
  })
}

export function login(request, response, next) {
  try {
    if (!env.appPassword) {
      response.json({ authenticated: true, authenticationRequired: false })
      return
    }

    const attempts = activeAttempts(request)
    if (attempts.count >= maximumAttempts) {
      throw new AppError(
        'Demasiados intentos. Espera unos minutos antes de volver a probar.',
        429,
      )
    }

    if (!passwordMatches(request.body?.password || '')) {
      attempts.count += 1
      throw new AppError('La contraseña no es correcta.', 401)
    }

    loginAttempts.delete(attemptKey(request))
    response.setHeader('Set-Cookie', createSessionCookie(createSessionToken()))
    response.json({ authenticated: true, authenticationRequired: true })
  } catch (error) {
    next(error)
  }
}

export function logout(_request, response) {
  response.setHeader('Set-Cookie', clearSessionCookie())
  response.status(204).send()
}
