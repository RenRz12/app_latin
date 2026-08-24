import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { Sequelize } from 'sequelize'
import { env } from '../config/env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const usePostgres =
  Boolean(env.databaseUrl) && env.databaseStorage !== ':memory:'
const storagePath =
  env.databaseStorage === ':memory:'
    ? ':memory:'
    : path.resolve(__dirname, '../../', env.databaseStorage)

if (!usePostgres && storagePath !== ':memory:') {
  mkdirSync(path.dirname(storagePath), { recursive: true })
}

export const databaseDialect = usePostgres ? 'postgres' : 'sqlite'

export const sequelize = usePostgres
  ? new Sequelize(env.databaseUrl, {
      dialect: 'postgres',
      dialectOptions: env.databaseSsl ? { ssl: true } : {},
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      logging: false,
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: storagePath,
      logging: false,
    })
