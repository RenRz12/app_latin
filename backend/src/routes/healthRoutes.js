import { Router } from 'express'
import { sequelize } from '../database/sequelize.js'

export const healthRoutes = Router()

healthRoutes.get('/', async (_request, response, next) => {
  try {
    await sequelize.authenticate()
    response.json({
      status: 'ok',
      service: 'app-latin-backend',
      database: 'connected',
    })
  } catch (error) {
    next(error)
  }
})
