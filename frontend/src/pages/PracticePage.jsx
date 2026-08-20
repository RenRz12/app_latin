import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiPreview } from '../components/ApiPreview.jsx'
import { AdaptiveVocabularyPractice } from '../components/AdaptiveVocabularyPractice.jsx'
import { AppNavigation } from '../components/AppNavigation.jsx'
import { CombinedPractice } from '../components/CombinedPractice.jsx'
import { DeclensionExercise } from '../components/DeclensionExercise.jsx'
import { DeclensionSetup } from '../components/DeclensionSetup.jsx'
import { ExerciseCard } from '../components/ExerciseCard.jsx'
import { ManualExerciseTools } from '../components/ManualExerciseTools.jsx'
import { PracticeSettings } from '../components/PracticeSettings.jsx'
import { ProfilePage } from '../components/ProfilePage.jsx'
import { SessionSummary } from '../components/SessionSummary.jsx'
import { VerbTenseExercise } from '../components/VerbTenseExercise.jsx'
import { VerbTenseSetup } from '../components/VerbTenseSetup.jsx'
import {
  exerciseTypes,
  getSampleExercise,
  topics,
  vocabularyChapters,
  vocabularyExerciseTypes,
} from '../data/exerciseOptions.js'
import {
  declensionOptions,
  getDeclensionExercise,
} from '../data/declensionExercises.js'
import {
  getVerbFamiliesForTense,
  verbTenseOptions,
} from '../data/verbTenseOptions.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import {
  createExercisePrompt,
  generateExercise,
  importExercises,
} from '../services/exerciseService.js'
import {
  createPracticeSession,
  deletePracticeSession,
  getPracticeSessions,
  updatePracticeSession,
} from '../services/practiceSessionService.js'
import {
  getProfileSettings,
  getVocabularyMetrics,
  updateProfileSettings,
} from '../services/profileSettingsService.js'
import { evaluateAnswer } from '../utils/answerEvaluation.js'
import {
  buildDeclensionPrompt,
  readDeclensionExerciseFromPastedJson,
} from '../utils/declensionImport.js'
import {
  inferExerciseTypeFromExercises,
  readExercisesFromPastedJson,
} from '../utils/exerciseImport.js'
import {
  buildVerbTensePrompt,
  getPracticedVerbLemmas,
  readVerbTenseExerciseFromPastedJson,
} from '../utils/verbTenseImport.js'

export function PracticePage({ onLogout }) {
  const [activeSection, setActiveSection] = useState('verb_tenses')
  const [selectedTopic, setSelectedTopic] = useState('verb_tenses')
  const [selectedVocabularyFrom, setSelectedVocabularyFrom] = useState(1)
  const [selectedVocabularyTo, setSelectedVocabularyTo] = useState(5)
  const [selectedType, setSelectedType] = useState('multiple_choice')
  const [selectedDeclension, setSelectedDeclension] = useState('first')
  const [declensionSessionKey, setDeclensionSessionKey] = useState(0)
  const [importedDeclensionExercise, setImportedDeclensionExercise] = useState(null)
  const [hasStartedDeclensionPractice, setHasStartedDeclensionPractice] = useState(false)
  const [selectedVerbTense, setSelectedVerbTense] = useState('present')
  const [includePassive, setIncludePassive] = useState(false)
  const [verbTenseSessionKey, setVerbTenseSessionKey] = useState(0)
  const [importedVerbTenseExercise, setImportedVerbTenseExercise] = useState(null)
  const [hasStartedVerbTensePractice, setHasStartedVerbTensePractice] = useState(false)
  const [exerciseList, setExerciseList] = useState([])
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [answerStateByExercise, setAnswerStateByExercise] = useState({})
  const [manualPrompt, setManualPrompt] = useState('')
  const [importText, setImportText] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(true)
  const [isSessionFinished, setIsSessionFinished] = useState(false)
  const [practiceSessions, setPracticeSessions] = useState([])
  const [isProfileLoading, setIsProfileLoading] = useState(true)
  const [deletingPracticeId, setDeletingPracticeId] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [isSavingProfileSettings, setIsSavingProfileSettings] = useState(false)
  const [profileSettingsMessage, setProfileSettingsMessage] = useState('')
  const [vocabularyMetrics, setVocabularyMetrics] = useState(null)
  const [isVocabularyMetricsLoading, setIsVocabularyMetricsLoading] = useState(true)
  const [vocabularyMetricsError, setVocabularyMetricsError] = useState('')
  const [activePracticeSessionId, setActivePracticeSessionId] = useState(null)
  const [declensionProgress, setDeclensionProgress] = useState(null)
  const [verbTenseProgress, setVerbTenseProgress] = useState(null)
  const [activePracticeScope, setActivePracticeScope] = useState(null)
  const [adaptiveResumeSessionId, setAdaptiveResumeSessionId] = useState(null)
  const [combinedResumeSession, setCombinedResumeSession] = useState(null)
  const vocabularyCompletionRecorded = useRef(false)
  const currentPracticeCompleted = useRef(false)

  const topic = topics.find((item) => item.id === selectedTopic)
  const declension = declensionOptions.find((item) => item.id === selectedDeclension)
  const declensionExercise =
    importedDeclensionExercise || getDeclensionExercise(selectedDeclension)
  const isDeclensionMode = selectedTopic === 'declinaciones'
  const isVerbTenseMode = selectedTopic === 'verb_tenses'
  const isVocabularyMode = selectedTopic === 'vocabulary'
  const isCombinedMode = selectedTopic === 'combined'
  const isProfileMode = activeSection === 'profile'
  const verbTense = verbTenseOptions.find((item) => item.id === selectedVerbTense)
  const verbFamilies = getVerbFamiliesForTense(selectedVerbTense)
  const availableExerciseTypes = isVocabularyMode ? vocabularyExerciseTypes : exerciseTypes
  const selectedExerciseType = exerciseTypes.find((item) => item.id === selectedType)
  const exercise = exerciseList[currentExerciseIndex] || getSampleExercise(selectedTopic, selectedType)
  const exerciseKey = getExerciseKey(exercise, currentExerciseIndex)
  const currentExerciseType = exercise.exerciseType || selectedType
  const currentAnswerState = answerStateByExercise[exerciseKey] || {
    selectedAnswer: '',
    showFeedback: false,
    evaluation: null,
  }
  const hasExerciseList = exerciseList.length > 0
  const visibleExerciseList = hasExerciseList ? exerciseList : [exercise]
  const hasSavableCurrentPractice =
    (isVerbTenseMode && hasStartedVerbTensePractice && importedVerbTenseExercise) ||
    (isDeclensionMode && hasStartedDeclensionPractice && importedDeclensionExercise) ||
    (isVocabularyMode &&
      hasExerciseList &&
      !visibleExerciseList.some((item) => ['local_sample', 'mock'].includes(item.source)))
  const practicedVerbLemmas = useMemo(
    () => getPracticedVerbLemmas(practiceSessions),
    [practiceSessions],
  )
  const practiceChapterFrom = activePracticeScope?.chapterFrom ?? selectedVocabularyFrom
  const practiceChapterTo = activePracticeScope?.chapterTo ?? selectedVocabularyTo

  const backendPayload = useMemo(
    () => ({
      topic: selectedTopic,
      vocabularyLevel: 1,
      vocabularyChapterFrom: selectedVocabularyFrom,
      vocabularyChapterTo: selectedVocabularyTo,
      exerciseType: selectedType,
    }),
    [selectedTopic, selectedType, selectedVocabularyFrom, selectedVocabularyTo],
  )

  useEffect(() => {
    let isActive = true

    getPracticeSessions()
      .then((sessions) => {
        if (!isActive) return
        setPracticeSessions(sessions)
        setProfileError('')
      })
      .catch((error) => {
        if (!isActive) return
        setProfileError(`No pudimos cargar tu historial. ${getApiErrorMessage(error)}`)
      })
      .finally(() => {
        if (isActive) setIsProfileLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!isProfileMode) return undefined

    let isActive = true

    getVocabularyMetrics(selectedVocabularyFrom, selectedVocabularyTo)
      .then((metrics) => {
        if (!isActive) return
        setVocabularyMetrics(metrics)
        setVocabularyMetricsError('')
      })
      .catch((error) => {
        if (!isActive) return
        setVocabularyMetricsError(
          `No pudimos cargar tu dominio de vocabulario. ${getApiErrorMessage(error)}`,
        )
      })
      .finally(() => {
        if (isActive) setIsVocabularyMetricsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [isProfileMode, selectedVocabularyFrom, selectedVocabularyTo])

  useEffect(() => {
    let isActive = true

    getProfileSettings()
      .then((settings) => {
        if (!isActive) return
        setSelectedVocabularyFrom(settings.vocabularyChapterFrom)
        setSelectedVocabularyTo(settings.vocabularyChapterTo)
      })
      .catch((error) => {
        if (!isActive) return
        setProfileSettingsMessage(
          `No pudimos cargar el rango guardado. ${getApiErrorMessage(error)}`,
        )
      })

    return () => {
      isActive = false
    }
  }, [])

  const handleDeclensionProgress = useCallback((progress) => {
    setDeclensionProgress(progress)
  }, [])

  const handleVerbTenseProgress = useCallback((progress) => {
    setVerbTenseProgress(progress)
  }, [])

  function resetContext() {
    setExerciseList([])
    setCurrentExerciseIndex(0)
    setAnswerStateByExercise({})
    setManualPrompt('')
    setImportText('')
    setStatusMessage('')
    setIsSessionFinished(false)
    setImportedDeclensionExercise(null)
    setHasStartedDeclensionPractice(false)
    setImportedVerbTenseExercise(null)
    setHasStartedVerbTensePractice(false)
    setActivePracticeSessionId(null)
    setDeclensionProgress(null)
    setActivePracticeScope(null)
    setVerbTenseProgress(null)
    setAdaptiveResumeSessionId(null)
    setCombinedResumeSession(null)
    vocabularyCompletionRecorded.current = false
    currentPracticeCompleted.current = false
  }

  async function handleTopicChange(topicId) {
    if (!(await saveCurrentPracticeDraft())) return

    setActiveSection(topicId)
    setSelectedTopic(topicId)
    setShowSettings(true)

    if (topicId === 'vocabulary') {
      setSelectedType('multiple_choice')
    }

    resetContext()
  }

  async function handleNavigation(sectionId) {
    if (!(await saveCurrentPracticeDraft())) return

    if (sectionId === 'profile') {
      resetContext()
      setActiveSection('profile')
      return
    }

    setActiveSection(sectionId)
    setSelectedTopic(sectionId)
    setShowSettings(true)

    if (sectionId === 'vocabulary') {
      setSelectedType('multiple_choice')
    }

    resetContext()
  }

  async function handleVocabularyRangeChange(chapterFrom, chapterTo) {
    const previousFrom = selectedVocabularyFrom
    const previousTo = selectedVocabularyTo

    setSelectedVocabularyFrom(chapterFrom)
    setSelectedVocabularyTo(chapterTo)
    setIsSavingProfileSettings(true)
    setProfileSettingsMessage('Guardando preferencia...')
    resetContext()

    try {
      const settings = await updateProfileSettings({
        vocabularyChapterFrom: chapterFrom,
        vocabularyChapterTo: chapterTo,
      })
      setSelectedVocabularyFrom(settings.vocabularyChapterFrom)
      setSelectedVocabularyTo(settings.vocabularyChapterTo)
      setProfileSettingsMessage('Rango guardado y aplicado a todas las prácticas.')
    } catch (error) {
      setSelectedVocabularyFrom(previousFrom)
      setSelectedVocabularyTo(previousTo)
      setProfileSettingsMessage(`No pudimos guardar el rango. ${getApiErrorMessage(error)}`)
    } finally {
      setIsSavingProfileSettings(false)
    }
  }

  async function handleTypeChange(typeId) {
    if (!(await saveCurrentPracticeDraft())) return
    setSelectedType(typeId)
    resetContext()
  }

  async function handleDeclensionChange(declensionId) {
    if (!(await saveCurrentPracticeDraft())) return
    setSelectedDeclension(declensionId)
    setDeclensionSessionKey((current) => current + 1)
    setImportedDeclensionExercise(null)
    setHasStartedDeclensionPractice(false)
    setManualPrompt('')
    setImportText('')
    setStatusMessage('')
    setActivePracticeSessionId(null)
    setDeclensionProgress(null)
    setActivePracticeScope(null)
    currentPracticeCompleted.current = false
  }

  async function handleVerbTenseChange(tenseId) {
    if (!(await saveCurrentPracticeDraft())) return
    setSelectedVerbTense(tenseId)
    setVerbTenseSessionKey((current) => current + 1)
    setImportedVerbTenseExercise(null)
    setHasStartedVerbTensePractice(false)
    setManualPrompt('')
    setImportText('')
    setStatusMessage('')
    setActivePracticeSessionId(null)
    setVerbTenseProgress(null)
    setActivePracticeScope(null)
    currentPracticeCompleted.current = false
  }

  async function handleIncludePassiveChange(shouldIncludePassive) {
    if (!(await saveCurrentPracticeDraft())) return
    setIncludePassive(shouldIncludePassive)
    setVerbTenseSessionKey((current) => current + 1)
    setImportedVerbTenseExercise(null)
    setHasStartedVerbTensePractice(false)
    setManualPrompt('')
    setImportText('')
    setStatusMessage('')
    setActivePracticeSessionId(null)
    setVerbTenseProgress(null)
    setActivePracticeScope(null)
    currentPracticeCompleted.current = false
  }

  async function handleGenerateFromBackend() {
    if (!(await saveCurrentPracticeDraft())) return

    if (isVerbTenseMode) {
      if (!importedVerbTenseExercise) {
        setStatusMessage(
          `Primero importa los ${verbFamilies.length} verbos generados por la IA.`,
        )
        return
      }

      setVerbTenseSessionKey((current) => current + 1)
      setHasStartedVerbTensePractice(true)
      setActivePracticeSessionId(null)
      setVerbTenseProgress(null)
      currentPracticeCompleted.current = false
      setShowSettings(false)
      setStatusMessage(`Practica de ${verbTense.label} lista.`)
      return
    }

    if (isDeclensionMode) {
      setDeclensionSessionKey((current) => current + 1)
      setHasStartedDeclensionPractice(true)
      setActivePracticeSessionId(null)
      setDeclensionProgress(null)
      currentPracticeCompleted.current = false
      setShowSettings(false)
      setStatusMessage(
        importedDeclensionExercise
          ? `Practica con ${declensionExercise.word} lista.`
          : `Practica modelo de ${declension.label} lista.`,
      )
      return
    }

    setIsLoading(true)
    setStatusMessage('')

    try {
      const generated = await generateExercise(backendPayload)
      setActivePracticeScope(null)
      setExerciseList([generated])
      setCurrentExerciseIndex(0)
      setAnswerStateByExercise({})
      setIsSessionFinished(false)
      setActivePracticeSessionId(null)
      currentPracticeCompleted.current = false
      vocabularyCompletionRecorded.current = false
      setStatusMessage('Ejercicio generado y guardado.')
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateManualPrompt() {
    if (isVerbTenseMode) {
      setManualPrompt(
        buildVerbTensePrompt(verbTense, {
          includePassive,
          excludedVerbs: practicedVerbLemmas,
          chapterFrom: selectedVocabularyFrom,
          chapterTo: selectedVocabularyTo,
        }),
      )
      setStatusMessage('Prompt listo. Copialo, pegalo en tu IA e importa el JSON resultante.')
      return
    }

    if (isDeclensionMode) {
      setManualPrompt(
        buildDeclensionPrompt(declension, {
          chapterFrom: selectedVocabularyFrom,
          chapterTo: selectedVocabularyTo,
        }),
      )
      setStatusMessage('Prompt listo. Copialo, pegalo en tu IA e importa el JSON resultante.')
      return
    }

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
    if (!(await saveCurrentPracticeDraft())) return

    setIsLoading(true)
    setStatusMessage('')

    try {
      if (isVerbTenseMode) {
        const importedExercise = readVerbTenseExerciseFromPastedJson(
          importText,
          selectedVerbTense,
          { includePassive, excludedVerbs: practicedVerbLemmas },
        )

        setImportedVerbTenseExercise(importedExercise)
        setHasStartedVerbTensePractice(false)
        setActivePracticeSessionId(null)
        setVerbTenseProgress(null)
        setActivePracticeScope(null)
        currentPracticeCompleted.current = false
        setVerbTenseSessionKey((current) => current + 1)
        setImportText('')
        setShowSettings(true)
        setStatusMessage(
          `Los ${importedExercise.verbs.length} verbos y ${importedExercise.sentences.length} oraciones estan listos.`,
        )
        return
      }

      if (isDeclensionMode) {
        const importedExercise = readDeclensionExerciseFromPastedJson(
          importText,
          selectedDeclension,
        )

        setImportedDeclensionExercise(importedExercise)
        setHasStartedDeclensionPractice(false)
        setActivePracticeSessionId(null)
        setDeclensionProgress(null)
        setActivePracticeScope(null)
        currentPracticeCompleted.current = false
        setDeclensionSessionKey((current) => current + 1)
        setImportText('')
        setShowSettings(true)
        setStatusMessage(
          `${importedExercise.word} y sus 10 oraciones estan listos para comenzar.`,
        )
        return
      }

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
      setIsSessionFinished(false)
      setActivePracticeSessionId(null)
      setActivePracticeScope(null)
      currentPracticeCompleted.current = false
      vocabularyCompletionRecorded.current = false
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

  function handlePreviousExercise() {
    setCurrentExerciseIndex((currentIndex) => Math.max(currentIndex - 1, 0))
  }

  function handleNextExercise() {
    setCurrentExerciseIndex((currentIndex) =>
      Math.min(currentIndex + 1, exerciseList.length - 1),
    )
  }

  function getExerciseKey(item, index) {
    return item.id || `${selectedTopic}-sample-${index}`
  }

  function getSessionResults() {
    return visibleExerciseList.map((item, index) => {
      const key = getExerciseKey(item, index)
      const answerState = answerStateByExercise[key]
      const status = answerState?.selectedAnswer
        ? answerState?.evaluation?.status || 'unanswered'
        : 'unanswered'

      return {
        exercise: item,
        exerciseKey: key,
        selectedAnswer: answerState?.selectedAnswer || '',
        status,
      }
    })
  }

  function getDefaultDeclensionProgress() {
    return {
      phase: 'table',
      tableAnswers: {},
      tableResults: null,
      sentenceAnswers: declensionExercise.sentences.map(() => ''),
      sentenceResults: null,
    }
  }

  function getDefaultVerbTenseProgress() {
    return {
      phase: 'tables',
      currentVerbIndex: 0,
      tableAnswers: importedVerbTenseExercise.verbs.map(() => ({})),
      tableResults: importedVerbTenseExercise.verbs.map(() => null),
      sentenceAnswers: importedVerbTenseExercise.sentences.map(() => ''),
      sentenceResults: null,
    }
  }

  function countFilledAnswers(values) {
    return values.filter((value) => typeof value === 'string' && value.trim()).length
  }

  function buildVocabularySessionPayload(status, progressOverride = null) {
    const usesDefaultExercises =
      !hasExerciseList ||
      visibleExerciseList.some((item) => ['local_sample', 'mock'].includes(item.source))

    if (usesDefaultExercises) return null

    const progress = progressOverride || {
      currentExerciseIndex,
      answerStateByExercise,
      isSessionFinished: false,
    }
    const results = getSessionResults()
    const answeredResults = results.filter((result) => result.selectedAnswer.trim())
    const correctAnswers = results.filter((result) => result.status === 'correct').length

    return {
      practiceKind: 'vocabulary',
      practiceLabel: 'Vocabulario',
      detailLabel: `Caps. ${practiceChapterFrom}-${practiceChapterTo} · ${selectedExerciseType?.label || 'Ejercicios'}`,
      status,
      correctAnswers,
      totalAnswers: status === 'completed' ? results.length : answeredResults.length,
      activityData: {
        chapterFrom: practiceChapterFrom,
        chapterTo: practiceChapterTo,
        exerciseType: selectedType,
        exercises: visibleExerciseList,
        expectedTotalAnswers: results.length,
        progress,
      },
    }
  }

  function buildDeclensionSessionPayload(
    status,
    progressOverride = declensionProgress || getDefaultDeclensionProgress(),
    completedResults = null,
  ) {
    if (!importedDeclensionExercise) return null

    const answeredCount =
      countFilledAnswers(Object.values(progressOverride.tableAnswers || {})) +
      countFilledAnswers(progressOverride.sentenceAnswers || [])
    const correctCount = [
      ...Object.values(progressOverride.tableResults || {}),
      ...(progressOverride.sentenceResults || []),
    ].filter((result) => result?.status === 'correct').length
    const expectedTotalAnswers = 12 + declensionExercise.sentences.length

    return {
      practiceKind: 'declension',
      practiceLabel: 'Declinaciones',
      detailLabel: `${declension.label} · ${declensionExercise.word} · Caps. ${practiceChapterFrom}-${practiceChapterTo}`,
      status,
      correctAnswers: completedResults?.correctAnswers ?? correctCount,
      totalAnswers: completedResults?.totalAnswers ?? answeredCount,
      activityData: {
        declensionId: selectedDeclension,
        chapterFrom: practiceChapterFrom,
        chapterTo: practiceChapterTo,
        exercise: declensionExercise,
        expectedTotalAnswers,
        progress: progressOverride,
      },
    }
  }

  function buildVerbTenseSessionPayload(
    status,
    progressOverride = verbTenseProgress || getDefaultVerbTenseProgress(),
    completedResults = null,
  ) {
    if (!importedVerbTenseExercise) return null

    const tableAnswerValues = (progressOverride.tableAnswers || []).flatMap((answers) =>
      Object.values(answers || {}),
    )
    const tableResultValues = (progressOverride.tableResults || []).flatMap((results) =>
      Object.values(results || {}),
    )
    const answeredCount =
      countFilledAnswers(tableAnswerValues) +
      countFilledAnswers(progressOverride.sentenceAnswers || [])
    const correctCount = [
      ...tableResultValues,
      ...(progressOverride.sentenceResults || []),
    ].filter((result) => result?.status === 'correct').length
    const columnsPerPerson = includePassive ? 4 : 2
    const expectedTotalAnswers =
      importedVerbTenseExercise.verbs.length *
        importedVerbTenseExercise.verbs[0].table.length *
        columnsPerPerson +
      importedVerbTenseExercise.sentences.length

    return {
      practiceKind: 'verb_tense',
      practiceLabel: 'Tiempos verbales',
      detailLabel: `${verbTense.label} · ${includePassive ? 'Activa y pasiva' : 'Activa'} · ${importedVerbTenseExercise.verbs.length} verbos · Caps. ${practiceChapterFrom}-${practiceChapterTo}`,
      status,
      correctAnswers: completedResults?.correctAnswers ?? correctCount,
      totalAnswers: completedResults?.totalAnswers ?? answeredCount,
      activityData: {
        tenseId: selectedVerbTense,
        includePassive,
        chapterFrom: practiceChapterFrom,
        chapterTo: practiceChapterTo,
        exercise: importedVerbTenseExercise,
        expectedTotalAnswers,
        progress: progressOverride,
      },
    }
  }

  async function storePracticeSession(session, { silent = false } = {}) {
    try {
      const savedSession = activePracticeSessionId
        ? await updatePracticeSession(activePracticeSessionId, session)
        : await createPracticeSession(session)
      setPracticeSessions((current) => [
        savedSession,
        ...current.filter((item) => item.id !== savedSession.id),
      ])
      if (session.status === 'in_progress') {
        setActivePracticeSessionId(savedSession.id)
      }
      setProfileError('')
      if (!silent) {
        setStatusMessage(
          session.status === 'completed'
            ? 'Práctica terminada y guardada en tu perfil.'
            : 'Avance guardado en tu perfil.',
        )
      }
      return savedSession
    } catch (error) {
      const message = getApiErrorMessage(error)
      setProfileError(`No pudimos guardar la última práctica. ${message}`)
      setStatusMessage('No pudimos guardar el avance. Inténtalo nuevamente antes de salir.')
      return null
    }
  }

  async function saveCurrentPracticeDraft() {
    if (currentPracticeCompleted.current) return true

    let session = null

    if (isVerbTenseMode && hasStartedVerbTensePractice && importedVerbTenseExercise) {
      session = buildVerbTenseSessionPayload('in_progress')
    } else if (
      isDeclensionMode &&
      hasStartedDeclensionPractice &&
      importedDeclensionExercise
    ) {
      session = buildDeclensionSessionPayload('in_progress')
    } else if (isVocabularyMode && hasExerciseList) {
      session = buildVocabularySessionPayload('in_progress')
    }

    if (!session) return true

    return Boolean(await storePracticeSession(session, { silent: true }))
  }

  function handleFinishSession() {
    setIsSessionFinished(true)

    if (vocabularyCompletionRecorded.current) return
    vocabularyCompletionRecorded.current = true

    const session = buildVocabularySessionPayload('completed', {
      currentExerciseIndex,
      answerStateByExercise,
      isSessionFinished: true,
    })

    if (!session) {
      setStatusMessage('La practica predeterminada no se guarda en tu perfil.')
      return
    }

    currentPracticeCompleted.current = true
    storePracticeSession(session)
  }

  function handleDeclensionComplete({ correctAnswers, totalAnswers, progress }) {
    if (!importedDeclensionExercise) {
      setStatusMessage('La practica modelo no se guarda en tu perfil.')
      return
    }

    setDeclensionProgress(progress)
    currentPracticeCompleted.current = true
    storePracticeSession(
      buildDeclensionSessionPayload('completed', progress, {
        correctAnswers,
        totalAnswers,
      }),
    )
  }

  function handleVerbTenseComplete({ correctAnswers, totalAnswers, progress }) {
    setVerbTenseProgress(progress)
    currentPracticeCompleted.current = true
    storePracticeSession(
      buildVerbTenseSessionPayload('completed', progress, {
        correctAnswers,
        totalAnswers,
      }),
    )
  }

  function handleReplayPractice(session) {
    try {
      const activity =
        typeof session.activityData === 'string'
          ? JSON.parse(session.activityData)
          : session.activityData
      const isInProgress = session.status === 'in_progress'
      const savedProgress = isInProgress ? activity.progress || null : null

      resetContext()
      setShowSettings(false)
      setActivePracticeSessionId(isInProgress ? session.id : null)
      setActivePracticeScope({
        chapterFrom: activity.chapterFrom || selectedVocabularyFrom,
        chapterTo: activity.chapterTo || selectedVocabularyTo,
      })
      currentPracticeCompleted.current = false

      if (session.practiceKind === 'vocabulary' && activity.adaptive) {
        setActiveSection('vocabulary')
        setSelectedTopic('vocabulary')
        setAdaptiveResumeSessionId(session.id)
        setStatusMessage(
          isInProgress
            ? 'Práctica adaptativa retomada.'
            : 'Práctica adaptativa terminada abierta en modo resumen.',
        )
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      if (session.practiceKind === 'combined') {
        setActiveSection('combined')
        setSelectedTopic('combined')
        setCombinedResumeSession(session)
        setStatusMessage(
          isInProgress
            ? 'Práctica combinada retomada.'
            : 'Práctica combinada lista para realizar nuevamente.',
        )
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      if (session.practiceKind === 'verb_tense') {
        setActiveSection('verb_tenses')
        setSelectedTopic('verb_tenses')
        setSelectedVerbTense(activity.tenseId)
        setIncludePassive(Boolean(activity.includePassive ?? activity.exercise?.includePassive))
        setImportedVerbTenseExercise(activity.exercise)
        setVerbTenseProgress(savedProgress)
        setHasStartedVerbTensePractice(true)
        setVerbTenseSessionKey((current) => current + 1)
      } else if (session.practiceKind === 'declension') {
        setActiveSection('declinaciones')
        setSelectedTopic('declinaciones')
        setSelectedDeclension(activity.declensionId)
        setImportedDeclensionExercise(activity.exercise)
        setDeclensionProgress(savedProgress)
        setHasStartedDeclensionPractice(true)
        setDeclensionSessionKey((current) => current + 1)
      } else {
        setActiveSection('vocabulary')
        setSelectedTopic('vocabulary')
        setSelectedType(activity.exerciseType)
        setExerciseList(activity.exercises)
        setCurrentExerciseIndex(savedProgress?.currentExerciseIndex || 0)
        setAnswerStateByExercise(savedProgress?.answerStateByExercise || {})
        setIsSessionFinished(false)
      }

      setStatusMessage(
        isInProgress
          ? 'Práctica retomada desde el último avance guardado.'
          : 'Práctica guardada lista para comenzar otra vez.',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setProfileError('Esta practica guardada no se pudo abrir.')
    }
  }

  async function handleDeletePractice(session) {
    const confirmed = window.confirm(
      `¿Quieres eliminar la práctica "${session.detailLabel}"? Esta acción no se puede deshacer.`,
    )

    if (!confirmed) return

    setDeletingPracticeId(session.id)
    setProfileError('')

    try {
      await deletePracticeSession(session.id)
      setPracticeSessions((current) => current.filter((item) => item.id !== session.id))
    } catch (error) {
      setProfileError(`No pudimos eliminar la practica. ${getApiErrorMessage(error)}`)
    } finally {
      setDeletingPracticeId(null)
    }
  }

  function handleContinuePractice() {
    setIsSessionFinished(false)
  }

  function handleRestartPractice() {
    setActivePracticeSessionId(null)
    currentPracticeCompleted.current = false
    vocabularyCompletionRecorded.current = false
  }

  function handleReviewMistakes() {
    const reviewExercises = getSessionResults()
      .filter((result) => result.status !== 'correct')
      .map((result) => result.exercise)

    if (reviewExercises.length === 0) return

    setExerciseList(reviewExercises)
    setCurrentExerciseIndex(0)
    setAnswerStateByExercise({})
    setIsSessionFinished(false)
    vocabularyCompletionRecorded.current = false
    setShowSettings(false)
    setStatusMessage(`${reviewExercises.length} ejercicio(s) para repasar.`)
  }

  async function handleAdaptiveSessionUpdated() {
    try {
      const [sessions, metrics] = await Promise.all([
        getPracticeSessions(),
        getVocabularyMetrics(selectedVocabularyFrom, selectedVocabularyTo),
      ])
      setPracticeSessions(sessions)
      setVocabularyMetrics(metrics)
      setProfileError('')
      setVocabularyMetricsError('')
    } catch (error) {
      setProfileError(`No pudimos actualizar tu perfil. ${getApiErrorMessage(error)}`)
    }
  }

  return (
    <main className="app-shell">
      <AppNavigation
        activeSection={activeSection}
        onNavigate={handleNavigation}
        onLogout={onLogout}
      />

      {isProfileMode ? (
        <ProfilePage
          sessions={practiceSessions}
          isLoading={isProfileLoading}
          errorMessage={profileError}
          vocabularyChapters={vocabularyChapters}
          vocabularyChapterFrom={selectedVocabularyFrom}
          vocabularyChapterTo={selectedVocabularyTo}
          isSavingSettings={isSavingProfileSettings}
          settingsMessage={profileSettingsMessage}
          vocabularyMetrics={vocabularyMetrics}
          isVocabularyMetricsLoading={isVocabularyMetricsLoading}
          vocabularyMetricsError={vocabularyMetricsError}
          deletingPracticeId={deletingPracticeId}
          onVocabularyRangeChange={handleVocabularyRangeChange}
          onDelete={handleDeletePractice}
          onReplay={handleReplayPractice}
          onStartPractice={() => handleTopicChange('verb_tenses')}
        />
      ) : isCombinedMode ? (
        <CombinedPractice
          key={combinedResumeSession?.id || 'combined-new'}
          chapterFrom={practiceChapterFrom}
          chapterTo={practiceChapterTo}
          resumeSession={combinedResumeSession}
          onSessionUpdated={handleAdaptiveSessionUpdated}
        />
      ) : isVocabularyMode ? (
        <AdaptiveVocabularyPractice
          chapterFrom={selectedVocabularyFrom}
          chapterTo={selectedVocabularyTo}
          resumeSessionId={adaptiveResumeSessionId}
          onSessionUpdated={handleAdaptiveSessionUpdated}
        />
      ) : (
        <>
          <div className="settings-toggle-row">
        <button
          className="secondary-action"
          type="button"
          onClick={() => setShowSettings((currentValue) => !currentValue)}
        >
          {showSettings ? 'Ocultar configuracion' : 'Mostrar configuracion'}
        </button>
        {hasSavableCurrentPractice && (
          <p className="auto-save-note">Tu avance se guardará al cambiar de práctica.</p>
        )}
        {!showSettings && statusMessage && <p className="status-message">{statusMessage}</p>}
          </div>

          <section
            className={showSettings ? 'workspace' : 'workspace settings-hidden'}
            aria-label="Configuracion y ejercicio"
          >
        {showSettings && (
          <PracticeSettings
            topics={topics}
            exerciseTypes={availableExerciseTypes}
            selectedTopic={selectedTopic}
            selectedVocabularyFrom={selectedVocabularyFrom}
            selectedVocabularyTo={selectedVocabularyTo}
            selectedType={selectedType}
            selectedDeclension={selectedDeclension}
            selectedVerbTense={selectedVerbTense}
            includePassive={includePassive}
            topic={topic}
            declensions={declensionOptions}
            verbTenses={verbTenseOptions}
            isDeclensionMode={isDeclensionMode}
            isVerbTenseMode={isVerbTenseMode}
            importedDeclensionWord={importedDeclensionExercise?.word}
            importedVerbCount={importedVerbTenseExercise?.verbs.length || 0}
            expectedVerbCount={verbFamilies.length}
            showTopicSelector={false}
            isLoading={isLoading}
            statusMessage={statusMessage}
            onTopicChange={handleTopicChange}
            onTypeChange={handleTypeChange}
            onDeclensionChange={handleDeclensionChange}
            onVerbTenseChange={handleVerbTenseChange}
            onIncludePassiveChange={handleIncludePassiveChange}
            onGenerateFromBackend={handleGenerateFromBackend}
            onCreateManualPrompt={handleCreateManualPrompt}
          />
        )}

        {isVerbTenseMode ? (
          hasStartedVerbTensePractice ? (
            <VerbTenseExercise
              key={`${selectedVerbTense}-${verbTenseSessionKey}`}
              tense={verbTense}
              exercise={importedVerbTenseExercise}
              initialProgress={verbTenseProgress}
              onProgress={handleVerbTenseProgress}
              onRestart={handleRestartPractice}
              onComplete={handleVerbTenseComplete}
            />
          ) : (
            <VerbTenseSetup
              tense={verbTense}
              exercise={importedVerbTenseExercise}
              hasPrompt={Boolean(manualPrompt)}
              expectedFamilyCount={verbFamilies.length}
              includePassive={includePassive}
            />
          )
        ) : isDeclensionMode ? (
          hasStartedDeclensionPractice ? (
            <DeclensionExercise
              key={`${selectedDeclension}-${declensionSessionKey}`}
              declension={declension}
              exercise={declensionExercise}
              initialProgress={declensionProgress}
              onProgress={handleDeclensionProgress}
              onRestart={handleRestartPractice}
              onComplete={handleDeclensionComplete}
            />
          ) : (
            <DeclensionSetup
              declension={declension}
              exercise={declensionExercise}
              hasPrompt={Boolean(manualPrompt)}
              isImported={Boolean(importedDeclensionExercise)}
            />
          )
        ) : isSessionFinished ? (
          <SessionSummary
            results={getSessionResults()}
            onReviewMistakes={handleReviewMistakes}
            onContinuePractice={handleContinuePractice}
          />
        ) : (
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
            isLastExercise={!hasExerciseList || currentExerciseIndex === exerciseList.length - 1}
            onAnswerSelect={handleAnswerSelect}
            onTextAnswerChange={handleTextAnswerChange}
            onTextAnswerSubmit={handleTextAnswerSubmit}
            onPreviousExercise={handlePreviousExercise}
            onNextExercise={handleNextExercise}
            onFinishSession={handleFinishSession}
          />
        )}
          </section>

          <ManualExerciseTools
            manualPrompt={manualPrompt}
            importText={importText}
            isLoading={isLoading}
            mode={isDeclensionMode ? 'declension' : isVerbTenseMode ? 'verb_tense' : 'exercises'}
            onCopyPrompt={handleCopyPrompt}
            onImportTextChange={setImportText}
            onImportExercises={handleImportExercises}
          />

          {!isDeclensionMode && !isVerbTenseMode && <ApiPreview payload={backendPayload} />}
        </>
      )}
    </main>
  )
}
