import {
  getProfileSettings,
  updateProfileSettings,
} from '../services/profileSettingsService.js'

export async function readProfileSettings(_request, response, next) {
  try {
    response.json(await getProfileSettings())
  } catch (error) {
    next(error)
  }
}

export async function saveProfileSettings(request, response, next) {
  try {
    response.json(await updateProfileSettings(request.body))
  } catch (error) {
    next(error)
  }
}
