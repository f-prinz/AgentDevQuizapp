import { useState } from "react";
import type { HostSnapshot, Snapshot } from "@raccoons/contracts";
import { KIND_LABEL } from "./shared/qr";
import { TimerDisplay } from "./shared/TimerDisplay";

export { resolveComponent } from "./shared/qr";

type Send = (message: Record<string, unknown>) => void;


async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    document.body.appendChild(field);
    field.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    field.remove();
    return ok;
  }
}

function CopyLinkButton({ label, link }: { label: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const url = new URL(link, window.location.origin).href;
  return <span className="link-copy">
    <code className="link-copy-text">{url}</code>
    <button type="button" aria-label={`${label} kopieren`} onClick={() => { void copyText(url).then(ok => { if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 1600); } }); }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
    {copied && <span className="link-copied" role="status">Kopiert</span>}
  </span>;
}

function GameList({ games, label }: { games: Snapshot["catalog"]; label: string }) {
  return <section aria-label={label}><h3>{label}</h3>
    {games.length === 0 ? <p>Keine Spiele.</p> : <ul>{games.map(game => <li key={game.id}>{KIND_LABEL[game.kind] ?? game.kind}: {game.title}</li>)}</ul>}
  </section>;
}

function HostOverview({ snapshot, send }: { snapshot: HostSnapshot; send: Send }) {
  const selected = snapshot.catalog.find(game => game.id === snapshot.selectedGameId) ?? null;
  const select = (gameId: string | null) => send({ version: 1, type: "game.select", requestId: crypto.randomUUID(), gameId });
  return <section className="game-view" aria-label="Übersicht">
    <h2>Übersicht</h2>
    <div className="overview-columns">
      <section aria-label="Verfügbare Spiele"><h3>Verfügbare Spiele</h3>
        {snapshot.catalog.filter(game => !game.played).length === 0 ? <p>Alle Spiele wurden gespielt.</p> : <ul>{snapshot.catalog.filter(game => !game.played).map(game => <li key={game.id}>
          <button type="button" className={`game-option${snapshot.selectedGameId === game.id ? " selected" : ""}`} aria-pressed={snapshot.selectedGameId === game.id}
            onClick={() => select(snapshot.selectedGameId === game.id ? null : game.id)}>{KIND_LABEL[game.kind] ?? game.kind}: {game.title}</button>
        </li>)}</ul>}
      </section>
      <GameList games={snapshot.catalog.filter(game => game.played)} label="Gespielte Spiele" />
    </div>
    {selected && <div className="game-selection"><p>{selected.rules}</p>
      <button type="button" onClick={() => send({ version: 1, type: "game.prepare", requestId: crypto.randomUUID() })}>Starten</button>
    </div>}
  </section>;
}

// CHG-20: Lobbymenue als Accordion — auf jeder Host-Phase verfuegbar
// (HostPage), nicht mehr nur in der Lobbyphase. Default offen, Zustand
// nicht persistiert; Inhalt = bisheriges Menue + Lobby-ID.
export function LobbyAccordion({ lobbyId, snapshot, send }: { lobbyId: string; snapshot: HostSnapshot; send: Send }) {
  const [open, setOpen] = useState(true);
  return <details className="game-view lobby-accordion" open={open}
    onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><h2>Lobby</h2></summary>
    <p>Lobby-ID: {lobbyId}</p>
    <p>Sobald mindestens zwei Spieler beigetreten sind, kannst du die Lobby zur Übersicht starten.</p>
    <div className="lobby-links">
      <p>Spieler-Link: <CopyLinkButton label="Spieler-Link" link={snapshot.links.player} /></p>
      <p>Projektor-Link: <CopyLinkButton label="Projektor-Link" link={snapshot.links.projector} /></p>
    </div>
    <button type="button" disabled={!snapshot.canStartLobby} onClick={() => send({ version: 1, type: "lobby.start", requestId: crypto.randomUUID() })}>Lobby starten</button>
  </details>;
}

export function HostGameView({ snapshot, send }: { snapshot: HostSnapshot; send: Send }) {
  const round = snapshot.round;
  if (!round) {
    if (snapshot.phase === "overview") return <HostOverview snapshot={snapshot} send={send} />;
    // CHG-20: In der Lobbyphase traegt das LobbyAccordion das Menue —
    // kein dupliziertes Inline-Menue mehr.
    return null;
  }
  const command = (type: string) => send({ version: 1, type, requestId: crypto.randomUUID(), roundId: round.roundId });
  return <section className="game-view" aria-label="Spielphase">
    <h2>{round.game.title}</h2>
    {round.phase === "start" && <>
      <p>{round.game.rules}</p><p>Frage 1 von {round.questionCount}</p>
      <button type="button" onClick={() => command("game.start")}>Spielphase starten</button>
    </>}
    {round.phase === "playing" && <>
      <TimerDisplay timer={round.timer} size="compact" />
      <button type="button" disabled={!round.timer.canReveal} onClick={() => command("game.reveal")}>Auflösen</button>
    </>}
    {round.phase === "evaluation" && (round.hasNextQuestion
      ? <button type="button" onClick={() => command("game.next")}>Nächste Frage</button>
      : <button type="button" onClick={() => command("game.finish")}>Spiel beenden / Zur Übersicht</button>)}
  </section>;
}
