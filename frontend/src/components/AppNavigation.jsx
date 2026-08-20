const navigationItems = [
  { id: 'verb_tenses', label: 'Tiempos verbales' },
  { id: 'declinaciones', label: 'Declinaciones' },
  { id: 'vocabulary', label: 'Vocabulario' },
  { id: 'combined', label: 'Práctica combinada' },
  { id: 'profile', label: 'Mi perfil' },
]

export function AppNavigation({ activeSection, onNavigate, onLogout }) {
  return (
    <nav className="app-navigation" aria-label="Secciones de practica">
      <div className="app-brand">
        <span aria-hidden="true">L</span>
        <strong>Latine</strong>
      </div>

      <div className="navigation-tabs" role="tablist" aria-label="Secciones">
        {navigationItems.map((item) => (
          <button
            aria-current={activeSection === item.id ? 'page' : undefined}
            className={activeSection === item.id ? 'navigation-tab active' : 'navigation-tab'}
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeSection === item.id}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button className="navigation-logout" type="button" onClick={onLogout}>
        Salir
      </button>
    </nav>
  )
}
