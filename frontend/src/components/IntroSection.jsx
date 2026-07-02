export function IntroSection({ topic, level, exerciseType }) {
  return (
    <section className="intro-section" aria-labelledby="page-title">
      <div className="intro-copy">
        <p className="eyebrow">Latin con ejercicios generados por IA</p>
        <h1 id="page-title">Practica guiada por tema y vocabulario</h1>
        <p>
          Elegi que queres practicar. Podes generar desde el backend, o crear un
          prompt para pegar en ChatGPT y luego importar el JSON sin pagar API.
        </p>
      </div>

      <div className="session-summary" aria-label="Resumen de la practica">
        <span>{topic.label}</span>
        <span>{level.label}</span>
        <span>{exerciseType.label}</span>
      </div>
    </section>
  )
}
