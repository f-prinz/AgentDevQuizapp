import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import type { Answer, HostSnapshot, PlayerSnapshot, ProjectorSnapshot, RankingEntry, Snapshot, Timer } from "@raccoons/contracts";

type Send = (message: Record<string, unknown>) => void;

const KIND_LABEL: Record<string, string> = { quiz: "Quiz", sorting: "Sortieren", estimation: "Schätzen" };

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
    <code className="link-copy-text">{link}</code>
    <button type="button" aria-label={`${label} kopieren`} onClick={() => { void copyText(url).then(ok => { if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 1600); } }); }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9 9h2V7H9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2h-2v2H9V9Zm5-5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-6Zm0 2h6v9h-6V6Z"/></svg>
    </button>
    {copied && <span className="link-copied" role="status">Kopiert</span>}
  </span>;
}

function GameList({ games, label }: { games: Snapshot["catalog"]; label: string }) {
  return <section aria-label={label}><h3>{label}</h3>
    {games.length === 0 ? <p>Keine Spiele.</p> : <ul>{games.map(game => <li key={game.id}>{KIND_LABEL[game.kind] ?? game.kind}: {game.title}</li>)}</ul>}
  </section>;
}

function RankingTable({ ranking, transition }: { ranking: RankingEntry[]; transition: NonNullable<Snapshot["rankingTransition"]> | null }) {
  const [stage, setStage] = useState<"before" | "counting" | "after">("after");
  const [progress, setProgress] = useState(1);
  useEffect(() => {
    if (!transition) { setStage("after"); return; }
    setStage("before");
    const counting = window.setTimeout(() => setStage("counting"), 800);
    const after = window.setTimeout(() => setStage("after"), 2400);
    return () => { window.clearTimeout(counting); window.clearTimeout(after); };
  }, [transition]);
  useEffect(() => {
    if (stage !== "counting") { setProgress(1); return; }
    setProgress(0);
    const interval = window.setInterval(() => setProgress(value => Math.min(1, value + 0.1)), 120);
    return () => window.clearInterval(interval);
  }, [stage]);

  const transitionGameId = transition?.gameId ?? null;
  const shown = stage === "after" || !transition ? ranking : transition.previous;
  const gameIds = [...new Set(shown.flatMap(entry => entry.games.map(game => game.gameId)).concat(stage === "after" || !transition ? [] : [transition.gameId]))];
  const target = transition ? new Map(transition.current.map(entry => [entry.playerId, entry])) : null;
  const displayTotal = (entry: RankingEntry) => {
    if (stage !== "counting" || !target) return entry.total;
    const next = target.get(entry.playerId);
    return next ? Math.round(entry.total + (next.total - entry.total) * progress) : entry.total;
  };
  const gamePoints = (entry: RankingEntry, gameId: string) => {
    if (stage === "counting" && target) {
      const next = target.get(entry.playerId);
      const current = entry.games.find(game => game.gameId === gameId)?.points ?? 0;
      const goal = next?.games.find(game => game.gameId === gameId)?.points ?? current;
      return Math.round(current + (goal - current) * progress);
    }
    const source = (stage === "after" || !transition ? entry.games : (gameId === transitionGameId ? [] : entry.games));
    return source.find(game => game.gameId === gameId)?.points ?? null;
  };

  if (gameIds.length === 0 && stage === "after") return null;
  return <table className={`ranking-table ranking-${stage}`} data-ranking-stage={stage}>
    <thead><tr><th>Platz</th><th>Punkte</th><th>Spielername</th>{gameIds.map((gameId, index) => <th key={gameId} className={gameId === transitionGameId && stage !== "after" ? "ranking-col-new" : ""}>Spiel {index + 1}</th>)}</tr></thead>
    <tbody>{shown.map(entry => <tr key={entry.playerId} className={stage === "after" && transition ? "ranking-row-final" : ""}>
      <td>{entry.rank}</td><td>{displayTotal(entry)}</td><td>{entry.name}</td>
      {gameIds.map(gameId => <td key={gameId} className={gameId === transitionGameId && stage !== "after" ? "ranking-col-new" : ""}>{gamePoints(entry, gameId) ?? "–"}</td>)}
    </tr>)}</tbody>
  </table>;
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

function TimerDisplay({ timer, size }: { timer: Timer; size: "compact" | "large" }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((timer.deadline - timer.serverTime) / 1000)));
  useEffect(() => {
    const startedAt = Date.now();
    const initial = Math.max(0, timer.deadline - timer.serverTime);
    const update = () => setRemaining(Math.max(0, Math.ceil((initial - (Date.now() - startedAt)) / 1000)));
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [timer.deadline, timer.serverTime]);
  return <p className={`game-timer timer-${size}`} role="timer" aria-label={`Verbleibende Zeit: ${remaining} Sekunden`}>{remaining} s</p>;
}

function Results({ results }: { results: Array<{ playerId: string; name: string; points: number; rank: number | null; distance: number | null; errors: number | null }> }) {
  if (results.length === 0) return <p>Noch keine Ergebnisse vorhanden.</p>;
  return <section aria-label="Ergebnisse"><h3>Ergebnisse</h3><ol>{results.map(result => <li key={result.playerId}>
    {result.name}: {result.points} Punkte{result.rank ? `, Platz ${result.rank}` : ""}
    {result.distance !== null ? `, Abstand ${result.distance}` : ""}
    {result.errors !== null ? `, ${result.errors} Fehler` : ""}
  </li>)}</ol></section>;
}

export function HostGameView({ snapshot, send }: { snapshot: HostSnapshot; send: Send }) {
  const round = snapshot.round;
  if (!round) {
    if (snapshot.phase === "overview") return <HostOverview snapshot={snapshot} send={send} />;
    return <section className="game-view" aria-label="Lobbyphase"><h2>Lobby</h2>
      <p>Sobald mindestens zwei Spieler beigetreten sind, kannst du die Lobby zur Übersicht starten.</p>
      <div className="lobby-links">
        <p>Spieler-Link: <CopyLinkButton label="Spieler-Link" link={snapshot.links.player} /></p>
        <p>Projektor-Link: <CopyLinkButton label="Projektor-Link" link={snapshot.links.projector} /></p>
      </div>
      <button type="button" disabled={!snapshot.canStartLobby} onClick={() => send({ version: 1, type: "lobby.start", requestId: crypto.randomUUID() })}>Lobby starten</button>
    </section>;
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

function SolutionContent({ solution }: { solution: { kind: "quiz"; question: string; options: Array<{ id: string; text: string }>; correctOptionId: string } | { kind: "sorting"; question: string; terms: Array<{ id: string; text: string; value: number }> } | { kind: "estimation"; question: string; target: number } }) {
  return <div className="solution"><h3>Auflösung</h3><p>{solution.question}</p>
    {solution.kind === "quiz" && <ul className="answer-feedback" aria-label="Auflösung der Antworten">{solution.options.map(option => {
      const correct = option.id === solution.correctOptionId;
      const state = correct ? "correct" : "neutral";
      return <li key={option.id} className={`answer-marked answer-${state}`} data-answer-state={state}>{option.text}<span className="answer-mark">{correct ? "Richtig" : ""}</span></li>;
    })}</ul>}
    {solution.kind === "sorting" && <ol>{[...solution.terms].sort((a, b) => a.value - b.value).map(term => <li key={term.id}>{term.text}: {term.value}</li>)}</ol>}
    {solution.kind === "estimation" && <p>Lösung: {solution.target}</p>}
  </div>;
}

export function PlayerGameView({ snapshot, send }: { snapshot: PlayerSnapshot; send: Send }) {
  const round = snapshot.round;
  const [draft, setDraft] = useState<Answer | null>(snapshot.input.answer);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  useEffect(() => setDraft(snapshot.input.answer), [snapshot.revision, snapshot.input.answer]);
  if (!round) return <section className="game-view" aria-label="Spielbeginn"><h2>Das Spiel beginnt gleich …</h2></section>;
  const canEdit = round.phase === "playing" && snapshot.input.participating && !snapshot.input.final && !round.timer.inputClosed;
  const sendAnswer = (answer: Answer) => {
    if (!canEdit || round.phase !== "playing") return;
    setDraft(answer);
    send({ version: 1, type: "answer.set", requestId: crypto.randomUUID(), roundId: round.roundId, answer });
  };
  const submit = () => {
    if (!canEdit || !draft || round.phase !== "playing") return;
    send({ version: 1, type: "answer.submit", requestId: crypto.randomUUID(), roundId: round.roundId, answer: draft });
  };
  return <section className="game-view" aria-label="Spielphase">
    <h2>{round.game.title}</h2>
    {round.phase === "start" && <div className="game-start-animation" role="region" aria-label="Startanimation"><p>{round.game.rules}</p><p>Das Spiel beginnt gleich …</p></div>}
    {round.phase === "playing" && <>
      <TimerDisplay timer={round.timer} size="compact" />
      {!snapshot.input.participating ? <><p role="status">Du steigst bei der nächsten Spielauswahl ein. In dieser Runde ist keine Antwort möglich.</p><button type="button" disabled>Abgeben</button></> : <>
        {round.task.kind === "quiz" && <div className="answer-options" role="group" aria-label="Antwortoptionen">{round.task.options.map(option => {
          const chosen = draft?.kind === "quiz" && draft.optionId === option.id;
          return <button type="button" key={option.id} className={`answer-option${chosen ? " answer-selected" : ""}`} data-answer-state={chosen ? "selected" : "neutral"} disabled={!canEdit} onClick={() => sendAnswer({ kind: "quiz", optionId: option.id })}>{option.text}</button>;
        })}</div>}
        {round.task.kind === "sorting" && <fieldset disabled={!canEdit}><legend>Ordne die Begriffe</legend><ol className="sortable-terms">{(draft?.kind === "sorting" ? draft.termIds : round.task.terms.map(term => term.id)).map((id, index, ids) => {
          const term = round.task.kind === "sorting" ? round.task.terms.find(item => item.id === id) : undefined;
          return <li key={id} draggable={canEdit} className={dragIndex === index ? "sortable-dragging" : undefined}
            onDragStart={event => { setDragIndex(index); event.dataTransfer.setData("text/plain", String(index)); event.dataTransfer.effectAllowed = "move"; }}
            onDragOver={event => { if (canEdit) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
            onDrop={event => {
              if (!canEdit) return;
              event.preventDefault();
              const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
              if (Number.isFinite(from) && from !== index) {
                const next = [...ids];
                const [moved] = next.splice(from, 1);
                next.splice(index, 0, moved);
                sendAnswer({ kind: "sorting", termIds: next });
              }
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}><span>{term?.text ?? "Begriff"}</span><button type="button" disabled={!canEdit || index === 0} aria-label={`Verschiebe ${term?.text ?? "Begriff"} nach oben`} onClick={() => sendAnswer({ kind: "sorting", termIds: ids.map((item, i) => i === index - 1 ? ids[index] : i === index ? ids[index - 1] : item) })}>↑</button><button type="button" disabled={!canEdit || index === ids.length - 1} aria-label={`Verschiebe ${term?.text ?? "Begriff"} nach unten`} onClick={() => sendAnswer({ kind: "sorting", termIds: ids.map((item, i) => i === index ? ids[index + 1] : i === index + 1 ? ids[index] : item) })}>↓</button></li>;
        })}</ol></fieldset>}
        {round.task.kind === "estimation" && <label className="estimation-input">Deine Schätzung<input type="number" value={draft?.kind === "estimation" ? draft.value : ""} disabled={!canEdit} onChange={event => { const value = Number(event.target.value); if (event.target.value !== "" && Number.isFinite(value)) sendAnswer({ kind: "estimation", value }); }} /></label>}
        {!snapshot.input.final && !round.timer.inputClosed && <button type="button" disabled={!canEdit || !draft} onClick={submit}>Abgeben</button>}
      </>}
    </>}
    {round.phase === "evaluation" && <>{round.solution.kind === "quiz"
      ? <div className="solution"><h3>Auflösung</h3><p>{round.solution.question}</p></div>
      : <SolutionContent solution={round.solution} />}
      {round.solution.kind === "quiz" && <ul className="answer-feedback" aria-label={round.ownEvaluation.answer?.kind === "quiz" ? "Deine Antwort" : "Antworten"}>{round.solution.options.map(option => {
        const ownAnswer = round.ownEvaluation.answer;
        const selected = ownAnswer?.kind === "quiz" && ownAnswer.optionId === option.id;
        const correct = round.solution.kind === "quiz" && round.solution.correctOptionId === option.id;
        const state = selected ? (correct ? "correct" : "wrong") : (correct ? "correct" : "neutral");
        return <li key={option.id} className={`answer-marked answer-${state}`} data-answer-state={state}>{option.text}<span className="answer-mark">{selected ? (correct ? "Deine Antwort · Richtig" : "Deine Antwort · Falsch") : correct ? "Richtig" : ""}</span></li>;
      })}</ul>}
      {round.solution.kind === "sorting" && round.ownEvaluation.answer?.kind === "sorting" && <ol className="answer-feedback" aria-label="Deine Antwort">{round.ownEvaluation.answer.termIds.map((termId, index) => {
        const term = round.solution.kind === "sorting" ? round.solution.terms.find(item => item.id === termId) : undefined;
        const correct = round.ownEvaluation.positionsCorrect?.[index] === true;
        const state = correct ? "correct" : "wrong";
        return <li key={termId} className={`answer-marked answer-${state}`} data-answer-state={state}>{term?.text ?? "Begriff"}<span className="answer-mark">{correct ? "Richtig" : "Falsch"}</span></li>;
      })}</ol>}
      {round.ownEvaluation.answer && round.solution.kind !== "quiz" && <p>Deine abgegebene Antwort: {answerLabel(round.ownEvaluation.answer, [])}</p>}
      {round.ownEvaluation.distance !== null && <p>Dein Abstand zur Lösung: {round.ownEvaluation.distance}</p>}
      <p>Deine Punkte: {round.ownEvaluation.points}</p>
    </>}
  </section>;
}

function answerLabel(answer: Answer, options: Array<{ id: string; text: string }>) {
  if (answer.kind === "quiz") return options.find(option => option.id === answer.optionId)?.text ?? "Ausgewählt";
  if (answer.kind === "sorting") return `Sortierung mit ${answer.termIds.length} Begriffen`;
  return String(answer.value);
}

export function ProjectorRanking({ snapshot }: { snapshot: ProjectorSnapshot }) {
  return <>
    <RankingTable ranking={snapshot.ranking} transition={snapshot.rankingTransition} />
    {snapshot.ranking.length === 0 && <ol className="ranking-names">{snapshot.participants.map(participant => <li key={participant.id}>{participant.name || `Spieler ${participant.number}`}</li>)}</ol>}
  </>;
}

export function ProjectorGameView({ snapshot }: { snapshot: ProjectorSnapshot; send: Send }) {
  const round = snapshot.round;
  if (!round) {
    if (snapshot.phase === "lobby") {
      const joinUrl = new URL(snapshot.playerLink, window.location.origin).href;
      return <section className="projector-lobby" aria-label="Spielerbeitritt">
        <p className="player-link">{snapshot.playerLink}</p>
        <div role="img" aria-label="QR-Code zum Spieler-Link"><QRCode value={joinUrl} size={256} /></div>
      </section>;
    }
    if (snapshot.phase !== "overview") return <p>Warte auf die Spielauswahl.</p>;
    const unplayed = snapshot.catalog.filter(game => !game.played);
    const played = snapshot.catalog.filter(game => game.played);
    return <section className="projector-overview" aria-label="Übersicht">
      <div className="overview-columns">
        <GameList games={unplayed} label="Offene Spiele" />
        <GameList games={played} label="Gespielte Spiele" />
      </div>
    </section>;
  }
  return <div className="projector-game">
    <h3>{round.game.title}</h3>
    {round.phase === "start" && <><p>{round.game.rules}</p><p>Das Spiel beginnt gleich …</p></>}
    {round.phase === "playing" && <><h4>Frage {round.questionIndex + 1} von {round.questionCount}</h4><p>{round.task.question}</p><TimerDisplay timer={round.timer} size="large" /></>}
    {round.phase === "evaluation" && <><SolutionContent solution={round.solution} /><Results results={round.results} /></>}
  </div>;
}
