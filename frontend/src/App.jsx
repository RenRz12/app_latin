import { useEffect, useState } from 'react'
import './App.css'
import { LoginPage } from './components/LoginPage.jsx'
import { PracticePage } from './pages/PracticePage.jsx'
import {
  getAuthenticationSession,
  logout,
} from './services/authService.js'
import { authenticationRequiredEvent } from './services/apiClient.js'

function App() {
  const [authenticationStatus, setAuthenticationStatus] = useState('checking')

  useEffect(() => {
    let isActive = true
    getAuthenticationSession()
      .then((session) => {
        if (isActive) {
          setAuthenticationStatus(session.authenticated ? 'authenticated' : 'anonymous')
        }
      })
      .catch(() => {
        if (isActive) setAuthenticationStatus('anonymous')
      })

    function requireAuthentication() {
      setAuthenticationStatus('anonymous')
    }
    window.addEventListener(authenticationRequiredEvent, requireAuthentication)
    return () => {
      isActive = false
      window.removeEventListener(authenticationRequiredEvent, requireAuthentication)
    }
  }, [])

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setAuthenticationStatus('anonymous')
    }
  }

  if (authenticationStatus === 'checking') {
    return (
      <main className="login-shell" aria-busy="true">
        <section className="login-card login-loading">
          <div className="login-brand" aria-hidden="true">L</div>
          <p>Preparando tu espacio de práctica…</p>
        </section>
      </main>
    )
  }

  if (authenticationStatus !== 'authenticated') {
    return <LoginPage onAuthenticated={() => setAuthenticationStatus('authenticated')} />
  }

  return <PracticePage onLogout={handleLogout} />
}

export default App
