import dotenv from 'dotenv'

dotenv.config()

export const env = {
  port: Number(process.env.PORT) || 3001,
  clientOrigins: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
    : [],
  databaseStorage: process.env.DATABASE_STORAGE || './data/app-latin.sqlite',
  aiProvider: process.env.AI_PROVIDER || 'mock',
  aiModel: process.env.AI_MODEL || 'gpt-5.5',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  aiFallbackToMock: process.env.AI_FALLBACK_TO_MOCK !== 'false',
}
