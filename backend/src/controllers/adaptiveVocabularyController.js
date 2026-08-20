import {
  getReadingProgress,
  getVocabularyMetrics,
  listVocabulary,
  listVocabularyProgress,
  updateReadingProgress,
} from '../services/adaptiveVocabularyService.js'
import { recordVocabularyReview } from '../services/vocabularyProgressService.js'

export async function getVocabulary(request, response, next) {
  try {
    const vocabulary = await listVocabulary(request.query)
    response.json(vocabulary)
  } catch (error) {
    next(error)
  }
}

export async function getVocabularyProgress(request, response, next) {
  try {
    const progress = await listVocabularyProgress(
      request.query.userId ? Number(request.query.userId) : undefined,
      request.query.dueOnly === 'true',
    )
    response.json(progress)
  } catch (error) {
    next(error)
  }
}

export async function createVocabularyReview(request, response, next) {
  try {
    const result = await recordVocabularyReview({
      ...request.body,
      vocabularyId: Number(request.params.vocabularyId),
    })
    response.status(201).json(result)
  } catch (error) {
    next(error)
  }
}

export async function getUserReadingProgress(request, response, next) {
  try {
    response.json(await getReadingProgress(Number(request.params.userId)))
  } catch (error) {
    next(error)
  }
}

export async function putUserReadingProgress(request, response, next) {
  try {
    response.json(
      await updateReadingProgress(
        request.body.currentChapter,
        Number(request.params.userId),
      ),
    )
  } catch (error) {
    next(error)
  }
}

export async function getDueVocabulary(request, response, next) {
  try {
    response.json(
      await listVocabularyProgress(
        request.query.userId ? Number(request.query.userId) : undefined,
        true,
      ),
    )
  } catch (error) {
    next(error)
  }
}

export async function getUserVocabularyMetrics(request, response, next) {
  try {
    response.json(
      await getVocabularyMetrics(
        request.query.userId ? Number(request.query.userId) : undefined,
        new Date(),
        {
          chapterFrom: request.query.chapterFrom,
          chapterTo: request.query.chapterTo,
        },
      ),
    )
  } catch (error) {
    next(error)
  }
}
