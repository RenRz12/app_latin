import { useEffect, useRef, useState } from 'react'
import { evaluateAnswer } from '../utils/answerEvaluation.js'

function getCellKey(personId, columnId) {
  return `${personId}-${columnId}`
}

function getTableGroups(includePassive) {
  const groups = [
    {
      id: 'active',
      title: 'Voz activa',
      description: 'Conjuga las formas activas del verbo.',
      columns: [
        { id: 'singular', label: 'Singular' },
        { id: 'plural', label: 'Plural' },
      ],
    },
  ]

  if (includePassive) {
    groups.push({
      id: 'passive',
      title: 'Voz pasiva',
      description: 'Conjuga las formas pasivas del mismo verbo.',
      columns: [
        { id: 'passiveSingular', label: 'Singular' },
        { id: 'passivePlural', label: 'Plural' },
      ],
    })
  }

  return groups
}

function PracticeResult({ correct, total, label }) {
  return (
    <div className={correct === total ? 'feedback correct' : 'feedback almost'} role="status">
      <strong>
        {correct === total ? 'Excelente trabajo' : `${correct} de ${total} respuestas correctas`}
      </strong>
      <p>
        {correct === total
          ? `${label} completado sin errores.`
          : 'Revisa las formas marcadas y presta atención a las vocales largas.'}
      </p>
    </div>
  )
}

export function VerbTenseExercise({
  tense,
  exercise,
  initialProgress,
  onProgress,
  onRestart,
  onComplete,
}) {
  const [phase, setPhase] = useState(initialProgress?.phase || 'tables')
  const [currentVerbIndex, setCurrentVerbIndex] = useState(
    initialProgress?.currentVerbIndex || 0,
  )
  const [tableAnswers, setTableAnswers] = useState(
    () => initialProgress?.tableAnswers || exercise.verbs.map(() => ({})),
  )
  const [tableResults, setTableResults] = useState(
    () => initialProgress?.tableResults || exercise.verbs.map(() => null),
  )
  const [sentenceAnswers, setSentenceAnswers] = useState(() =>
    initialProgress?.sentenceAnswers || exercise.sentences.map(() => ''),
  )
  const [sentenceResults, setSentenceResults] = useState(
    initialProgress?.sentenceResults || null,
  )
  const completionReported = useRef(false)
  const tableGroups = getTableGroups(Boolean(exercise.includePassive))
  const tableColumns = tableGroups.flatMap((group) => group.columns)
  const answersPerTable = exercise.verbs[0].table.length * tableColumns.length

  const verb = exercise.verbs[currentVerbIndex]
  const currentAnswers = tableAnswers[currentVerbIndex]
  const currentResults = tableResults[currentVerbIndex]
  const tableIsComplete = verb.table.every((row) =>
    tableColumns.every((column) =>
      currentAnswers[getCellKey(row.id, column.id)]?.trim(),
    ),
  )
  const sentencesAreComplete = sentenceAnswers.every((answer) => answer.trim())

  useEffect(() => {
    onProgress?.({
      phase,
      currentVerbIndex,
      tableAnswers,
      tableResults,
      sentenceAnswers,
      sentenceResults,
    })
  }, [
    currentVerbIndex,
    onProgress,
    phase,
    sentenceAnswers,
    sentenceResults,
    tableAnswers,
    tableResults,
  ])

  function updateTableAnswer(key, value) {
    setTableAnswers((current) =>
      current.map((answers, index) =>
        index === currentVerbIndex ? { ...answers, [key]: value } : answers,
      ),
    )
    setTableResults((current) =>
      current.map((results, index) => (index === currentVerbIndex ? null : results)),
    )
  }

  function checkTable() {
    const results = {}

    verb.table.forEach((row) => {
      tableColumns.forEach((column) => {
        const key = getCellKey(row.id, column.id)
        results[key] = evaluateAnswer(currentAnswers[key], row[column.id])
      })
    })

    setTableResults((current) =>
      current.map((storedResults, index) =>
        index === currentVerbIndex ? results : storedResults,
      ),
    )
  }

  function continuePractice() {
    if (currentVerbIndex === exercise.verbs.length - 1) {
      setPhase('sentences')
      return
    }

    setCurrentVerbIndex((current) => current + 1)
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
      const correctTableAnswers = tableResults.reduce(
        (total, storedResults) =>
          total +
          Object.values(storedResults || {}).filter((result) => result.status === 'correct')
            .length,
        0,
      )
      const correctSentenceAnswers = results.filter(
        (result) => result.status === 'correct',
      ).length

      completionReported.current = true
      onComplete?.({
        correctAnswers: correctTableAnswers + correctSentenceAnswers,
        totalAnswers: exercise.verbs.length * answersPerTable + exercise.sentences.length,
        progress: {
          phase: 'sentences',
          currentVerbIndex,
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
    setPhase('tables')
    setCurrentVerbIndex(0)
    setTableAnswers(exercise.verbs.map(() => ({})))
    setTableResults(exercise.verbs.map(() => null))
    setSentenceAnswers(exercise.sentences.map(() => ''))
    setSentenceResults(null)
    completionReported.current = false
  }

  if (phase === 'sentences') {
    const correctSentences =
      sentenceResults?.filter((result) => result.status === 'correct').length || 0

    return (
      <section className="exercise-panel verb-tense-exercise" aria-labelledby="verb-sentences-title">
        <div className="declension-heading">
          <p className="eyebrow">Repaso de {tense.label}</p>
          <h2 id="verb-sentences-title">Aplica los {exercise.verbs.length} verbos</h2>
          <p>
            Traduce al latín solamente el verbo destacado en cada oración española.
          </p>
        </div>

        <ol className="declension-sentences">
          {exercise.sentences.map((sentence, index) => {
            const result = sentenceResults?.[index]
            const sentenceVerb = exercise.verbs[sentence.verbNumber - 1]

            return (
              <li
                className={result ? `sentence-row ${result.status}` : 'sentence-row'}
                key={sentence.text + index}
              >
                <span className="sentence-number" aria-hidden="true">{index + 1}</span>
                <div className="sentence-copy">
                  <span>{sentence.hint}</span>
                  {sentence.spanishVerb ? (
                    <p lang="es">
                      {sentence.spanishBefore}
                      <strong className="verb-translation-target">
                        {sentence.spanishVerb}
                      </strong>
                      {sentence.spanishAfter}
                    </p>
                  ) : (
                    <p>{sentence.text}</p>
                  )}
                </div>
                <div className="sentence-answer">
                  <label htmlFor={`verb-sentence-${index}`}>
                    Escribe solo el verbo latino · {sentenceVerb.principalParts.split(',')[0]} ·{' '}
                    {sentence.voice === 'passive' ? 'pasiva' : 'activa'}
                  </label>
                  <input
                    id={`verb-sentence-${index}`}
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
          <PracticeResult
            correct={correctSentences}
            total={exercise.sentences.length}
            label="El repaso"
          />
        )}

        <div className="exercise-navigation">
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              setCurrentVerbIndex(exercise.verbs.length - 1)
              setPhase('tables')
            }}
          >
            Volver a las tablas
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
              Revisar {exercise.sentences.length} oraciones
            </button>
          )}
        </div>
      </section>
    )
  }

  const correctCells = currentResults
    ? Object.values(currentResults).filter((result) => result.status === 'correct').length
    : 0
  const isLastVerb = currentVerbIndex === exercise.verbs.length - 1

  return (
    <section className="exercise-panel verb-tense-exercise" aria-labelledby="verb-table-title">
      <div className="verb-family-progress" aria-label="Progreso de familias verbales">
        {exercise.verbs.map((item, index) => (
          <span
            className={
              index === currentVerbIndex
                ? 'current'
                : tableResults[index]
                  ? 'complete'
                  : ''
            }
            key={item.family}
          >
            {index + 1}
          </span>
        ))}
      </div>

      <div className="declension-heading">
        <p className="eyebrow">
          {tense.label} · {verb.familyLabel} · Verbo {currentVerbIndex + 1} de{' '}
          {exercise.verbs.length}
        </p>
        <h2 id="verb-table-title">{verb.principalParts}</h2>
        <p>
          {verb.meaning}. Completa las seis personas en voz activa
          {exercise.includePassive ? ' y pasiva' : ''} antes de continuar.
        </p>
      </div>

      <div className="grammar-note">
        Escribe los macrones cuando correspondan. También puedes usar tildes:
        <strong> á equivale a ā</strong>, por ejemplo.
      </div>

      <div className="verb-table-stack">
        {tableGroups.map((group) => (
          <section
            className={`verb-voice-table ${group.id}`}
            aria-labelledby={`verb-${currentVerbIndex}-${group.id}-title`}
            key={group.id}
          >
            <div className="verb-voice-heading">
              <h3 id={`verb-${currentVerbIndex}-${group.id}-title`}>{group.title}</h3>
              <p>{group.description}</p>
            </div>

            <div className="declension-table-wrap">
              <table className="declension-table verb-table">
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    {group.columns.map((column) => (
                      <th scope="col" key={column.id}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {verb.table.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.label}</th>
                      {group.columns.map((column) => {
                        const key = getCellKey(row.id, column.id)
                        const result = currentResults?.[key]

                        return (
                          <td key={column.id}>
                            <label
                              className="sr-only"
                              htmlFor={`verb-${currentVerbIndex}-${key}`}
                            >
                              {row.label} {group.title} {column.label}
                            </label>
                            <input
                              className={result ? `declension-input ${result.status}` : 'declension-input'}
                              id={`verb-${currentVerbIndex}-${key}`}
                              type="text"
                              value={currentAnswers[key] || ''}
                              onChange={(event) => updateTableAnswer(key, event.target.value)}
                              autoComplete="off"
                            />
                            {result && result.status !== 'correct' && (
                              <small>{row[column.id]}</small>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      {currentResults && (
        <PracticeResult correct={correctCells} total={answersPerTable} label="La tabla" />
      )}

      <div className="exercise-navigation verb-table-navigation">
        <button
          className="secondary-action"
          type="button"
          disabled={currentVerbIndex === 0}
          onClick={() => setCurrentVerbIndex((current) => current - 1)}
        >
          Verbo anterior
        </button>
        {currentResults ? (
          <button className="primary-action" type="button" onClick={continuePractice}>
            {isLastVerb
              ? `Ir a las ${exercise.sentences.length} oraciones`
              : 'Siguiente verbo'}
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
