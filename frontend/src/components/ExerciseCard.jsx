export function ExerciseCard({
  exercise,
  selectedAnswer,
  showFeedback,
  isCorrect,
  onAnswerSelect,
  onAnswerSubmit,
}) {
  return (
    <section className="exercise-panel" aria-labelledby="exercise-title">
      <div className="exercise-header">
        <div>
          <p className="eyebrow">Ejercicio actual</p>
          <h2 id="exercise-title">{exercise.prompt}</h2>
        </div>
        <span className="difficulty-pill">{exercise.source}</span>
      </div>

      <div className="latin-sentence">{exercise.question}</div>

      <div className="answer-options" role="radiogroup" aria-label="Respuestas">
        {exercise.options.map((option) => (
          <button
            className={selectedAnswer === option ? 'answer-option selected' : 'answer-option'}
            key={option}
            type="button"
            onClick={() => onAnswerSelect(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <button
        className="secondary-action"
        type="button"
        disabled={!selectedAnswer}
        onClick={onAnswerSubmit}
      >
        Corregir respuesta
      </button>

      {showFeedback && (
        <div className={isCorrect ? 'feedback correct' : 'feedback incorrect'} role="status">
          <strong>{isCorrect ? 'Respuesta correcta' : 'Todavia no'}</strong>
          <p>{exercise.explanation}</p>
        </div>
      )}
    </section>
  )
}
