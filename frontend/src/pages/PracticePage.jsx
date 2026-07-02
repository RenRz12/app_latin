import { useMemo, useState } from 'react'
import { ApiPreview } from '../components/ApiPreview.jsx'
import { ExerciseCard } from '../components/ExerciseCard.jsx'
import { IntroSection } from '../components/IntroSection.jsx'
import { ManualExerciseTools } from '../components/ManualExerciseTools.jsx'
import { PracticeSettings } from '../components/PracticeSettings.jsx'
import {
  exerciseTypes,
  getSampleExercise,
  topics,
  vocabularyLevels,
} from '../data/exerciseOptions.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import {
  createExercisePrompt,
  generateExercise,
  importExercises,
} from '../services/exerciseService.js'
import { evaluateAnswer } from '../utils/answerEvaluation.js'
import {
  inferExerciseTypeFromExercises,
  readExercisesFromPastedJson,
} from '../utils/exerciseImport.js'

export function PracticePage() {
  const [selectedTopic, setSelectedTopic] = useState('presente')
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [selectedType, setSelectedType] = useState('multiple_choice')
  const [exerciseList, setExerciseList] = useState([])
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [answerStateByExercise, setAnswerStateByExercise] = useState({})
  const [manualPrompt, setManualPrompt] = useState('')
  const [importText, setImportText] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(true)

  const topic = topics.find((item) => item.id === selectedTopic)
  const level = vocabularyLevels.find((item) => item.id === selectedLevel)
  const exerciseType = exerciseTypes.find((item) => item.id === selectedType)
  const exercise = exerciseList[currentExerciseIndex] || getSampleExercise(selectedTopic, selectedType)
  const exerciseKey = exercise.id || `${selectedTopic}-sample`
  const currentExerciseType = exercise.exerciseType || selectedType
  const currentAnswerState = answerStateByExercise[exerciseKey] || {
    selectedAnswer: '',
    showFeedback: false,
    evaluation: null,
  }
  const hasExerciseList = exerciseList.length > 0

  const backendPayload = useMemo(
    () => ({
      topic: selectedTopic,
      vocabularyLevel: selectedLevel,
      exerciseType: selectedType,
    }),
    [selectedLevel, selectedTopic, selectedType],
  )

  function resetContext() {
    setExerciseList([])
    setCurrentExerciseIndex(0)
    setAnswerStateByExercise({})
    setManualPrompt('')
    setStatusMessage('')
  }

  function handleTopicChange(topicId) {
    setSelectedTopic(topicId)
    resetContext()
  }

  function handleLevelChange(levelId) {
    setSelectedLevel(levelId)
    resetContext()
  }

  function handleTypeChange(typeId) {
    setSelectedType(typeId)
    resetContext()
  }

  async function handleGenerateFromBackend() {
    setIsLoading(true)
    setStatusMessage('')

    try {
      const generated = await generateExercise(backendPayload)
      setExerciseList([generated])
      setCurrentExerciseIndex(0)
      setAnswerStateByExercise({})
      setStatusMessage(`Ejercicio generado y guardado (${generated.source}).`)
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateManualPrompt() {
    setIsLoading(true)
    setStatusMessage('')

    try {
      const response = await createExercisePrompt(backendPayload)
      setManualPrompt(response.prompt)
      setStatusMessage('Prompt listo para pegar en ChatGPT.')
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleImportExercises() {
    setIsLoading(true)
    setStatusMessage('')

    try {
      const exercises = readExercisesFromPastedJson(importText)
      const inferredExerciseType = inferExerciseTypeFromExercises(exercises, selectedType)
      const response = await importExercises({
        ...backendPayload,
        exerciseType: inferredExerciseType,
        exercises,
      })

      setExerciseList(response.exercises)
      setCurrentExerciseIndex(0)
      setAnswerStateByExercise({})
      setImportText('')
      setSelectedType(inferredExerciseType)
      setShowSettings(false)
      setStatusMessage(
        `${response.count} ejercicio(s) importado(s) desde ChatGPT como ${inferredExerciseType}.`,
      )
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopyPrompt() {
    if (!manualPrompt) return
    await navigator.clipboard.writeText(manualPrompt)
    setStatusMessage('Prompt copiado.')
  }

  function handleAnswerSelect(answer) {
    const evaluation = evaluateAnswer(answer, exercise.correctAnswer)

    setAnswerStateByExercise((currentState) => ({
      ...currentState,
      [exerciseKey]: {
        selectedAnswer: answer,
        showFeedback: true,
        evaluation,
      },
    }))
  }

  function handleTextAnswerChange(answer) {
    setAnswerStateByExercise((currentState) => ({
      ...currentState,
      [exerciseKey]: {
        selectedAnswer: answer,
        showFeedback: false,
        evaluation: null,
      },
    }))
  }

  function handleTextAnswerSubmit() {
    if (!currentAnswerState.selectedAnswer) return
    const evaluation = evaluateAnswer(currentAnswerState.selectedAnswer, exercise.correctAnswer)

    setAnswerStateByExercise((currentState) => ({
      ...currentState,
      [exerciseKey]: {
        ...currentAnswerState,
        showFeedback: true,
        evaluation,
      },
    }))
  }

  function handleRevealAnswer() {
    setAnswerStateByExercise((currentState) => ({
      ...currentState,
      [exerciseKey]: {
        ...currentAnswerState,
        showFeedback: true,
        evaluation:
          currentAnswerState.evaluation ||
          evaluateAnswer(currentAnswerState.selectedAnswer, exercise.correctAnswer),
      },
    }))
  }

  function handlePreviousExercise() {
    setCurrentExerciseIndex((currentIndex) => Math.max(currentIndex - 1, 0))
  }

  function handleNextExercise() {
    setCurrentExerciseIndex((currentIndex) =>
      Math.min(currentIndex + 1, exerciseList.length - 1),
    )
  }

  return (
    <main className="app-shell">
      <IntroSection topic={topic} level={level} exerciseType={exerciseType} />

      <div className="settings-toggle-row">
        <button
          className="secondary-action"
          type="button"
          onClick={() => setShowSettings((currentValue) => !currentValue)}
        >
          {showSettings ? 'Ocultar configuracion' : 'Mostrar configuracion'}
        </button>
        {!showSettings && statusMessage && <p className="status-message">{statusMessage}</p>}
      </div>

      <section
        className={showSettings ? 'workspace' : 'workspace settings-hidden'}
        aria-label="Configuracion y ejercicio"
      >
        {showSettings && (
          <PracticeSettings
            topics={topics}
            vocabularyLevels={vocabularyLevels}
            exerciseTypes={exerciseTypes}
            selectedTopic={selectedTopic}
            selectedLevel={selectedLevel}
            selectedType={selectedType}
            topic={topic}
            level={level}
            isLoading={isLoading}
            statusMessage={statusMessage}
            onTopicChange={handleTopicChange}
            onLevelChange={handleLevelChange}
            onTypeChange={handleTypeChange}
            onGenerateFromBackend={handleGenerateFromBackend}
            onCreateManualPrompt={handleCreateManualPrompt}
          />
        )}

        <ExerciseCard
          exercise={exercise}
          exerciseType={currentExerciseType}
          selectedAnswer={currentAnswerState.selectedAnswer}
          showFeedback={currentAnswerState.showFeedback}
          evaluation={currentAnswerState.evaluation}
          currentIndex={hasExerciseList ? currentExerciseIndex : 0}
          totalExercises={hasExerciseList ? exerciseList.length : 1}
          canGoPrevious={hasExerciseList && currentExerciseIndex > 0}
          canGoNext={hasExerciseList && currentExerciseIndex < exerciseList.length - 1}
          onAnswerSelect={handleAnswerSelect}
          onTextAnswerChange={handleTextAnswerChange}
          onTextAnswerSubmit={handleTextAnswerSubmit}
          onRevealAnswer={handleRevealAnswer}
          onPreviousExercise={handlePreviousExercise}
          onNextExercise={handleNextExercise}
        />
      </section>

      <ManualExerciseTools
        manualPrompt={manualPrompt}
        importText={importText}
        isLoading={isLoading}
        onCopyPrompt={handleCopyPrompt}
        onImportTextChange={setImportText}
        onImportExercises={handleImportExercises}
      />

      <ApiPreview payload={backendPayload} />
    </main>
  )
}
