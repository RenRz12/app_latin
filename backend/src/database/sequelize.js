import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { Sequelize } from 'sequelize'
import { env } from '../config/env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const storagePath = path.resolve(__dirname, '../../', env.databaseStorage)

mkdirSync(path.dirname(storagePath), { recursive: true })

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storagePath,
  logging: false,
})
