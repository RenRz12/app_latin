import { useEffect, useRef, useState } from 'react'
import { evaluateAnswer } from '../utils/answerEvaluation.js'

function getCellKey(caseId, number) {
  return `${caseId}-${number}`
}

function getInputClass(result) {
  return result ? `declension-input ${result.status}` : 'declension-input'
}

function ResultMessage({ correct, total, noun }) {
  return (
    <div className={correct === total ? 'feedback correct' : 'feedback almost'} role="status">
      <strong>
        {correct === total ? 'Excelente trabajo' : `${correct} de ${total} respuestas correctas`}
      </strong>
      <p>
        {correct === total
          ? `Ya dominas esta etapa con ${noun}.`
          : 'Revisa las correcciones marcadas antes de continuar.'}
      </p>
    </div>
  )
}

export function DeclensionExercise({
  declension,
  exercise,
  initialProgress,
  onProgress,
  onRestart,
  onComplete,
}) {
  const [phase, setPhase] = useState(initialProgress?.phase || 'table')
  const [tableAnswers, setTableAnswers] = useState(initialProgress?.tableAnswers || {})
  const [tableResults, setTableResults] = useState(initialProgress?.tableResults || null)
  const [sentenceAnswers, setSentenceAnswers] = useState(() =>
    initialProgress?.sentenceAnswers || exercise.sentences.map(() => ''),
  )
  const [sentenceResults, setSentenceResults] = useState(
    initialProgress?.sentenceResults || null,
  )
  const completionReported = useRef(false)

  useEffect(() => {
    onProgress?.({
      phase,
      tableAnswers,
      tableResults,
      sentenceAnswers,
      sentenceResults,
    })
  }, [onProgress, phase, sentenceAnswers, sentenceResults, tableAnswers, tableResults])

  const tableIsComplete = exercise.table.every((row) =>
    ['singular', 'plural'].every((number) =>
      tableAnswers[getCellKey(row.id, number)]?.trim(),
    ),
  )
  const sentencesAreComplete = sentenceAnswers.every((answer) => answer.trim())

  function updateTableAnswer(key, value) {
    setTableAnswers((current) => ({ ...current, [key]: value }))
    setTableResults(null)
  }

  function checkTable() {
    const results = {}

    exercise.table.forEach((row) => {
      ;['singular', 'plural'].forEach((number) => {
        const key = getCellKey(row.id, number)
        results[key] = evaluateAnswer(tableAnswers[key], row[number])
      })
    })

    setTableResults(results)
  }

  function updateSentenceAnswer(index, value) {
    setSentenceAnswers((current) =>
      current.map((answer, answerIndex) => (answerIndex === index ? value : answer)),
    )
    setSentenceResults(null)
  }

  function checkSentences() {
    const results = exercise.sentences.map((sentence, index) =>
      evaluateAnswer(sentenceAnswers[index], sentence.answer),
    )
    setSentenceResults(results)

    if (!completionReported.current) {
      const correctTableAnswers = Object.values(tableResults || {}).filter(
        (result) => result.status === 'correct',
      ).length
      const correctSentenceAnswers = results.filter(
        (result) => result.status === 'correct',
      ).length

      completionReported.current = true
      onComplete?.({
        correctAnswers: correctTableAnswers + correctSentenceAnswers,
        totalAnswers: 12 + exercise.sentences.length,
        progress: {
          phase: 'sentences',
          tableAnswers,
          tableResults,
          sentenceAnswers,
          sentenceResults: results,
        },
      })
    }
  }

  function restartPractice() {
    onRestart?.()
    setPhase('table')
    setTableAnswers({})
    setTableResults(null)
    setSentenceAnswers(exercise.sentences.map(() => ''))
    setSentenceResults(null)
    completionReported.current = false
  }

  if (phase === 'sentences') {
    const correctSentences =
      sentenceResults?.filter((result) => result.status === 'correct').length || 0

    return (
      <section className="exercise-panel declension-exercise" aria-labelledby="sentences-title">
        <div className="declension-heading">
          <p className="eyebrow">{declension.label}</p>
          <h2 id="sentences-title">Aplica las formas de {exercise.word}</h2>
          <p>Completa cada oracion con la forma indicada del mismo sustantivo.</p>
        </div>

        <ol className="declension-sentences">
          {exercise.sentences.map((sentence, index) => {
            const result = sentenceResults?.[index]

            return (
              <li className={result ? `sentence-row ${result.status}` : 'sentence-row'} key={sentence.text + index}>
                <span className="sentence-number" aria-hidden="true">{index + 1}</span>
                <div className="sentence-copy">
                  <span>{sentence.hint}</span>
                  <p>{sentence.text}</p>
                </div>
                <div className="sentence-answer">
                  <label htmlFor={`sentence-${index}`}>Forma de {exercise.word.split(',')[0]}</label>
                  <input
                    id={`sentence-${index}`}
                    type="text"
                    value={sentenceAnswers[index]}
                    onChange={(event) => updateSentenceAnswer(index, event.target.value)}
                    autoComplete="off"
                  />
                  {result && result.status !== 'correct' && (
                    <small>Respuesta: {sentence.answer}</small>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {sentenceResults && (
          <ResultMessage
            correct={correctSentences}
            total={exercise.sentences.length}
            noun={exercise.word.split(',')[0]}
          />
        )}

        <div className="exercise-navigation">
          <button className="secondary-action" type="button" onClick={() => setPhase('table')}>
            Volver a la tabla
          </button>
          {sentenceResults ? (
            <button className="primary-action" type="button" onClick={restartPractice}>
              Practicar de nuevo
            </button>
          ) : (
            <button
              className="primary-action"
              type="button"
              disabled={!sentencesAreComplete}
              onClick={checkSentences}
            >
              Revisar 10 oraciones
            </button>
          )}
        </div>
      </section>
    )
  }

  const correctTableCells = tableResults
    ? Object.values(tableResults).filter((result) => result.status === 'correct').length
    : 0

  return (
    <section className="exercise-panel declension-exercise" aria-labelledby="table-title">
      <div className="declension-heading">
        <p className="eyebrow">{declension.label} · Sustantivo para declinar</p>
        <h2 id="table-title">{exercise.word}</h2>
        <p>
          {exercise.meaning} · {exercise.gender}. Completa los seis casos en singular y plural.
        </p>
      </div>

      <div className="grammar-note">
        En las declinaciones se usan <strong>casos y numero</strong>. Las correcciones muestran
        los macrones; al responder, <strong>á equivale a ā</strong>, y lo mismo ocurre con las
        demas vocales.
      </div>

      <div className="declension-table-wrap">
        <table className="declension-table">
          <thead>
            <tr>
              <th scope="col">Caso</th>
              <th scope="col">Singular</th>
              <th scope="col">Plural</th>
            </tr>
          </thead>
          <tbody>
            {exercise.table.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                {['singular', 'plural'].map((number) => {
                  const key = getCellKey(row.id, number)
                  const result = tableResults?.[key]

                  return (
                    <td key={number}>
                      <label className="sr-only" htmlFor={key}>
                        {row.label} {number}
                      </label>
                      <input
                        className={getInputClass(result)}
                        id={key}
                        type="text"
                        value={tableAnswers[key] || ''}
                        onChange={(event) => updateTableAnswer(key, event.target.value)}
                        autoComplete="off"
                      />
                      {result && result.status !== 'correct' && <small>{row[number]}</small>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tableResults && <ResultMessage correct={correctTableCells} total={12} noun={exercise.word.split(',')[0]} />}

      <div className="exercise-navigation declension-navigation">
        {!tableResults && (
          <p>{tableIsComplete ? 'La tabla esta completa.' : 'Completa las 12 formas para revisarla.'}</p>
        )}
        {tableResults ? (
          <button className="primary-action" type="button" onClick={() => setPhase('sentences')}>
            Continuar a las 10 oraciones
          </button>
        ) : (
          <button
            className="primary-action"
            type="button"
            disabled={!tableIsComplete}
            onClick={checkTable}
          >
            Revisar tabla
          </button>
        )}
      </div>
    </section>
  )
}
