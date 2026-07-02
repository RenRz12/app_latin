import { useMemo, useState } from 'react'
import './App.css'

const topics = [
  { id: 'presente', label: 'Presente', description: 'Verbos regulares en acciones actuales' },
  { id: 'perfecto', label: 'Pretérito perfecto', description: 'Acciones terminadas en el pasado' },
  { id: 'imperfecto', label: 'Imperfecto', description: 'Acciones habituales o en desarrollo' },
  { id: 'declinaciones', label: 'Declinaciones', description: 'Casos, género y número' },
]

const vocabularyLevels = [
  { id: 1, label: 'Nivel 1', words: 'puella, puer, amat, videt' },
  { id: 2, label: 'Nivel 2', words: 'agricola, nauta, portat' },
  { id: 3, label: 'Nivel 3', words: 'templum, bellum, audit' },
  { id: 4, label: 'Nivel 4', words: 'imperator, legatus, ducit' },
]

const exerciseTypes = [
  { id: 'multiple_choice', label: 'Opción múltiple' },
  { id: 'fill_blank', label: 'Completar' },
  { id: 'translation', label: 'Traducción' },
]

const sampleExercises = {
  presente: {
    question: 'Puella rosam ____.',
    prompt: 'Elegí la forma correcta del verbo en presente.',
    options: ['amat', 'amavit', 'amabit', 'amabant'],
    correctAnswer: 'amat',
    explanation: 'Puella es singular, por eso corresponde amat: “la niña ama”.',
  },
  perfecto: {
    question: 'Puer librum ____.',
    prompt: 'Elegí la forma que expresa una acción ya terminada.',
    options: ['legit', 'legebat', 'legitne', 'leget'],
    correctAnswer: 'legit',
    explanation: 'Legit puede funcionar como perfecto: “el niño leyó el libro”.',
  },
  imperfecto: {
    question: 'Servus aquam ____.',
    prompt: 'Elegí la forma verbal imperfecta.',
    options: ['portabat', 'portat', 'portavit', 'portabit'],
    correctAnswer: 'portabat',
    explanation: 'Portabat indica una acción en desarrollo o habitual en el pasado.',
  },
  declinaciones: {
    question: 'Rosa ____ pulchra est.',
    prompt: 'Completá con el genitivo singular correcto.',
    options: ['puellae', 'puellam', 'puella', 'puellas'],
    correctAnswer: 'puellae',
    explanation: 'Puellae puede indicar “de la niña”: la rosa de la niña es hermosa.',
  },
}

function App() {
  const [selectedTopic, setSelectedTopic] = useState('presente')
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [selectedType, setSelectedType] = useState('multiple_choice')
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  const exercise = sampleExercises[selectedTopic]
  const topic = topics.find((item) => item.id === selectedTopic)
  const level = vocabularyLevels.find((item) => item.id === selectedLevel)
  const exerciseType = exerciseTypes.find((item) => item.id === selectedType)

  const isCorrect = selectedAnswer === exercise.correctAnswer

  const backendPayload = useMemo(
    () => ({
      topic: selectedTopic,
      vocabularyLevel: selectedLevel,
      exerciseType: selectedType,
    }),
    [selectedLevel, selectedTopic, selectedType],
  )

  function handleGenerateExercise() {
    setSelectedAnswer('')
    setShowFeedback(false)
  }

  function handleAnswerSubmit() {
    if (!selectedAnswer) return
    setShowFeedback(true)
  }

  return (
    <main className="app-shell">
      <section className="intro-section" aria-labelledby="page-title">
        <div className="intro-copy">
          <p className="eyebrow">Latín con ejercicios generados por IA</p>
          <h1 id="page-title">Práctica guiada por tema y vocabulario</h1>
          <p>
            Elegí qué querés practicar y probá el flujo principal de la app. Por
            ahora los ejercicios son de prueba; después esta selección va a viajar
            al backend para pedirle ejercicios a la IA.
          </p>
        </div>

        <div className="session-summary" aria-label="Resumen de la práctica">
          <span>{topic.label}</span>
          <span>{level.label}</span>
          <span>{exerciseType.label}</span>
        </div>
      </section>

      <section className="workspace" aria-label="Configuración y ejercicio">
        <aside className="practice-panel">
          <div className="field-group">
            <label htmlFor="topic">Tema</label>
            <select
              id="topic"
              value={selectedTopic}
              onChange={(event) => {
                setSelectedTopic(event.target.value)
                setSelectedAnswer('')
                setShowFeedback(false)
              }}
            >
              {topics.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p>{topic.description}</p>
          </div>

          <div className="field-group">
            <label>Nivel de vocabulario</label>
            <div className="level-grid" role="group" aria-label="Nivel de vocabulario">
              {vocabularyLevels.map((item) => (
                <button
                  className={selectedLevel === item.id ? 'level-button active' : 'level-button'}
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedLevel(item.id)
                    setSelectedAnswer('')
                    setShowFeedback(false)
                  }}
                >
                  {item.id}
                </button>
              ))}
            </div>
            <p>{level.words}</p>
          </div>

          <div className="field-group">
            <label htmlFor="exercise-type">Tipo de ejercicio</label>
            <select
              id="exercise-type"
              value={selectedType}
              onChange={(event) => {
                setSelectedType(event.target.value)
                setSelectedAnswer('')
                setShowFeedback(false)
              }}
            >
              {exerciseTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <button className="primary-action" type="button" onClick={handleGenerateExercise}>
            Generar ejercicio
          </button>
        </aside>

        <section className="exercise-panel" aria-labelledby="exercise-title">
          <div className="exercise-header">
            <div>
              <p className="eyebrow">Ejercicio de prueba</p>
              <h2 id="exercise-title">{exercise.prompt}</h2>
            </div>
            <span className="difficulty-pill">{level.label}</span>
          </div>

          <div className="latin-sentence">{exercise.question}</div>

          <div className="answer-options" role="radiogroup" aria-label="Respuestas">
            {exercise.options.map((option) => (
              <button
                className={selectedAnswer === option ? 'answer-option selected' : 'answer-option'}
                key={option}
                type="button"
                onClick={() => {
                  setSelectedAnswer(option)
                  setShowFeedback(false)
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <button
            className="secondary-action"
            type="button"
            disabled={!selectedAnswer}
            onClick={handleAnswerSubmit}
          >
            Corregir respuesta
          </button>

          {showFeedback && (
            <div className={isCorrect ? 'feedback correct' : 'feedback incorrect'} role="status">
              <strong>{isCorrect ? 'Respuesta correcta' : 'Todavía no'}</strong>
              <p>{exercise.explanation}</p>
            </div>
          )}
        </section>
      </section>

      <section className="api-preview" aria-label="Datos que se enviarán al backend">
        <div>
          <p className="eyebrow">Próximo paso técnico</p>
          <h2>Esto será el pedido al backend</h2>
        </div>
        <pre>{JSON.stringify(backendPayload, null, 2)}</pre>
      </section>
    </main>
  )
}

export default App
