import { Router } from 'express'
import { exerciseRoutes } from './exerciseRoutes.js'
import { healthRoutes } from './healthRoutes.js'
import { practiceSessionRoutes } from './practiceSessionRoutes.js'
import { profileSettingsRoutes } from './profileSettingsRoutes.js'
import { adaptiveVocabularyRoutes } from './adaptiveVocabularyRoutes.js'
import { authRoutes } from './authRoutes.js'
import { requireAuthentication } from '../middlewares/requireAuthentication.js'

export const apiRoutes = Router()

apiRoutes.use('/health', healthRoutes)
apiRoutes.use('/auth', authRoutes)
apiRoutes.use(requireAuthentication)
apiRoutes.use('/exercises', exerciseRoutes)
apiRoutes.use('/practice-sessions', practiceSessionRoutes)
apiRoutes.use('/profile-settings', profileSettingsRoutes)
apiRoutes.use('/vocabulary', adaptiveVocabularyRoutes)
