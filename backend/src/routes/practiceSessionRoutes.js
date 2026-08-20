import { Router } from 'express'
import {
  createPracticeSession,
  getPracticeSessions,
  removePracticeSession,
  updatePracticeSession,
  answerAdaptiveExercise,
  createAdaptiveSession,
  generateAdaptiveSession,
  getAdaptiveSession,
  getAdaptiveSessionPrompt,
  importAdaptiveSession,
} from '../controllers/practiceSessionController.js'

export const practiceSessionRoutes = Router()

practiceSessionRoutes.get('/', getPracticeSessions)
practiceSessionRoutes.post('/adaptive', createAdaptiveSession)
practiceSessionRoutes.get('/adaptive/:sessionId', getAdaptiveSession)
practiceSessionRoutes.post(
  '/adaptive/:sessionId/generate',
  generateAdaptiveSession,
)
practiceSessionRoutes.post(
  '/adaptive/:sessionId/prompt',
  getAdaptiveSessionPrompt,
)
practiceSessionRoutes.post('/adaptive/:sessionId/import', importAdaptiveSession)
practiceSessionRoutes.post(
  '/adaptive/exercises/:exerciseId/answer',
  answerAdaptiveExercise,
)
practiceSessionRoutes.post('/', createPracticeSession)
practiceSessionRoutes.put('/:sessionId', updatePracticeSession)
practiceSessionRoutes.delete('/:sessionId', removePracticeSession)
