import { useState } from 'react'
import { getApiErrorMessage } from '../services/apiClient.js'
import { loginWithPassword } from '../services/authService.js'

export function LoginPage({ onAuthenticated }) {
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!password || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage('')
    try {
      await loginWithPassword(password)
      setPassword('')
      onAuthenticated()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">L</div>
        <p className="eyebrow">Latine</p>
        <h1 id="login-title">Tu práctica de latín, en cualquier dispositivo</h1>
        <p className="login-intro">
          Ingresa la contraseña privada de la aplicación para acceder a tus ejercicios,
          avances y estadísticas.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="app-password">Contraseña</label>
          <input
            id="app-password"
            autoComplete="current-password"
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className="primary-action"
            type="submit"
            disabled={!password || isSubmitting}
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        {errorMessage && <p className="login-error" role="alert">{errorMessage}</p>}
      </section>
    </main>
  )
}
