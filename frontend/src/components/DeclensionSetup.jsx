export function DeclensionSetup({ declension, exercise, hasPrompt, isImported }) {
  return (
    <section className="exercise-panel declension-setup" aria-labelledby="declension-setup-title">
      <div className="declension-heading">
        <p className="eyebrow">Prepara la practica · {declension.label}</p>
        <h2 id="declension-setup-title">Genera una palabra y 10 oraciones</h2>
        <p>
          Prepara el prompt, pegalo en la IA que prefieras e importa su respuesta JSON.
          Tambien puedes comenzar directamente con la palabra modelo.
        </p>
      </div>

      <ol className="setup-steps">
        <li className={hasPrompt ? 'complete' : ''}>
          <span>1</span>
          <div>
            <strong>Prepara y copia el prompt</strong>
            <p>El prompt ya incluye la declinacion elegida y el formato requerido.</p>
          </div>
        </li>
        <li className={isImported ? 'complete' : ''}>
          <span>2</span>
          <div>
            <strong>Pega e importa el JSON</strong>
            <p>La app validara la tabla completa y las 10 oraciones.</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Comienza la practica</strong>
            <p>Completa primero la tabla y despues aplica la palabra en contexto.</p>
          </div>
        </li>
      </ol>

      <div className={isImported ? 'practice-source imported' : 'practice-source'}>
        <span>{isImported ? 'Practica importada' : 'Modelo local disponible'}</span>
        <strong>{exercise.word}</strong>
        <p>
          {exercise.meaning} · {exercise.gender}
        </p>
      </div>
    </section>
  )
}
