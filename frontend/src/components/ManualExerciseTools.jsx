export function ManualExerciseTools({
  manualPrompt,
  importText,
  isLoading,
  onCopyPrompt,
  onImportTextChange,
  onImportExercises,
  mode = 'exercises',
}) {
  const isDeclensionMode = mode === 'declension'
  const isVerbTenseMode = mode === 'verb_tense'
  const promptTitle = isDeclensionMode
    ? 'Pedir una palabra a la IA'
    : isVerbTenseMode
      ? 'Pedir verbos por familia a la IA'
      : 'Copiar a ChatGPT'
  const importLabel = isDeclensionMode
    ? 'Importar palabra y oraciones'
    : isVerbTenseMode
      ? 'Importar verbos y oraciones'
      : 'Importar ejercicios'

  return (
    <section className="manual-workspace" aria-label="Flujo manual con IA">
      <div className="manual-panel">
        <div>
          <p className="eyebrow">Prompt manual</p>
          <h2>{promptTitle}</h2>
        </div>
        <textarea
          readOnly
          value={manualPrompt}
          placeholder={
            isDeclensionMode
              ? 'Elige una declinacion y prepara el prompt desde el panel superior.'
              : isVerbTenseMode
                ? 'Elige un tiempo verbal y prepara el prompt desde el panel superior.'
                : 'Crea un prompt desde el panel de configuracion.'
          }
        />
        <button
          className="secondary-action"
          type="button"
          disabled={!manualPrompt}
          onClick={onCopyPrompt}
        >
          Copiar prompt
        </button>
      </div>

      <div className="manual-panel">
        <div>
          <p className="eyebrow">{importLabel}</p>
          <h2>Pegar JSON de la IA</h2>
        </div>
        <textarea
          value={importText}
          onChange={(event) => onImportTextChange(event.target.value)}
          placeholder={
            isDeclensionMode || isVerbTenseMode
              ? `Pega aqui el JSON con "${isDeclensionMode ? 'word' : 'verbs'}", "table" y "sentences".`
              : 'Pega aqui {"exercises":[...]} o directamente un array JSON.'
          }
        />
        <button
          className="primary-action"
          type="button"
          disabled={!importText.trim() || isLoading}
          onClick={onImportExercises}
        >
          {isDeclensionMode || isVerbTenseMode ? 'Importar practica' : 'Importar JSON'}
        </button>
      </div>
    </section>
  )
}
