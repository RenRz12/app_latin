import cors from 'cors'
import { env } from './env.js'

const defaultClientOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
]

const allowedOrigins = [...new Set([...defaultClientOrigins, ...env.clientOrigins])]

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`Origen no permitido por CORS: ${origin}`))
  },
})
