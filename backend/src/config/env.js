import dotenv from 'dotenv'

dotenv.config()

export const env = {
  port: Number(process.env.PORT) || 3001,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  databaseStorage: process.env.DATABASE_STORAGE || './data/app-latin.sqlite',
}
