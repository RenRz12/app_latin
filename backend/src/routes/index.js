import { Router } from 'express'
import { exerciseRoutes } from './exerciseRoutes.js'
import { healthRoutes } from './healthRoutes.js'

export const apiRoutes = Router()

apiRoutes.use('/health', healthRoutes)
apiRoutes.use('/exercises', exerciseRoutes)
