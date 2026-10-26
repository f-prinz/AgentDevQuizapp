import { Link, useParams } from "react-router";

export function HomePage() {
  return <main className="page">
    <h1>Prinzgame</h1>
    <p>Die Ansichten für Host, Spieler und Projektor werden schrittweise ergänzt.</p>
    <ul className="role-links" aria-label="Ansichten">
      <li><Link to="/lobbies/demo/host">Hostansicht</Link></li>
      <li><Link to="/join">Beitrittsansicht</Link></li>
      <li><Link to="/player">Spieleransicht</Link></li>
      <li><Link to="/projector">Projektoransicht</Link></li>
    </ul>
  </main>;
}

export function HostPage() {
  const { lobbyId } = useParams();
  return <main className="page">
    <h1>Hostbereich</h1>
    <p>Lobby: {lobbyId}</p>
    <p className="placeholder">Die Hostfunktionen werden später ergänzt.</p>
  </main>;
}

export function JoinPage() {
  return <main className="page"><h1>Lobby beitreten</h1>
    <p className="placeholder">Die Beitrittsfunktion wird später ergänzt.</p>
  </main>;
}

export function PlayerPage() {
  return <main className="page"><h1>Spieleransicht</h1>
    <p className="placeholder">Die Spielansicht wird später ergänzt.</p>
  </main>;
}

export function ProjectorPage() {
  return <main className="projector" aria-labelledby="projector-title">
    <h1 id="projector-title">Projektor</h1>
    <div className="projector-layout">
      <section aria-label="Spielanzeige"><h2>Spielanzeige</h2>
        <p className="placeholder">Für den großen Bildschirm vorbereitet</p>
      </section>
      <section aria-label="Teilnehmerstatus"><h2>Teilnehmerstatus</h2>
        <p>Die Anzeige wird mit der Lobbyfunktion ergänzt.</p>
      </section>
    </div>
  </main>;
}