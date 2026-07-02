import { useMemo, useState } from 'react'
import { ApiPreview } from '../components/ApiPreview.jsx'
import { ExerciseCard } from '../components/ExerciseCard.jsx'
import { IntroSection } from '../components/IntroSection.jsx'
import { ManualExerciseTools } from '../components/ManualExerciseTools.jsx'
import { PracticeSettings } from '../components/PracticeSettings.jsx'
import {
  exerciseTypes,
  sampleExercises,
  topics,
  vocabularyLevels,
} from '../data/exerciseOptions.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import {
  createExercisePrompt,
  generateExercise,
  importExercises,
} from '../services/exerciseService.js'
import { readExercisesFromPastedJson } from '../utils/exerciseImport.js'

export function PracticePage() {
  const [selectedTopic, setSelectedTopic] = useState('presente')
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [selectedType, setSelectedType] = useState('multiple_choice')
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [backendExercise, setBackendExercise] = useState(null)
  const [manualPrompt, setManualPrompt] = useState('')
  const [importText, setImportText] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const topic = topics.find((item) => item.id === selectedTopic)
  const level = vocabularyLevels.find((item) => item.id === selectedLevel)
  const exerciseType = exerciseTypes.find((item) => item.id === selectedType)
  const exercise = backendExercise || sampleExercises[selectedTopic]
  const isCorrect = selectedAnswer === exercise.correctAnswer

  const backendPayload = useMemo(
    () => ({
      topic: selectedTopic,
      vocabularyLevel: selectedLevel,
      exerciseType: selectedType,
    }),
    [selectedLevel, selectedTopic, selectedType],
  )

  function resetExerciseState() {
    setSelectedAnswer('')
    setShowFeedback(false)
  }

  function resetContext() {
    resetExerciseState()
    setBackendExercise(null)
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
      setBackendExercise(generated)
      resetExerciseState()
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
      const response = await importExercises({
        ...backendPayload,
        exercises,
      })

      setBackendExercise(response.exercises[0])
      setImportText('')
      resetExerciseState()
      setStatusMessage(`${response.count} ejercicio(s) importado(s) desde ChatGPT.`)
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
    setSelectedAnswer(answer)
    setShowFeedback(false)
  }

  function handleAnswerSubmit() {
    if (!selectedAnswer) return
    setShowFeedback(true)
  }

  return (
    <main className="app-shell">
      <IntroSection topic={topic} level={level} exerciseType={exerciseType} />

      <section className="workspace" aria-label="Configuracion y ejercicio">
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

        <ExerciseCard
          exercise={exercise}
          selectedAnswer={selectedAnswer}
          showFeedback={showFeedback}
          isCorrect={isCorrect}
          onAnswerSelect={handleAnswerSelect}
          onAnswerSubmit={handleAnswerSubmit}
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
