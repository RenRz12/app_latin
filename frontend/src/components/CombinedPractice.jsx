import { useMemo, useState } from 'react'
import {
  createPracticeSession,
  updatePracticeSession,
} from '../services/practiceSessionService.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { evaluateAnswer } from '../utils/answerEvaluation.js'
import {
  buildCombinedPracticePrompt,
  combinedVerbTenseOptions,
  getCombinedVerbTenseLabel,
  readCombinedPracticeFromPastedJson,
} from '../utils/combinedPractice.js'
import { ExerciseCard } from './ExerciseCard.jsx'

function activityData(session) {
  if (!session?.activityData) return null
  try {
    return typeof session.activityData === 'string'
      ? JSON.parse(session.activityData)
      : session.activityData
  } catch {
    return null
  }
}

function bestEvaluation(answer, exercise) {
  const evaluations = [exercise.correctAnswer, ...(exercise.acceptableAnswers || [])]
    .map((expected) => evaluateAnswer(answer, expected))
  return (
    evaluations.find((evaluation) => evaluation.status === 'correct') ||
    evaluations.find((evaluation) => evaluation.status === 'almost') ||
    evaluations[0]
  )
}

export function CombinedPractice({
  chapterFrom,
  chapterTo,
  resumeSession = null,
  onSessionUpdated,
}) {
  const resumedActivity = useMemo(() => activityData(resumeSession), [resumeSession])
  const resumedInProgress = resumeSession?.status === 'in_progress'
  const initialVerbTense = resumedActivity?.combinedVerbTense ||
    (resumeSession ? 'present' : 'mixed')
  const [sessionId, setSessionId] = useState(
    resumedInProgress ? resumeSession.id : null,
  )
  const [selectedVerbTense, setSelectedVerbTense] = useState(initialVerbTense)
  const [exercises, setExercises] = useState(resumedActivity?.exercises || [])
  const [answers, setAnswers] = useState(
    resumedInProgress ? resumedActivity?.progress?.answers || {} : {},
  )
  const [currentIndex, setCurrentIndex] = useState(
    resumedInProgress ? resumedActivity?.progress?.currentIndex || 0 : 0,
  )
  const [manualPrompt, setManualPrompt] = useState('')
  const [importText, setImportText] = useState('')
  const [statusMessage, setStatusMessage] = useState(
    resumeSession
      ? resumedInProgress
        ? 'Continuaste la práctica combinada desde tu último avance.'
        : 'La práctica guardada está lista para realizarse nuevamente.'
      : '',
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isFinished, setIsFinished] = useState(false)

  const exercise = exercises[currentIndex]
  const currentAnswer = answers[currentIndex] || {
    selectedAnswer: '',
    evaluation: null,
  }

  function buildPayload(status, nextExercises, nextAnswers, nextIndex) {
    const answered = Object.values(nextAnswers).filter((item) =>
      item?.selectedAnswer?.trim(),
    )
    const correct = answered.filter(
      (item) => item.evaluation?.status === 'correct',
    ).length
    return {
      practiceKind: 'combined',
      practiceLabel: 'Práctica combinada',
      detailLabel: `${getCombinedVerbTenseLabel(selectedVerbTense)} · Español a latín · Caps. ${chapterFrom}-${chapterTo}`,
      status,
      correctAnswers: correct,
      totalAnswers: status === 'completed' ? nextExercises.length : answered.length,
      activityData: {
        chapterFrom,
        chapterTo,
        direction: 'es_la',
        combinedVerbTense: selectedVerbTense,
        exercises: nextExercises,
        expectedTotalAnswers: nextExercises.length,
        progress: { currentIndex: nextIndex, answers: nextAnswers },
      },
    }
  }

  async function persist(status, nextExercises, nextAnswers, nextIndex) {
    const payload = buildPayload(status, nextExercises, nextAnswers, nextIndex)
    const saved = sessionId
      ? await updatePracticeSession(sessionId, payload)
      : await createPracticeSession(payload)
    setSessionId(saved.id)
    onSessionUpdated?.(saved)
    return saved
  }

  function preparePrompt() {
    setManualPrompt(
      buildCombinedPracticePrompt(chapterFrom, chapterTo, selectedVerbTense),
    )
    setStatusMessage('Prompt listo para copiar. Importa después el JSON generado por la IA.')
  }

  async function importPractice() {
    setIsLoading(true)
    try {
      const imported = readCombinedPracticeFromPastedJson(
        importText,
        chapterFrom,
        chapterTo,
        selectedVerbTense,
      )
      const emptyAnswers = {}
      const saved = await createPracticeSession(
        buildPayload('in_progress', imported.exercises, emptyAnswers, 0),
      )
      setSessionId(saved.id)
      setExercises(imported.exercises)
      setAnswers(emptyAnswers)
      setCurrentIndex(0)
      setImportText('')
      setIsFinished(false)
      setStatusMessage('Las 10 oraciones están listas y la práctica quedó guardada.')
      onSessionUpdated?.(saved)
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function submitAnswer() {
    if (!currentAnswer.selectedAnswer.trim() || currentAnswer.evaluation) return
    const evaluation = bestEvaluation(currentAnswer.selectedAnswer, exercise)
    const nextAnswers = {
      ...answers,
      [currentIndex]: { ...currentAnswer, evaluation },
    }
    setAnswers(nextAnswers)
    setIsLoading(true)
    try {
      await persist('in_progress', exercises, nextAnswers, currentIndex)
    } catch (error) {
      setStatusMessage(`No pudimos guardar la respuesta. ${getApiErrorMessage(error)}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function finishPractice() {
    setIsLoading(true)
    try {
      await persist('completed', exercises, answers, currentIndex)
      setIsFinished(true)
      setStatusMessage('Práctica combinada terminada y guardada en tu perfil.')
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function nextExercise() {
    setCurrentIndex((index) => index + 1)
  }

  function restart() {
    setSessionId(null)
    setAnswers({})
    setCurrentIndex(0)
    setIsFinished(false)
    setStatusMessage('Puedes realizar nuevamente las mismas oraciones.')
  }

  if (isFinished) {
    const correct = Object.values(answers).filter(
      (item) => item.evaluation?.status === 'correct',
    ).length
    return (
      <section className="combined-practice-shell">
        <div className="exercise-panel adaptive-summary">
          <p className="eyebrow">Práctica combinada terminada</p>
          <h2>{correct} de {exercises.length} correctas</h2>
          <p>Las oraciones y tus resultados quedaron disponibles en el perfil.</p>
          <button className="primary-action" type="button" onClick={restart}>
            Practicar de nuevo
          </button>
        </div>
      </section>
    )
  }

  if (exercise) {
    return (
      <section className="combined-practice-shell active">
        <aside className="practice-panel combined-practice-context">
          <div>
            <p className="eyebrow">Práctica combinada</p>
            <h2>Español a latín</h2>
            <p>Traduce la oración completa usando vocabulario del rango seleccionado.</p>
          </div>
          <div className="practice-scope-note">
            <strong>Alcance</strong>
            <span>Capítulos {chapterFrom} al {chapterTo}</span>
          </div>
          <div className="practice-scope-note">
            <strong>Tiempo de esta oración</strong>
            <span>
              {getCombinedVerbTenseLabel(exercise.verbTense || selectedVerbTense)}
            </span>
          </div>
          <div className="combined-target-list">
            <strong>Vocabulario objetivo</strong>
            {exercise.targetVocabulary.map((target) => (
              <span key={`${target.lemma}-${target.form}`}>
                {target.meaning}
              </span>
            ))}
          </div>
          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </aside>
        <ExerciseCard
          exercise={exercise}
          exerciseType="translation_es_la"
          selectedAnswer={currentAnswer.selectedAnswer}
          showFeedback={Boolean(currentAnswer.evaluation)}
          evaluation={currentAnswer.evaluation}
          currentIndex={currentIndex}
          totalExercises={exercises.length}
          canGoPrevious={false}
          canGoNext={Boolean(currentAnswer.evaluation)}
          isLastExercise={currentIndex === exercises.length - 1}
          canFinish={Boolean(currentAnswer.evaluation)}
          onAnswerSelect={() => {}}
          onTextAnswerChange={(selectedAnswer) =>
            setAnswers((current) => ({
              ...current,
              [currentIndex]: { selectedAnswer, evaluation: null },
            }))
          }
          onTextAnswerSubmit={submitAnswer}
          onPreviousExercise={() => {}}
          onNextExercise={nextExercise}
          onFinishSession={finishPractice}
        />
      </section>
    )
  }

  return (
    <section className="combined-practice-shell setup">
      <aside className="practice-panel">
        <div>
          <p className="eyebrow">Práctica combinada</p>
          <h2>Traduce oraciones completas</h2>
          <p className="adaptive-intro">
            Las oraciones combinarán vocabulario de Familia Romana con estructuras compatibles
            con tu alcance actual.
          </p>
        </div>
        <div className="practice-scope-note">
          <strong>Rango del perfil</strong>
          <span>Capítulos {chapterFrom} al {chapterTo}</span>
          <small>Puedes cambiarlo desde Mi perfil.</small>
        </div>
        <div className="field-group">
          <label htmlFor="combined-verb-tense">Tiempo verbal</label>
          <select
            id="combined-verb-tense"
            value={selectedVerbTense}
            onChange={(event) => {
              setSelectedVerbTense(event.target.value)
              setManualPrompt('')
              setImportText('')
              setStatusMessage('')
            }}
          >
            {combinedVerbTenseOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <p>
            {combinedVerbTenseOptions.find(
              (option) => option.id === selectedVerbTense,
            )?.description}
          </p>
        </div>
        <button className="primary-action" type="button" onClick={preparePrompt}>
          Preparar prompt para la IA
        </button>
        {statusMessage && <p className="status-message">{statusMessage}</p>}
      </aside>
      <div className="adaptive-prompt-column">
        <section className="exercise-panel adaptive-welcome">
          <p className="eyebrow">Objetivo</p>
          <h2>Unir vocabulario y gramática</h2>
          <p>
            Traducirás diez oraciones de español a latín en el tiempo verbal elegido.
            Cada una identificará el vocabulario objetivo usado dentro del rango.
          </p>
        </section>
        {manualPrompt && (
          <section className="manual-workspace adaptive-manual-workspace">
            <div className="manual-panel">
              <h2>Prompt preparado</h2>
              <textarea readOnly value={manualPrompt} />
              <button
                className="secondary-action"
                type="button"
                onClick={() => navigator.clipboard.writeText(manualPrompt)}
              >
                Copiar prompt
              </button>
            </div>
            <div className="manual-panel">
              <h2>Importar práctica</h2>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder='Pega aquí {"combinedPractice": {...}}'
              />
              <button
                className="primary-action"
                type="button"
                disabled={!importText.trim() || isLoading}
                onClick={importPractice}
              >
                Importar 10 oraciones
              </button>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
