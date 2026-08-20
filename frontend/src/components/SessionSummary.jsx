export function SessionSummary({ results, onReviewMistakes, onContinuePractice }) {
  const correctCount = results.filter((result) => result.status === 'correct').length
  const almostCount = results.filter((result) => result.status === 'almost').length
  const incorrectCount = results.filter((result) => result.status === 'incorrect').length
  const unansweredCount = results.filter((result) => result.status === 'unanswered').length
  const reviewableCount = results.length - correctCount

  return (
    <section className="session-results" aria-labelledby="session-results-title">
      <div>
        <p className="eyebrow">Sesion terminada</p>
        <h2 id="session-results-title">Resumen de respuestas</h2>
      </div>

      <div className="result-grid">
        <div className="result-stat correct">
          <strong>{correctCount}</strong>
          <span>Correctas</span>
        </div>
        <div className="result-stat almost">
          <strong>{almostCount}</strong>
          <span>Incompletas</span>
        </div>
        <div className="result-stat incorrect">
          <strong>{incorrectCount}</strong>
          <span>Incorrectas</span>
        </div>
        <div className="result-stat unanswered">
          <strong>{unansweredCount}</strong>
          <span>Sin responder</span>
        </div>
      </div>

      <div className="result-list">
        {results.map((result, index) => (
          <div className={`result-row ${result.status}`} key={result.exerciseKey}>
            <span>{index + 1}</span>
            <div>
              <strong>{result.exercise.question}</strong>
              <p>
                Tu respuesta: {result.selectedAnswer || 'Sin respuesta'} | Correcta:{' '}
                {result.exercise.correctAnswer}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="exercise-actions">
        <button
          className="primary-action"
          type="button"
          disabled={reviewableCount === 0}
          onClick={onReviewMistakes}
        >
          Repasar erradas
        </button>
        <button className="secondary-action" type="button" onClick={onContinuePractice}>
          Volver a los ejercicios
        </button>
      </div>
    </section>
  )
}
