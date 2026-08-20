import { Router } from 'express'
import {
  getAuthenticationSession,
  login,
  logout,
} from '../controllers/authController.js'

export const authRoutes = Router()

authRoutes.get('/session', getAuthenticationSession)
authRoutes.post('/login', login)
authRoutes.post('/logout', logout)
