import {
  deletePracticeSession,
  listPracticeSessions,
  savePracticeSession,
} from '../services/practiceSessionService.js'
import {
  createAdaptivePracticeSession,
  createAdaptiveSessionPrompt,
  generateAdaptiveSessionExercises,
  getAdaptivePracticeSession,
  submitAdaptiveExerciseAnswer,
  importAdaptiveSessionExercises,
} from '../services/adaptivePracticeService.js'

export async function getPracticeSessions(_request, response, next) {
  try {
    const sessions = await listPracticeSessions()
    response.json(sessions)
  } catch (error) {
    next(error)
  }
}

export async function createPracticeSession(request, response, next) {
  try {
    const session = await savePracticeSession(request.body)
    response.status(201).json(session)
  } catch (error) {
    next(error)
  }
}

export async function updatePracticeSession(request, response, next) {
  try {
    const session = await savePracticeSession(
      request.body,
      request.params.sessionId,
    )
    response.json(session)
  } catch (error) {
    next(error)
  }
}

export async function removePracticeSession(request, response, next) {
  try {
    await deletePracticeSession(request.params.sessionId)
    response.status(204).send()
  } catch (error) {
    next(error)
  }
}

export async function createAdaptiveSession(request, response, next) {
  try {
    response.status(201).json(await createAdaptivePracticeSession(request.body))
  } catch (error) {
    next(error)
  }
}

export async function getAdaptiveSession(request, response, next) {
  try {
    response.json(await getAdaptivePracticeSession(request.params.sessionId))
  } catch (error) {
    next(error)
  }
}

export async function generateAdaptiveSession(request, response, next) {
  try {
    response.json(
      await generateAdaptiveSessionExercises(request.params.sessionId),
    )
  } catch (error) {
    next(error)
  }
}

export async function getAdaptiveSessionPrompt(request, response, next) {
  try {
    response.json(await createAdaptiveSessionPrompt(request.params.sessionId))
  } catch (error) {
    next(error)
  }
}

export async function importAdaptiveSession(request, response, next) {
  try {
    response
      .status(201)
      .json(
        await importAdaptiveSessionExercises(
          request.params.sessionId,
          request.body,
        ),
      )
  } catch (error) {
    next(error)
  }
}

export async function answerAdaptiveExercise(request, response, next) {
  try {
    response.json(
      await submitAdaptiveExerciseAnswer({
        ...request.body,
        exerciseId: request.params.exerciseId,
      }),
    )
  } catch (error) {
    next(error)
  }
}
