import { env } from '../config/env.js'
import { requestIsAuthenticated } from '../services/authService.js'

export function requireAuthentication(request, response, next) {
  if (!env.appPassword || requestIsAuthenticated(request)) {
    next()
    return
  }

  response.status(401).json({ message: 'Inicia sesión para continuar.' })
}
