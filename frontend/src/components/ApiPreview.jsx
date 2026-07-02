export function ApiPreview({ payload }) {
  return (
    <section className="api-preview" aria-label="Datos que se enviaran al backend">
      <div>
        <p className="eyebrow">Payload actual</p>
        <h2>Seleccion enviada al backend</h2>
      </div>
      <pre>{JSON.stringify(payload, null, 2)}</pre>
    </section>
  )
}
