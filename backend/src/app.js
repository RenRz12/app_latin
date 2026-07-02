import express from 'express'
import { env } from './config/env.js'
import { corsMiddleware } from './config/cors.js'
import { sequelize } from './database/sequelize.js'
import { errorHandler } from './middlewares/errorHandler.js'
import './models/index.js'
import { apiRoutes } from './routes/index.js'

const app = express()

app.use(corsMiddleware)
app.use(express.json())
app.use('/api', apiRoutes)
app.use(errorHandler)

try {
  await sequelize.sync()

  app.listen(env.port, () => {
    console.log(`Backend escuchando en http://localhost:${env.port}`)
  })
} catch (error) {
  console.error('No se pudo iniciar el backend.', error)
  process.exit(1)
}
