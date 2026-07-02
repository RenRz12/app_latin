import { Router } from 'express'
import { createExercise, getExercises } from '../controllers/exerciseController.js'

export const exerciseRoutes = Router()

exerciseRoutes.get('/', getExercises)
exerciseRoutes.post('/generate', createExercise)
