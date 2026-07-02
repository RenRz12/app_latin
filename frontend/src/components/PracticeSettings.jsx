export function PracticeSettings({
  topics,
  vocabularyLevels,
  exerciseTypes,
  selectedTopic,
  selectedLevel,
  selectedType,
  topic,
  level,
  isLoading,
  statusMessage,
  onTopicChange,
  onLevelChange,
  onTypeChange,
  onGenerateFromBackend,
  onCreateManualPrompt,
}) {
  return (
    <aside className="practice-panel">
      <div className="field-group">
        <label htmlFor="topic">Tema</label>
        <select
          id="topic"
          value={selectedTopic}
          onChange={(event) => onTopicChange(event.target.value)}
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
        <label>Alcance de vocabulario</label>
        <div className="level-grid" role="group" aria-label="Alcance de vocabulario">
          {vocabularyLevels.map((item) => (
            <button
              className={selectedLevel === item.id ? 'level-button active' : 'level-button'}
              key={item.id}
              type="button"
              onClick={() => onLevelChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p>{level.scope}</p>
      </div>

      <div className="field-group">
        <label htmlFor="exercise-type">Tipo de ejercicio</label>
        <select
          id="exercise-type"
          value={selectedType}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          {exerciseTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="button-stack">
        <button
          className="primary-action"
          type="button"
          disabled={isLoading}
          onClick={onGenerateFromBackend}
        >
          Generar desde backend
        </button>
        <button
          className="secondary-action full-width"
          type="button"
          disabled={isLoading}
          onClick={onCreateManualPrompt}
        >
          Preparar prompt para ChatGPT
        </button>
      </div>

      {statusMessage && <p className="status-message">{statusMessage}</p>}
    </aside>
  )
}
