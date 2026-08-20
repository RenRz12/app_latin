import dotenv from 'dotenv'

dotenv.config()

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isRender: process.env.RENDER === 'true',
  port: Number(process.env.PORT) || 3001,
  clientOrigins: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
    : [],
  databaseStorage: process.env.DATABASE_STORAGE || './data/app-latin.sqlite',
  aiProvider: process.env.AI_PROVIDER || 'mock',
  aiModel: process.env.AI_MODEL || 'gpt-5.5',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  aiFallbackToMock: process.env.AI_FALLBACK_TO_MOCK !== 'false',
  appPassword: process.env.APP_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionDurationDays: Number(process.env.SESSION_DURATION_DAYS) || 30,
}

export function validateRuntimeEnvironment() {
  if (!env.appPassword && !env.isRender) return

  if (env.appPassword.length < 10) {
    throw new Error(
      'APP_PASSWORD debe tener al menos 10 caracteres para ejecutar la aplicación en Render.',
    )
  }
  if (env.sessionSecret.length < 32) {
    throw new Error(
      'SESSION_SECRET debe tener al menos 32 caracteres para ejecutar la aplicación en Render.',
    )
  }
  if (!Number.isFinite(env.sessionDurationDays) || env.sessionDurationDays <= 0) {
    throw new Error('SESSION_DURATION_DAYS debe ser un número mayor que cero.')
  }
}
