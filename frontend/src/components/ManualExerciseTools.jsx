export function ManualExerciseTools({
  manualPrompt,
  importText,
  isLoading,
  onCopyPrompt,
  onImportTextChange,
  onImportExercises,
}) {
  return (
    <section className="manual-workspace" aria-label="Flujo manual con ChatGPT">
      <div className="manual-panel">
        <div>
          <p className="eyebrow">Prompt manual</p>
          <h2>Copiar a ChatGPT</h2>
        </div>
        <textarea
          readOnly
          value={manualPrompt}
          placeholder="Crea un prompt desde el panel de configuracion."
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
          <p className="eyebrow">Importar ejercicios</p>
          <h2>Pegar JSON de ChatGPT</h2>
        </div>
        <textarea
          value={importText}
          onChange={(event) => onImportTextChange(event.target.value)}
          placeholder='Pega aqui {"exercises":[...]} o directamente un array JSON.'
        />
        <button
          className="primary-action"
          type="button"
          disabled={!importText.trim() || isLoading}
          onClick={onImportExercises}
        >
          Importar JSON
        </button>
      </div>
    </section>
  )
}
