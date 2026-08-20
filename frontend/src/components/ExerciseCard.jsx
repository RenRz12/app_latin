function getAnswerOptionClass(option, selectedAnswer, evaluation) {
  const classes = ['answer-option']

  if (selectedAnswer === option) {
    classes.push('selected')

    if (evaluation?.status) {
      classes.push(getVisualStatus(evaluation.status))
    }
  }

  return classes.join(' ')
}

function getFeedbackClass(evaluation) {
  return `feedback ${getVisualStatus(evaluation?.status)}`
}

function getVisualStatus(status) {
  const normalized = String(status || 'revealed').toLowerCase()
  if (normalized === 'partial') return 'almost'
  return normalized
}

function getFeedbackTitle(evaluation) {
  return evaluation?.label || 'Respuesta'
}

export function ExerciseCard({
  exercise,
  exerciseType,
  selectedAnswer,
  showFeedback,
  evaluation,
  currentIndex,
  totalExercises,
  canGoPrevious,
  canGoNext,
  isLastExercise,
  canFinish = true,
  onAnswerSelect,
  onTextAnswerChange,
  onTextAnswerSubmit,
  onPreviousExercise,
  onNextExercise,
  onFinishSession,
}) {
  const isMultipleChoice = [
    'multiple_choice',
    'VOCABULARY_MULTIPLE_CHOICE',
    'INFLECTION_MULTIPLE_CHOICE',
  ].includes(exerciseType)
  const feedbackTitle = getFeedbackTitle(evaluation)

  function goToNextExercise() {
    if (isLastExercise) {
      onFinishSession()
      return
    }

    onNextExercise()
  }

  function handleKeyboardNavigation(event) {
    if (event.key !== 'Enter' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    if (showFeedback) {
      event.preventDefault()
      event.stopPropagation()
      goToNextExercise()
      return
    }

    if (!isMultipleChoice && selectedAnswer.trim()) {
      event.preventDefault()
      onTextAnswerSubmit()
    }
  }

  return (
    <section
      className="exercise-panel"
      aria-labelledby="exercise-title"
      onKeyDownCapture={handleKeyboardNavigation}
    >
      <p className="exercise-kicker">
        Pregunta {currentIndex + 1} de {totalExercises}
      </p>

      <h2 id="exercise-title" className="sr-only">
        Ejercicio
      </h2>
      {exercise.prompt && (
        <p className="exercise-instruction">{exercise.prompt}</p>
      )}
      <div className="latin-sentence">{exercise.question}</div>

      {isMultipleChoice ? (
        <div className="answer-options" role="radiogroup" aria-label="Respuestas">
          {exercise.options.map((option) => (
            <button
              className={getAnswerOptionClass(option, selectedAnswer, evaluation)}
              key={option}
              type="button"
              onClick={() => onAnswerSelect(option)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-answer-field">
          <label htmlFor="text-answer">Tu respuesta</label>
          <input
            id="text-answer"
            type="text"
            value={selectedAnswer}
            onChange={(event) => onTextAnswerChange(event.target.value)}
            placeholder={
              ['translation_la_es', 'translation_es_la', 'TRANSLATION_LA_ES',
                'TRANSLATION_ES_LA'].includes(exerciseType)
                ? 'Escribí tu traducción'
                : 'Escribí tu respuesta'
            }
          />
        </div>
      )}

      {!isMultipleChoice && (
        <div className="exercise-actions">
          <button
            className="secondary-action"
            type="button"
            disabled={!selectedAnswer}
            onClick={onTextAnswerSubmit}
          >
            Revisar respuesta
          </button>
        </div>
      )}

      {showFeedback && (
        <div className={getFeedbackClass(evaluation)} role="status">
          <strong>{feedbackTitle}</strong>
          <p>
            <b>Respuesta correcta:</b> {exercise.correctAnswer}
          </p>
          <p>{exercise.explanation}</p>
        </div>
      )}

      <div className="exercise-navigation">
        <button
          className="secondary-action"
          type="button"
          disabled={!canGoPrevious}
          onClick={onPreviousExercise}
        >
          Anterior
        </button>
        <button
          className="primary-action"
          type="button"
          disabled={isLastExercise ? !canFinish : !canGoNext}
          onClick={goToNextExercise}
        >
          {isLastExercise ? 'Finalizar' : 'Siguiente'}
        </button>
      </div>
    </section>
  )
}
