import { useEffect, useMemo, useRef, useState } from 'react'
import { getApiErrorMessage } from '../services/apiClient.js'
import {
  answerAdaptiveVocabularyExercise,
  createAdaptiveVocabularyPrompt,
  createAdaptiveVocabularySession,
  generateAdaptiveVocabularyExercises,
  getAdaptiveVocabularySession,
  importAdaptiveVocabularyExercises,
} from '../services/adaptiveVocabularyService.js'
import { ExerciseCard } from './ExerciseCard.jsx'
import { parsePastedJson } from '../utils/pastedJson.js'

const TYPE_LABELS = {
  VOCABULARY_MULTIPLE_CHOICE: 'Reconocimiento',
  CONTEXT_MEANING: 'Significado en contexto',
  TRANSLATION_LA_ES: 'Latín a español',
  TRANSLATION_ES_LA: 'Español a latín',
  INFLECTION_COMPLETION: 'Completar flexión',
  INFLECTION_MULTIPLE_CHOICE: 'Elegir flexión',
  GUIDED_RECALL: 'Recuperación guiada',
  LEMMA_IDENTIFICATION: 'Identificar lema',
  MORPHOLOGY_PRODUCTION: 'Producción morfológica',
  FREE_PRODUCTION: 'Producción libre',
}

export function AdaptiveVocabularyPractice({
  chapterFrom,
  chapterTo,
  resumeSessionId = null,
  onSessionUpdated,
}) {
  const [sessionSize, setSessionSize] = useState(20)
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [evaluation, setEvaluation] = useState(null)
  const [manualPrompt, setManualPrompt] = useState('')
  const [importText, setImportText] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const answerStartedAt = useRef(null)

  const exercise = exercises[currentIndex]
  const typeLabel = TYPE_LABELS[exercise?.exerciseType] || 'Práctica adaptativa'
  const answeredCount = Number(session?.totalAnswers || 0)
  const progressPercent = exercises.length
    ? Math.round((answeredCount / exercises.length) * 100)
    : 0
  const skillSummary = useMemo(() => {
    const counts = {}
    for (const item of session?.plan?.items || []) {
      const label = TYPE_LABELS[item.selectedExerciseType]
      counts[label] = (counts[label] || 0) + 1
    }
    return Object.entries(counts)
  }, [session])

  useEffect(() => {
    if (!resumeSessionId) return undefined
    let active = true
    getAdaptiveVocabularySession(resumeSessionId)
      .then((loaded) => {
        if (!active) return
        setSession(loaded)
        setExercises(loaded.exercises || [])
        const nextIndex = Math.min(
          Number(loaded.totalAnswers || 0),
          Math.max(0, (loaded.exercises?.length || 1) - 1),
        )
        setCurrentIndex(nextIndex)
        setIsFinished(loaded.status === 'completed')
        answerStartedAt.current = Date.now()
        setStatusMessage(
          loaded.status === 'completed'
            ? 'Esta sesión ya estaba terminada. Puedes crear una nueva cuando quieras.'
            : 'Retomaste la sesión desde la siguiente respuesta pendiente.',
        )
      })
      .catch((error) => setStatusMessage(getApiErrorMessage(error)))
    return () => {
      active = false
    }
  }, [resumeSessionId])

  function resetAnswer() {
    setSelectedAnswer('')
    setEvaluation(null)
    answerStartedAt.current = Date.now()
  }

  async function ensureSession() {
    if (session && session.status !== 'completed' && !exercises.length) return session
    const created = await createAdaptiveVocabularySession(sessionSize)
    setSession(created)
    setExercises([])
    setCurrentIndex(0)
    setIsFinished(false)
    resetAnswer()
    onSessionUpdated?.()
    return created
  }

  async function handleStart() {
    if (exercises.length) return
    setIsLoading(true)
    setStatusMessage('Seleccionando palabras y preparando una práctica equilibrada...')
    try {
      const activeSession = await ensureSession()
      const generated = await generateAdaptiveVocabularyExercises(activeSession.id)
      const loaded = await getAdaptiveVocabularySession(activeSession.id)
      setSession(loaded)
      setExercises(generated.exercises)
      setCurrentIndex(Math.min(loaded.totalAnswers, generated.exercises.length - 1))
      setManualPrompt(generated.prompt || '')
      setIsFinished(false)
      resetAnswer()
      setStatusMessage('Práctica adaptativa lista. Cada ejercicio responde a una necesidad concreta.')
      onSessionUpdated?.()
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePreparePrompt() {
    setIsLoading(true)
    setStatusMessage('Preparando el plan para la IA...')
    try {
      const activeSession = await ensureSession()
      const prepared = await createAdaptiveVocabularyPrompt(activeSession.id)
      setManualPrompt(prepared.prompt)
      setStatusMessage('Prompt listo. La IA recibirá los objetivos ya decididos por la aplicación.')
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleImport() {
    setIsLoading(true)
    try {
      const activeSession = await ensureSession()
      const imported = await importAdaptiveVocabularyExercises(
        activeSession.id,
        parsePastedJson(importText),
      )
      const loaded = await getAdaptiveVocabularySession(activeSession.id)
      setSession(loaded)
      setExercises(imported.exercises)
      setImportText('')
      setCurrentIndex(0)
      setIsFinished(false)
      resetAnswer()
      setStatusMessage(`${imported.exercises.length} ejercicios validados y listos.`)
      onSessionUpdated?.()
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function submitAnswer(answer) {
    if (!answer.trim() || evaluation || !exercise) return
    setIsLoading(true)
    try {
      const result = await answerAdaptiveVocabularyExercise(
        exercise.id,
        answer,
        answerStartedAt.current ? Date.now() - answerStartedAt.current : null,
      )
      setSelectedAnswer(answer)
      setEvaluation(result.evaluation)
      setSession((current) => ({ ...current, ...result.session }))
      onSessionUpdated?.()
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function goNext() {
    if (currentIndex >= exercises.length - 1) {
      setIsFinished(true)
      return
    }
    setCurrentIndex((index) => index + 1)
    resetAnswer()
  }

  function startAnother() {
    setSession(null)
    setExercises([])
    setManualPrompt('')
    setImportText('')
    setCurrentIndex(0)
    setIsFinished(false)
    resetAnswer()
    setStatusMessage('Puedes crear una nueva sesión; la anterior queda guardada en tu perfil.')
  }

  if (isFinished && session) {
    return (
      <section className="adaptive-vocabulary-shell">
        <div className="adaptive-summary exercise-panel">
          <p className="eyebrow">Sesión guardada</p>
          <h2>{session.accuracy}% de acierto</h2>
          <p>
            {session.correctAnswers} respuestas correctas de {session.totalAnswers}. El próximo
            repaso usará estos resultados para elegir palabras y formatos.
          </p>
          <button className="primary-action" type="button" onClick={startAnother}>
            Preparar otra práctica
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="adaptive-vocabulary-shell">
      <aside className="practice-panel adaptive-vocabulary-settings">
        <div>
          <p className="eyebrow">Vocabulario adaptativo</p>
          <h2>Practicá lo que más necesitás</h2>
          <p className="adaptive-intro">
            La aplicación alterna reconocimiento, contexto, recuperación, producción y morfología
            según tu progreso real.
          </p>
        </div>
        <div className="practice-scope-note">
          <strong>Alcance general</strong>
          <span>Lingua Latina, capítulos {chapterFrom} al {chapterTo}</span>
          <small>El vocabulario conocido se usa solo como apoyo.</small>
        </div>
        {!exercises.length && (
          <div className="field-group">
            <label htmlFor="adaptive-session-size">Cantidad de ejercicios</label>
            <select
              id="adaptive-session-size"
              value={sessionSize}
              onChange={(event) => setSessionSize(Number(event.target.value))}
            >
              {[15, 20].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        )}
        {!exercises.length && (
          <div className="button-stack">
            <button className="primary-action" type="button" disabled={isLoading} onClick={handleStart}>
              Comenzar práctica adaptativa
            </button>
            <button className="secondary-action full-width" type="button" disabled={isLoading} onClick={handlePreparePrompt}>
              Preparar prompt para la IA
            </button>
          </div>
        )}
        {skillSummary.length > 0 && (
          <div className="adaptive-plan-summary">
            <strong>Plan de esta sesión</strong>
            {skillSummary.map(([label, count]) => <span key={label}>{label}: {count}</span>)}
          </div>
        )}
        {statusMessage && <p className="status-message">{statusMessage}</p>}
      </aside>

      {exercise ? (
        <div className="adaptive-exercise-column">
          <div className="adaptive-progress" aria-label={`Progreso: ${progressPercent}%`}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="adaptive-type-label">{typeLabel}</p>
          <ExerciseCard
            exercise={exercise}
            exerciseType={exercise.exerciseType}
            selectedAnswer={selectedAnswer}
            showFeedback={Boolean(evaluation)}
            evaluation={evaluation}
            currentIndex={currentIndex}
            totalExercises={exercises.length}
            canGoPrevious={false}
            canGoNext={Boolean(evaluation)}
            isLastExercise={currentIndex === exercises.length - 1}
            canFinish={Boolean(evaluation)}
            onAnswerSelect={submitAnswer}
            onTextAnswerChange={setSelectedAnswer}
            onTextAnswerSubmit={() => submitAnswer(selectedAnswer)}
            onPreviousExercise={() => {}}
            onNextExercise={goNext}
            onFinishSession={goNext}
          />
        </div>
      ) : (
        <div className="adaptive-prompt-column">
          <section className="exercise-panel adaptive-welcome">
            <p className="eyebrow">Cómo funciona</p>
            <h2>Una sesión distinta para cada debilidad</h2>
            <p>
              Si reconocés una palabra pero no podés producirla, recibirás recuperación guiada y
              traducción al latín. Si tu dificultad está en las formas, practicarás morfología.
            </p>
          </section>
          {manualPrompt && (
            <section className="manual-workspace adaptive-manual-workspace">
              <div className="manual-panel">
                <h2>Prompt preparado</h2>
                <textarea readOnly value={manualPrompt} />
                <button className="secondary-action" type="button" onClick={() => navigator.clipboard.writeText(manualPrompt)}>
                  Copiar prompt
                </button>
              </div>
              <div className="manual-panel">
                <h2>Importar JSON validado</h2>
                <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='Pegá aquí {"exercises":[...]}' />
                <button className="primary-action" type="button" disabled={!importText.trim() || isLoading} onClick={handleImport}>
                  Importar práctica
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  )
}
