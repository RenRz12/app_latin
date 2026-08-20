import { useState } from 'react'

const timeZone = 'America/Argentina/Buenos_Aires'

const practiceKinds = [
  { id: 'verb_tense', label: 'Tiempos verbales' },
  { id: 'declension', label: 'Declinaciones' },
  { id: 'vocabulary', label: 'Vocabulario' },
  { id: 'combined', label: 'Práctica combinada' },
]

const verbTenses = [
  { id: 'present', label: 'Presente' },
  { id: 'imperfect', label: 'Preterito imperfecto' },
  { id: 'perfect', label: 'Preterito perfecto' },
  { id: 'future', label: 'Futuro' },
]

const declensions = [
  { id: 'first', label: 'Primera declinación' },
  { id: 'second', label: 'Segunda declinación' },
  { id: 'third', label: 'Tercera declinación' },
  { id: 'fourth', label: 'Cuarta declinación' },
  { id: 'fifth', label: 'Quinta declinación' },
]

const vocabularyStageLabels = {
  NEW: 'Sin empezar',
  RECOGNITION: 'Reconocimiento',
  CONTEXT_RECOGNITION: 'En contexto',
  GUIDED_RECALL: 'Recuerdo guiado',
  PRODUCTION: 'Producción',
  MASTERED: 'Dominada',
}

const partOfSpeechLabels = {
  NOUN: 'Sustantivo',
  VERB: 'Verbo',
  ADJECTIVE: 'Adjetivo',
  ADVERB: 'Adverbio',
  PRONOUN: 'Pronombre',
  PREPOSITION: 'Preposición',
  CONJUNCTION: 'Conjunción',
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone,
})

const dayPartsFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone,
})

function getDayParts(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return dayPartsFormatter.formatToParts(date).reduce((parts, item) => {
    if (item.type !== 'literal') parts[item.type] = Number(item.value)
    return parts
  }, {})
}

function getDayKey(value) {
  const parts = getDayParts(value)
  if (!parts) return ''

  return [parts.year, String(parts.month).padStart(2, '0'), String(parts.day).padStart(2, '0')].join('-')
}

function getDayNumber(value) {
  const parts = getDayParts(value)
  return parts ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000) : null
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateFormatter.format(date)
}

function calculateAccuracy(correct, total) {
  return total > 0 ? Math.round((correct / total) * 100) : 0
}

function getActivityData(session) {
  if (typeof session.activityData !== 'string') return session.activityData || {}

  try {
    return JSON.parse(session.activityData)
  } catch {
    return {}
  }
}

function buildBreakdown(items, sessions, predicate) {
  return items.map((item) => {
    const matchingSessions = sessions.filter((session) => predicate(session, item.id))
    const correct = matchingSessions.reduce((total, session) => total + session.correctAnswers, 0)
    const answers = matchingSessions.reduce((total, session) => total + session.totalAnswers, 0)

    return {
      ...item,
      count: matchingSessions.length,
      accuracy: calculateAccuracy(correct, answers),
    }
  })
}

function ProgressCards({ items, className = '' }) {
  return (
    <div className={`topic-progress-grid ${className}`.trim()}>
      {items.map((item) => (
        <article className="topic-progress-card" key={item.id}>
          <div>
            <strong>{item.label}</strong>
            <span>{item.count} {item.count === 1 ? 'práctica' : 'prácticas'}</span>
          </div>
          <div className="topic-progress-value">{item.accuracy}%</div>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${item.accuracy}%` }} />
          </div>
        </article>
      ))}
    </div>
  )
}

export function ProfilePage({
  sessions,
  isLoading,
  errorMessage,
  vocabularyChapters,
  vocabularyChapterFrom,
  vocabularyChapterTo,
  isSavingSettings,
  settingsMessage,
  vocabularyMetrics,
  isVocabularyMetricsLoading,
  vocabularyMetricsError,
  deletingPracticeId,
  onVocabularyRangeChange,
  onDelete,
  onReplay,
  onStartPractice,
}) {
  const [accuracyPeriod, setAccuracyPeriod] = useState('week')
  const [historyType, setHistoryType] = useState('all')
  const [historyDate, setHistoryDate] = useState('')

  const completedSessions = sessions.filter((session) => session.status !== 'in_progress')
  const todayNumber = getDayNumber(new Date())
  const maximumAge = accuracyPeriod === 'day' ? 0 : 6
  const periodSessions = completedSessions.filter((session) => {
    const sessionDay = getDayNumber(session.completedAt)
    if (sessionDay === null || todayNumber === null) return false
    const ageInDays = todayNumber - sessionDay
    return ageInDays >= 0 && ageInDays <= maximumAge
  })

  const periodCorrect = periodSessions.reduce(
    (total, session) => total + session.correctAnswers,
    0,
  )
  const periodAnswers = periodSessions.reduce(
    (total, session) => total + session.totalAnswers,
    0,
  )
  const periodAccuracy = calculateAccuracy(periodCorrect, periodAnswers)
  const activeDays = new Set(
    sessions.map((session) => getDayKey(session.completedAt)).filter(Boolean),
  ).size
  const periodDescription = accuracyPeriod === 'day' ? 'hoy' : 'en los ultimos 7 dias'

  const breakdown = buildBreakdown(
    practiceKinds,
    periodSessions,
    (session, kindId) => session.practiceKind === kindId,
  )
  const verbTenseBreakdown = buildBreakdown(
    verbTenses,
    periodSessions,
    (session, tenseId) =>
      session.practiceKind === 'verb_tense' && getActivityData(session).tenseId === tenseId,
  )
  const declensionBreakdown = buildBreakdown(
    declensions,
    periodSessions,
    (session, declensionId) =>
      session.practiceKind === 'declension' &&
      getActivityData(session).declensionId === declensionId,
  )

  const filteredHistory = sessions.filter((session) => {
    const matchesType = historyType === 'all' || session.practiceKind === historyType
    const matchesDate = !historyDate || getDayKey(session.completedAt) === historyDate
    return matchesType && matchesDate
  })
  const hasHistoryFilters = historyType !== 'all' || Boolean(historyDate)
  const vocabularyCoverage = vocabularyMetrics?.vocabularyCoverage
  const vocabularyStatus = vocabularyCoverage?.status
  const vocabularyCounts = vocabularyCoverage?.counts
  const vocabularyTotal = vocabularyCoverage?.eligibleVocabulary || 0
  const stageSegments = vocabularyCoverage
    ? [
        { id: 'new', label: 'Sin empezar', count: vocabularyCounts.NEW, className: 'new' },
        {
          id: 'learning',
          label: 'En aprendizaje',
          count: vocabularyCounts.LEARNING,
          className: 'learning',
        },
        {
          id: 'production',
          label: 'En producción',
          count: vocabularyCounts.PRODUCTION,
          className: 'production',
        },
        {
          id: 'mastered',
          label: 'Dominadas',
          count: vocabularyCounts.MASTERED,
          className: 'mastered',
        },
      ]
    : []

  function clearHistoryFilters() {
    setHistoryType('all')
    setHistoryDate('')
  }

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <header className="profile-header">
        <div className="profile-avatar" aria-hidden="true">L</div>
        <div>
          <p className="eyebrow">Tu espacio de estudio</p>
          <h1 id="profile-title">Mi perfil</h1>
          <p>Consulta tu progreso y continúa cualquier práctica que hayas dejado pendiente.</p>
        </div>
      </header>

      {errorMessage && <p className="profile-message error" role="status">{errorMessage}</p>}

      <section className="profile-section profile-preferences" aria-labelledby="preferences-title">
        <div className="profile-section-heading">
          <div>
            <p className="eyebrow">Preferencias generales</p>
            <h2 id="preferences-title">Alcance de Lingua Latina</h2>
          </div>
          <p>Este rango se aplicará en todas las pestañas de práctica.</p>
        </div>

        <div className="profile-range-settings" role="group" aria-label="Rango general de capítulos">
          <div>
            <label htmlFor="profile-vocabulary-from">Desde</label>
            <select
              id="profile-vocabulary-from"
              value={vocabularyChapterFrom}
              disabled={isSavingSettings}
              onChange={(event) => {
                const chapter = Number(event.target.value)
                onVocabularyRangeChange(
                  chapter,
                  Math.max(chapter, vocabularyChapterTo),
                )
              }}
            >
              {vocabularyChapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>{chapter.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="profile-vocabulary-to">Hasta</label>
            <select
              id="profile-vocabulary-to"
              value={vocabularyChapterTo}
              disabled={isSavingSettings}
              onChange={(event) => {
                const chapter = Number(event.target.value)
                onVocabularyRangeChange(
                  Math.min(vocabularyChapterFrom, chapter),
                  chapter,
                )
              }}
            >
              {vocabularyChapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>{chapter.label}</option>
              ))}
            </select>
          </div>
          <p>
            Se usará contenido compatible con los capítulos {vocabularyChapterFrom} al{' '}
            {vocabularyChapterTo}.
          </p>
        </div>
        {settingsMessage && <p className="settings-save-message" role="status">{settingsMessage}</p>}
      </section>

      <section className="period-overview" aria-labelledby="period-overview-title">
        <div className="period-overview-heading">
          <div>
            <p className="eyebrow">Resumen</p>
            <h2 id="period-overview-title">Tu actividad reciente</h2>
          </div>
          <div className="period-switch" role="group" aria-label="Periodo de acierto">
            <button
              className={accuracyPeriod === 'day' ? 'active' : ''}
              type="button"
              aria-pressed={accuracyPeriod === 'day'}
              onClick={() => setAccuracyPeriod('day')}
            >
              Diario
            </button>
            <button
              className={accuracyPeriod === 'week' ? 'active' : ''}
              type="button"
              aria-pressed={accuracyPeriod === 'week'}
              onClick={() => setAccuracyPeriod('week')}
            >
              Semanal
            </button>
          </div>
        </div>

        <div className="profile-stats profile-stats-compact" aria-label="Resumen de estadísticas">
          <article>
            <span>Prácticas {periodDescription}</span>
            <strong>{periodSessions.length}</strong>
          </article>
          <article>
            <span>Acierto {accuracyPeriod === 'day' ? 'diario' : 'semanal'}</span>
            <strong>{periodAccuracy}%</strong>
          </article>
          <article>
            <span>Días con práctica</span>
            <strong>{activeDays}</strong>
          </article>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="topic-progress-title">
        <div className="profile-section-heading">
          <div>
            <p className="eyebrow">Desempeño</p>
            <h2 id="topic-progress-title">Acierto por tema</h2>
          </div>
          <p>Resultados {periodDescription}. Cambia el periodo desde el resumen.</p>
        </div>

        <ProgressCards items={breakdown} />

        <div className="profile-subsection-heading">
          <h3>Detalle de tiempos verbales</h3>
          <p>Compara tu desempeño en cada tiempo por separado.</p>
        </div>
        <ProgressCards items={verbTenseBreakdown} className="verb-tense-progress-grid" />

        <div className="profile-subsection-heading">
          <h3>Detalle de declinaciones</h3>
          <p>Compara tu desempeño en cada una de las cinco declinaciones.</p>
        </div>
        <ProgressCards items={declensionBreakdown} className="declension-progress-grid" />
      </section>

      <section className="profile-section vocabulary-mastery" aria-labelledby="vocabulary-mastery-title">
        <div className="profile-section-heading">
          <div>
            <p className="eyebrow">Tu léxico</p>
            <h2 id="vocabulary-mastery-title">Dominio de vocabulario</h2>
          </div>
          <p>
            Calculado sobre las palabras de los capítulos {vocabularyChapterFrom} al{' '}
            {vocabularyChapterTo}.
          </p>
        </div>

        {vocabularyMetricsError && (
          <p className="profile-message error" role="status">{vocabularyMetricsError}</p>
        )}

        {isVocabularyMetricsLoading && !vocabularyCoverage ? (
          <div className="profile-empty" role="status">Calculando tu dominio de vocabulario...</div>
        ) : vocabularyCoverage ? (
          <>
            <div className="vocabulary-mastery-summary">
              <article className="vocabulary-primary-stat">
                <div
                  className="vocabulary-progress-ring"
                  style={{ '--progress': `${vocabularyStatus.learned.percentage * 3.6}deg` }}
                  aria-label={`${vocabularyStatus.learned.percentage}% del vocabulario aprendido`}
                >
                  <span>{Math.round(vocabularyStatus.learned.percentage)}%</span>
                </div>
                <div>
                  <span>Vocabulario aprendido</span>
                  <strong>
                    {vocabularyStatus.learned.count} de {vocabularyTotal} palabras
                  </strong>
                  <p>Incluye palabras que ya superaron la etapa inicial.</p>
                </div>
              </article>

              <div className="vocabulary-stat-grid">
                <article>
                  <span>Consolidado</span>
                  <strong>{Math.round(vocabularyStatus.consolidated.percentage)}%</strong>
                  <small>{vocabularyStatus.consolidated.count} palabras recuperables activamente</small>
                </article>
                <article>
                  <span>Dominado</span>
                  <strong>{Math.round(vocabularyStatus.mastered.percentage)}%</strong>
                  <small>{vocabularyStatus.mastered.count} palabras con dominio estable</small>
                </article>
                <article>
                  <span>Pendiente de repaso</span>
                  <strong>{vocabularyCounts.DUE}</strong>
                  <small>{vocabularyCounts.DUE === 1 ? 'palabra vencida' : 'palabras vencidas'}</small>
                </article>
              </div>
            </div>

            <div className="vocabulary-stage-overview">
              <div className="vocabulary-stage-heading">
                <h3>Cómo se distribuye tu vocabulario</h3>
                <span>{vocabularyTotal} palabras disponibles</span>
              </div>
              <div className="vocabulary-stage-bar" aria-label="Distribución por etapa de aprendizaje">
                {stageSegments.map((segment) => (
                  <span
                    className={segment.className}
                    key={segment.id}
                    style={{ width: `${vocabularyTotal ? (segment.count / vocabularyTotal) * 100 : 0}%` }}
                    title={`${segment.label}: ${segment.count}`}
                  />
                ))}
              </div>
              <div className="vocabulary-stage-legend">
                {stageSegments.map((segment) => (
                  <div key={segment.id}>
                    <span className={`stage-dot ${segment.className}`} aria-hidden="true" />
                    <span>{segment.label}</span>
                    <strong>{segment.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="profile-subsection-heading vocabulary-best-heading">
              <div>
                <h3>El vocabulario que mejor sabés</h3>
                <p>El dominio valora más la producción activa que el reconocimiento.</p>
              </div>
            </div>

            {vocabularyCoverage.strongestVocabulary.length === 0 ? (
              <div className="profile-empty vocabulary-empty">
                <strong>Todavía no hay palabras evaluadas</strong>
                <p>Cuando completes repasos adaptativos, tus palabras más sólidas aparecerán aquí.</p>
              </div>
            ) : (
              <div className="strongest-vocabulary-list">
                {vocabularyCoverage.strongestVocabulary.map((word, index) => (
                  <article className="strongest-vocabulary-item" key={word.vocabularyId}>
                    <span className="vocabulary-rank" aria-label={`Puesto ${index + 1}`}>
                      {index + 1}
                    </span>
                    <div className="vocabulary-word-main">
                      <div>
                        <strong lang="la">{word.lemma}</strong>
                        <span>{word.meaning || 'Sin traducción registrada'}</span>
                      </div>
                      <small>
                        {partOfSpeechLabels[word.partOfSpeech] || 'Palabra'} · Cap. {word.chapterOrigin}
                      </small>
                    </div>
                    <span className={`vocabulary-stage-badge stage-${word.learningStage.toLowerCase()}`}>
                      {vocabularyStageLabels[word.learningStage] || word.learningStage}
                    </span>
                    <div className="vocabulary-mastery-score">
                      <strong>{Math.round(word.masteryPercentage)}%</strong>
                      <span>dominio</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="profile-section" aria-labelledby="practice-history-title">
        <div className="profile-section-heading">
          <div>
            <p className="eyebrow">Guardadas automáticamente</p>
            <h2 id="practice-history-title">Historial de prácticas</h2>
          </div>
          <p>Continúa las pendientes o abre una terminada para realizarla otra vez.</p>
        </div>

        <div className="history-filters" aria-label="Filtros del historial">
          <div>
            <label htmlFor="history-type">Tipo de práctica</label>
            <select
              id="history-type"
              value={historyType}
              onChange={(event) => setHistoryType(event.target.value)}
            >
              <option value="all">Todas</option>
              {practiceKinds.map((kind) => (
                <option key={kind.id} value={kind.id}>{kind.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="history-date">Fecha</label>
            <input
              id="history-date"
              type="date"
              max={getDayKey(new Date())}
              value={historyDate}
              onChange={(event) => setHistoryDate(event.target.value)}
            />
          </div>
          <button
            className="secondary-action"
            type="button"
            disabled={!hasHistoryFilters}
            onClick={clearHistoryFilters}
          >
            Limpiar filtros
          </button>
        </div>

        {isLoading ? (
          <div className="profile-empty" role="status">Cargando tu progreso...</div>
        ) : sessions.length === 0 ? (
          <div className="profile-empty">
            <strong>Todavía no hay prácticas guardadas</strong>
            <p>Cuando comiences la primera, aparecerá aquí con su avance.</p>
            <button className="primary-action" type="button" onClick={onStartPractice}>
              Comenzar una práctica
            </button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="profile-empty">
            <strong>No hay prácticas para esos filtros</strong>
            <p>Prueba otra fecha o tipo de actividad.</p>
            <button className="secondary-action" type="button" onClick={clearHistoryFilters}>
              Ver todo el historial
            </button>
          </div>
        ) : (
          <>
            <p className="history-count">
              {filteredHistory.length} {filteredHistory.length === 1 ? 'práctica encontrada' : 'prácticas encontradas'}
            </p>
            <div className="practice-history-list">
              {filteredHistory.map((session) => (
                <article
                  className={
                    session.status === 'in_progress'
                      ? 'practice-history-item in-progress'
                      : 'practice-history-item'
                  }
                  key={session.id}
                >
                  <div className="practice-history-main">
                    <div className="history-mark" aria-hidden="true">
                      {session.practiceLabel.slice(0, 1)}
                    </div>
                    <div>
                      <h3>{session.practiceLabel}</h3>
                      <p>{session.detailLabel}</p>
                      <time dateTime={session.completedAt}>
                        {session.status === 'in_progress' ? 'Guardada ' : ''}
                        {formatDate(session.completedAt)}
                      </time>
                    </div>
                  </div>
                  <div
                    className={
                      session.status === 'in_progress'
                        ? 'practice-history-result in-progress'
                        : 'practice-history-result'
                    }
                  >
                    {session.status === 'in_progress' ? (
                      <>
                        <strong>En progreso</strong>
                        <span>
                          {session.totalAnswers} de{' '}
                          {getActivityData(session).expectedTotalAnswers || session.totalAnswers}{' '}
                          respondidas
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>{Math.round(session.accuracy)}%</strong>
                        <span>{session.correctAnswers} de {session.totalAnswers} correctas</span>
                      </>
                    )}
                  </div>
                  <div className="practice-history-actions">
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={deletingPracticeId !== null}
                      onClick={() => onReplay(session)}
                    >
                      {session.status === 'in_progress' ? 'Continuar' : 'Practicar de nuevo'}
                    </button>
                    <button
                      className="danger-action"
                      type="button"
                      disabled={deletingPracticeId !== null}
                      onClick={() => onDelete(session)}
                    >
                      {deletingPracticeId === session.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  )
}
