function getAnswerOptionClass(option, selectedAnswer, evaluation) {
  const classes = ['answer-option']

  if (selectedAnswer === option) {
    classes.push('selected')

    if (evaluation?.status) {
      classes.push(evaluation.status)
    }
  }

  return classes.join(' ')
}

function getFeedbackClass(evaluation, selectedAnswer) {
  if (!selectedAnswer) return 'feedback revealed'
  return `feedback ${evaluation?.status || 'revealed'}`
}

function getFeedbackTitle(evaluation, selectedAnswer, correctAnswer) {
  if (!selectedAnswer) return `Respuesta: ${correctAnswer}`
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
  onAnswerSelect,
  onTextAnswerChange,
  onTextAnswerSubmit,
  onRevealAnswer,
  onPreviousExercise,
  onNextExercise,
}) {
  const isMultipleChoice = exerciseType === 'multiple_choice'
  const feedbackTitle = getFeedbackTitle(evaluation, selectedAnswer, exercise.correctAnswer)

  return (
    <section className="exercise-panel" aria-labelledby="exercise-title">
      <div className="exercise-header">
        <div>
          <p className="eyebrow">Ejercicio actual</p>
          <h2 id="exercise-title">{exercise.prompt}</h2>
        </div>
        <span className="difficulty-pill">{exercise.source}</span>
      </div>

      <div className="exercise-progress">
        Pregunta {currentIndex + 1} de {totalExercises}
      </div>

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
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onTextAnswerSubmit()
              }
            }}
            placeholder={
              exerciseType === 'translation'
                ? 'Escribi tu traduccion'
                : 'Escribi la palabra que falta'
            }
          />
        </div>
      )}

      <div className="exercise-actions">
        {!isMultipleChoice && (
          <button
            className="secondary-action"
            type="button"
            disabled={!selectedAnswer}
            onClick={onTextAnswerSubmit}
          >
            Revisar respuesta
          </button>
        )}
        <button className="secondary-action" type="button" onClick={onRevealAnswer}>
          Ver respuesta
        </button>
      </div>

      {showFeedback && (
        <div className={getFeedbackClass(evaluation, selectedAnswer)} role="status">
          <strong>{feedbackTitle}</strong>
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
          disabled={!canGoNext}
          onClick={onNextExercise}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}
