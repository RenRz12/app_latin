import { Router } from 'express'
import {
  readProfileSettings,
  saveProfileSettings,
} from '../controllers/profileSettingsController.js'

export const profileSettingsRoutes = Router()

profileSettingsRoutes.get('/', readProfileSettings)
profileSettingsRoutes.put('/', saveProfileSettings)
