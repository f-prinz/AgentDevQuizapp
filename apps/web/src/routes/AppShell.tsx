import { Link, Outlet } from "react-router";

export function AppShell() {
  return <div className="app-shell">
    <header className="site-header">
      <Link className="brand" to="/">Prinzgame</Link>
      <nav aria-label="Hauptnavigation">
        <Link to="/join">Beitreten</Link>
        <Link to="/player">Spieler</Link>
        <Link to="/projector">Projektor</Link>
      </nav>
    </header>
    <Outlet />
  </div>;
}