import { Router } from 'express'
import {
  createExercise,
  createExercisePrompt,
  getExercises,
  importExercises,
} from '../controllers/exerciseController.js'

export const exerciseRoutes = Router()

exerciseRoutes.get('/', getExercises)
exerciseRoutes.post('/generate', createExercise)
exerciseRoutes.post('/prompt', createExercisePrompt)
exerciseRoutes.post('/import', importExercises)
