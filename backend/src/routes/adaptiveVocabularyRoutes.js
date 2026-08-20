import { Router } from 'express'
import {
  createVocabularyReview,
  getUserReadingProgress,
  getDueVocabulary,
  getUserVocabularyMetrics,
  getVocabulary,
  getVocabularyProgress,
  putUserReadingProgress,
} from '../controllers/adaptiveVocabularyController.js'

export const adaptiveVocabularyRoutes = Router()

adaptiveVocabularyRoutes.get('/', getVocabulary)
adaptiveVocabularyRoutes.get('/progress', getVocabularyProgress)
adaptiveVocabularyRoutes.get('/due', getDueVocabulary)
adaptiveVocabularyRoutes.get('/metrics', getUserVocabularyMetrics)
adaptiveVocabularyRoutes.post('/:vocabularyId/reviews', createVocabularyReview)
adaptiveVocabularyRoutes.get(
  '/users/:userId/reading-progress',
  getUserReadingProgress,
)
adaptiveVocabularyRoutes.put(
  '/users/:userId/reading-progress',
  putUserReadingProgress,
)
