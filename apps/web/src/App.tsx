import { useState } from "react";
import { ToggleButton } from "react-aria-components";

export function App() {
  const [isDark, setIsDark] = useState(false);

  return (
    <div className="app-shell" data-theme={isDark ? "dark" : "light"}>
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="site-header">
        <span className="brand">Traveler</span>
        <ToggleButton
          className="theme-toggle"
          isSelected={isDark}
          onChange={setIsDark}
        >
          Thème sombre
        </ToggleButton>
      </header>
      <main id="main" tabIndex={-1} className="welcome">
        <p className="eyebrow">Les départs se préparent ensemble</p>
        <h1>Votre prochain voyage commence ici.</h1>
        <p className="intro">Votre espace voyage sera bientôt disponible.</p>
      </main>
      <footer className="site-footer">Traveler · Voyages entre nous</footer>
    </div>
  );
}
