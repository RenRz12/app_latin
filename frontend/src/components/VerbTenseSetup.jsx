export function VerbTenseSetup({
  tense,
  exercise,
  hasPrompt,
  expectedFamilyCount,
  includePassive,
}) {
  const isImported = Boolean(exercise)

  return (
    <section className="exercise-panel declension-setup" aria-labelledby="verb-setup-title">
      <div className="declension-heading">
        <p className="eyebrow">Prepara la practica verbal · {tense.label}</p>
        <h2 id="verb-setup-title">Un verbo de cada familia</h2>
        <p>
          La IA generará {expectedFamilyCount} verbos, sus tablas de seis personas en voz
          activa{includePassive ? ' y pasiva' : ''}, y un repaso de al menos 10 oraciones
          españolas donde traducirás únicamente el verbo destacado.
        </p>
      </div>

      <ol className="setup-steps">
        <li className={hasPrompt ? 'complete' : ''}>
          <span>1</span>
          <div>
            <strong>Prepara y copia el prompt</strong>
            <p>
              Queda configurado para {tense.promptLabel}, sus {expectedFamilyCount} familias
              y {includePassive ? 'ambas voces' : 'la voz activa'}.
            </p>
          </div>
        </li>
        <li className={isImported ? 'complete' : ''}>
          <span>2</span>
          <div>
            <strong>Importa la respuesta JSON</strong>
            <p>La app comprobara personas, macrones y formas usadas en las oraciones.</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Conjuga los {expectedFamilyCount} verbos</strong>
            <p>Completa una tabla por vez y termina aplicandolos en contexto.</p>
          </div>
        </li>
      </ol>

      {isImported ? (
        <div className="practice-source imported">
          <span>{exercise.verbs.length} verbos listos</span>
          <div className="verb-source-list">
            {exercise.verbs.map((verb) => (
              <strong key={verb.family}>{verb.principalParts}</strong>
            ))}
          </div>
        </div>
      ) : (
        <div className="practice-source pending">
          <span>Falta importar la practica</span>
          <strong>Genera el prompt para continuar</strong>
          <p>El boton Comenzar se habilitara cuando el JSON sea valido.</p>
        </div>
      )}
    </section>
  )
}
