import {
  createHmac,
  createHash,
  timingSafeEqual,
} from 'node:crypto'
import { env } from '../config/env.js'

export const AUTH_COOKIE_NAME = 'app_latin_session'

function signingSecret() {
  return `${env.sessionSecret}:${env.appPassword}`
}

function secureHash(value) {
  return createHash('sha256').update(String(value)).digest()
}

export function passwordMatches(password, expectedPassword = env.appPassword) {
  return timingSafeEqual(secureHash(password), secureHash(expectedPassword))
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSessionToken({
  now = Date.now(),
  secret = signingSecret(),
  durationDays = env.sessionDurationDays,
} = {}) {
  const issuedAt = Math.floor(now / 1000)
  const payload = Buffer.from(
    JSON.stringify({ version: 1, issuedAt, expiresAt: issuedAt + durationDays * 86400 }),
  ).toString('base64url')

  return `${payload}.${sign(payload, secret)}`
}

export function verifySessionToken(
  token,
  { now = Date.now(), secret = signingSecret() } = {},
) {
  if (typeof token !== 'string') return false
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return false

  const expectedSignature = sign(payload, secret)
  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return false
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return (
      parsed.version === 1 &&
      Number.isInteger(parsed.expiresAt) &&
      parsed.expiresAt > Math.floor(now / 1000)
    )
  } catch {
    return false
  }
}

export function readCookie(request, name = AUTH_COOKIE_NAME) {
  const cookieHeader = request.headers.cookie || ''
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=')
    if (separator === -1) continue
    const cookieName = cookie.slice(0, separator).trim()
    if (cookieName === name) return decodeURIComponent(cookie.slice(separator + 1))
  }
  return ''
}

export function requestIsAuthenticated(request) {
  if (!env.appPassword) return true
  return verifySessionToken(readCookie(request))
}

export function createSessionCookie(token) {
  const maxAge = Math.max(1, Math.round(env.sessionDurationDays * 86400))
  return [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(env.nodeEnv === 'production' || env.isRender ? ['Secure'] : []),
  ].join('; ')
}

export function clearSessionCookie() {
  return [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    ...(env.nodeEnv === 'production' || env.isRender ? ['Secure'] : []),
  ].join('; ')
}
