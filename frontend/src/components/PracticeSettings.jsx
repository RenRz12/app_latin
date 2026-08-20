export function PracticeSettings({
  topics,
  exerciseTypes,
  selectedTopic,
  selectedVocabularyFrom,
  selectedVocabularyTo,
  selectedType,
  selectedDeclension,
  selectedVerbTense,
  includePassive,
  topic,
  declensions,
  verbTenses,
  isDeclensionMode,
  isVerbTenseMode,
  importedDeclensionWord,
  importedVerbCount,
  expectedVerbCount,
  showTopicSelector = true,
  isLoading,
  statusMessage,
  onTopicChange,
  onIncludePassiveChange,
  onTypeChange,
  onDeclensionChange,
  onVerbTenseChange,
  onGenerateFromBackend,
  onCreateManualPrompt,
}) {
  return (
    <aside className="practice-panel">
      {showTopicSelector && (
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
      )}

      <div className="practice-scope-note">
        <strong>Alcance general</strong>
        <span>Lingua Latina, capítulos {selectedVocabularyFrom} al {selectedVocabularyTo}</span>
        <small>Puedes cambiarlo desde Mi perfil.</small>
      </div>

      {isDeclensionMode ? (
        <div className="field-group">
          <label>Elige una de las cinco declinaciones</label>
          <div className="declension-picker" role="radiogroup" aria-label="Declinacion">
            {declensions.map((item) => (
              <button
                aria-checked={selectedDeclension === item.id}
                className={
                  selectedDeclension === item.id
                    ? 'declension-choice active'
                    : 'declension-choice'
                }
                key={item.id}
                type="button"
                role="radio"
                onClick={() => onDeclensionChange(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.model}</span>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </div>
      ) : isVerbTenseMode ? (
        <>
          <div className="field-group">
            <label>Elige el tiempo verbal</label>
            <div className="declension-picker" role="radiogroup" aria-label="Tiempo verbal">
              {verbTenses.map((item) => (
                <button
                  aria-checked={selectedVerbTense === item.id}
                  className={
                    selectedVerbTense === item.id
                      ? 'declension-choice active'
                      : 'declension-choice'
                  }
                  key={item.id}
                  type="button"
                  role="radio"
                  onClick={() => onVerbTenseChange(item.id)}
                >
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
          </div>

          <label className="toggle-setting">
            <span>
              <strong>Incluir voz pasiva</strong>
              <small>Agrega las formas pasivas a las tablas y al repaso.</small>
            </span>
            <input
              type="checkbox"
              checked={includePassive}
              onChange={(event) => onIncludePassiveChange(event.target.checked)}
            />
            <i aria-hidden="true" />
          </label>
        </>
      ) : (
        <>
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
        </>
      )}

      <div className="button-stack">
        {isDeclensionMode ? (
          <>
            <button
              className="secondary-action full-width"
              type="button"
              disabled={isLoading}
              onClick={onCreateManualPrompt}
            >
              Preparar prompt para la IA
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={isLoading}
              onClick={onGenerateFromBackend}
            >
              {importedDeclensionWord
                ? `Comenzar con ${importedDeclensionWord.split(',')[0]}`
                : 'Comenzar practica modelo'}
            </button>
            <p className="button-help">
              {importedDeclensionWord
                ? 'La palabra y las 10 oraciones importadas estan listas.'
                : 'Puedes usar el modelo local o importar una practica generada por IA.'}
            </p>
          </>
        ) : isVerbTenseMode ? (
          <>
            <button
              className="secondary-action full-width"
              type="button"
              disabled={isLoading}
              onClick={onCreateManualPrompt}
            >
              Preparar prompt para la IA
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={isLoading || importedVerbCount !== expectedVerbCount}
              onClick={onGenerateFromBackend}
            >
              Comenzar practica verbal
            </button>
            <p className="button-help">
              {importedVerbCount === expectedVerbCount
                ? `Los ${expectedVerbCount} verbos y las oraciones estan listos.`
                : 'Importa el JSON generado por la IA para habilitar la practica.'}
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {statusMessage && <p className="status-message">{statusMessage}</p>}
    </aside>
  )
}
