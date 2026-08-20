import { ProfileSettings } from '../models/ProfileSettings.js'
import { AppError } from '../utils/AppError.js'

const minimumChapter = 1
const maximumChapter = 35

export async function getProfileSettings() {
  const [settings] = await ProfileSettings.findOrCreate({
    where: { id: 1 },
    defaults: {
      vocabularyChapterFrom: 1,
      vocabularyChapterTo: 5,
    },
  })

  return settings
}

export async function updateProfileSettings(payload) {
  const vocabularyChapterFrom = Number(payload.vocabularyChapterFrom)
  const vocabularyChapterTo = Number(payload.vocabularyChapterTo)

  if (
    !Number.isInteger(vocabularyChapterFrom) ||
    !Number.isInteger(vocabularyChapterTo) ||
    vocabularyChapterFrom < minimumChapter ||
    vocabularyChapterTo > maximumChapter ||
    vocabularyChapterFrom > vocabularyChapterTo
  ) {
    throw new AppError('El rango debe estar entre los capítulos 1 y 35.')
  }

  const settings = await getProfileSettings()
  return settings.update({ vocabularyChapterFrom, vocabularyChapterTo })
}
