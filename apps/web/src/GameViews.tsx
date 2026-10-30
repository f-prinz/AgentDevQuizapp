import { useEffect, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as QRCodeModule from "react-qr-code";
import type { QRCodeProps } from "react-qr-code";
import { Podium, Ruler, Star, User } from "lucide-react";
import type { Answer, HostSnapshot, PlayerSnapshot, ProjectorSnapshot, RankingEntry, Snapshot, Timer } from "@raccoons/contracts";

// BUG-2: react-qr-code ist reines CJS — je nach Interop (Vite-Dev vs. Vitest)
// liefert der Import ein verschachteltes Namespace-Objekt statt der Komponente
// ({ default: { QRCode } }, { QRCode } oder die Funktion direkt).
// .default-Ketten auspacken; landet das in einem Objekt ohne weitere
// .default-Ebene, liegt die Komponente als Funktionswert darin (QRCode-Key).
export function resolveComponent<T>(mod: unknown): T {
  let resolved: unknown = mod;
  while (resolved !== null && typeof resolved === "object" && "default" in resolved) {
    resolved = (resolved as { default: unknown }).default;
  }
  if (resolved !== null && typeof resolved === "object") {
    const component = Object.values(resolved).find(value => typeof value === "function");
    if (component) resolved = component;
  }
  return resolved as T;
}

const QRCode = resolveComponent<React.ComponentType<QRCodeProps>>(QRCodeModule);

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

  // CHG-6: Rangliste immer nach Platz sortiert ausgeben.
  const shown = [...(stage === "after" || !transition ? ranking : transition.previous)]
    .sort((a, b) => a.rank - b.rank);
  const target = transition ? new Map(transition.current.map(entry => [entry.playerId, entry])) : null;
  const displayTotal = (entry: RankingEntry) => {
    if (stage !== "counting" || !target) return entry.total;
    const next = target.get(entry.playerId);
    return next ? Math.round(entry.total + (next.total - entry.total) * progress) : entry.total;
  };

  // CHG-13: Die Tabelle bleibt immer sichtbar (kein Flackern bei leeren
  // Snapshots); Koepfe zeigen Icons, Labels bleiben als aria-label.
  return <table className={`ranking-table ranking-${stage}`} data-ranking-stage={stage}>
    <thead><tr>
      <th aria-label="Platz"><Podium aria-hidden size="1em" /></th>
      <th aria-label="Punkte"><Star aria-hidden size="1em" /></th>
      <th aria-label="Spielername"><User aria-hidden size="1em" /></th>
    </tr></thead>
    <tbody>{shown.map(entry => <tr key={entry.playerId} className={stage === "after" && transition ? "ranking-row-final" : ""}>
      <td>{entry.rank}</td><td>{displayTotal(entry)}</td><td>{entry.name}</td>
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

export function Results({ kind, results }: { kind: "quiz" | "sorting" | "estimation"; results: Array<{ playerId: string; name: string; points: number; rank: number | null; distance: number | null; errors: number | null }> }) {
  if (results.length === 0) return <section className="results" aria-label="Ergebnisse"><h2>Ergebnisse</h2><p>Noch keine Ergebnisse vorhanden.</p></section>;
  // CHG-13: Ergebnisse als kompakte Tabelle (bis 25 Spieler) — sortiert nach
  // Platzierung, bei Spielen ohne Rang (Quiz) nach Punkten absteigend.
  const sorted = [...results].sort((a, b) =>
    (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || b.points - a.points);
  const withRank = kind !== "quiz";
  const withDistance = kind === "estimation";
  return <section className="results" aria-label="Ergebnisse"><h2>Ergebnisse</h2>
    <table className="results-table"><thead><tr>
      {withRank && <th aria-label="Platzierung"><Podium aria-hidden size="1em" /></th>}
      <th aria-label="Punkte"><Star aria-hidden size="1em" /></th>
      {withDistance && <th aria-label="Differenz"><Ruler aria-hidden size="1em" /></th>}
      <th aria-label="Spielername"><User aria-hidden size="1em" /></th>
    </tr></thead>
    <tbody>{sorted.map(result => <tr key={result.playerId}>
      {withRank && <td>{result.rank ?? "–"}</td>}
      <td>{result.points}</td>
      {withDistance && <td>{result.distance ?? "–"}</td>}
      <td>{result.name}</td>
    </tr>)}</tbody></table>
  </section>;
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
  // CHG-13: Die Frage steht im Stage-Slot ueber dem Eval-Grid, nicht in der Box.
  return <div className="solution"><h3>Auflösung</h3>
    {solution.kind === "quiz" && <ul className="answer-feedback" aria-label="Auflösung der Antworten">{solution.options.map(option => {
      const correct = option.id === solution.correctOptionId;
      const state = correct ? "correct" : "neutral";
      return <li key={option.id} className={`answer-marked answer-${state}`} data-answer-state={state}>{option.text}<span className="answer-mark">{correct ? "Richtig" : ""}</span></li>;
    })}</ul>}
    {solution.kind === "sorting" && <ol>{[...solution.terms].sort((a, b) => a.value - b.value).map(term => <li key={term.id}>{term.text}: {term.value}</li>)}</ol>}
    {solution.kind === "estimation" && <p>Lösung: {solution.target}</p>}
  </div>;
}

function SortableTerm({ id, canEdit, children }: { id: string; canEdit: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !canEdit });
  // BUG-3: touch-action:none ist Pflicht für PointerSensor-Drags auf Touch-Geräten
  // (sonst wertet der Browser die Geste als Scroll und feuert keine Pointer-Moves).
  const style = { transform: CSS.Transform.toString(transform), transition, touchAction: "none" };
  return <li ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? "answer-tile sortable-dragging" : "answer-tile"}>{children}</li>;
}

export function PlayerGameView({ snapshot, send }: { snapshot: PlayerSnapshot; send: Send }) {
  const round = snapshot.round;
  const [draft, setDraft] = useState<Answer | null>(snapshot.input.answer);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useEffect(() => setDraft(snapshot.input.answer), [snapshot.revision, snapshot.input.answer]);
  // CHG-6: Eigene Identitaet immer oben — Name, plus Punkte und Platz wenn vorhanden.
  const mine = snapshot.ranking.find(entry => entry.playerId === snapshot.playerId);
  const myName = mine?.name ?? snapshot.participants.find(player => player.id === snapshot.playerId)?.name ?? "Spieler";
  // CHG-16: Identitaet mit Icons — Rang (Podium) vor Punkten (Stern).
  const identity = <h2 className="player-identity">{myName}{mine ? <> - <Podium aria-hidden size="1em" /> {mine.rank} <Star aria-hidden size="1em" /> {mine.total}</> : ""}</h2>;
  // CHG-7: Die Identitaetszeile steht oberhalb der Card, nicht darin.
  if (!round) return <>{identity}<section className="game-view" aria-label="Spielbeginn"><h3>Das Spiel beginnt gleich …</h3></section></>;
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
  const onSortEnd = (ids: string[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!canEdit || !over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    sendAnswer({ kind: "sorting", termIds: next });
  };
  return <>{identity}<section className="game-view" aria-label="Spielphase">
    {round.game.kind !== "sorting" && <h3>{round.game.title}</h3>}
    {round.phase === "start" && <div className="game-start-animation" role="region" aria-label="Startanimation"><p>Das Spiel beginnt gleich …</p></div>}
    {round.phase === "playing" && <>
      <TimerDisplay timer={round.timer} size="compact" />
      {!snapshot.input.participating ? <><p role="status">Du steigst bei der nächsten Spielauswahl ein. In dieser Runde ist keine Antwort möglich.</p><button type="button" disabled>Abgeben</button></> : <>
        {round.task.kind === "quiz" && <div className="answer-options" role="group" aria-label="Antwortoptionen">{round.task.options.map(option => {
          const chosen = draft?.kind === "quiz" && draft.optionId === option.id;
          return <button type="button" key={option.id} className={`answer-tile answer-option${chosen ? " answer-selected" : ""}`} data-answer-state={chosen ? "selected" : "neutral"} disabled={!canEdit} onClick={() => sendAnswer({ kind: "quiz", optionId: option.id })}>{option.text}</button>;
        })}</div>}
        {round.task.kind === "sorting" && (() => {
          const ids = draft?.kind === "sorting" ? draft.termIds : round.task.terms.map(term => term.id);
          return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSortEnd(ids)}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ol className="sortable-terms">{ids.map(id => {
                  const term = round.task.kind === "sorting" ? round.task.terms.find(item => item.id === id) : undefined;
                  return <SortableTerm key={id} id={id} canEdit={canEdit}>
                    <span>{term?.text ?? "Begriff"}</span>
                  </SortableTerm>;
                })}</ol>
              </SortableContext>
            </DndContext>;
        })()}
        {round.task.kind === "estimation" && <div className="answer-tile estimation-panel"><label className="estimation-input">Deine Schätzung<input type="number" value={draft?.kind === "estimation" ? draft.value : ""} disabled={!canEdit} onChange={event => { const value = Number(event.target.value); if (event.target.value !== "" && Number.isFinite(value)) sendAnswer({ kind: "estimation", value }); }} /></label></div>}
        {!snapshot.input.final && !round.timer.inputClosed && <button type="button" disabled={!canEdit || !draft} onClick={submit}>Abgeben</button>}
      </>}
    </>}
    {/* CHG-8: Spieler sehen in der Evaluation keine Aufloesungs-Box und keine
        Marktexte — die farbliche Markierung der Antworten reicht aus. */}
    {round.phase === "evaluation" && <>
      {round.solution.kind === "quiz" && <ul className="answer-feedback" aria-label={round.ownEvaluation.answer?.kind === "quiz" ? "Deine Antwort" : "Antworten"}>{round.solution.options.map(option => {
        const ownAnswer = round.ownEvaluation.answer;
        const selected = ownAnswer?.kind === "quiz" && ownAnswer.optionId === option.id;
        const correct = round.solution.kind === "quiz" && round.solution.correctOptionId === option.id;
        const state = selected ? (correct ? "correct" : "wrong") : (correct ? "correct" : "neutral");
        // CHG-8: Die richtige Antwort blinkt 3 s im 0,5-s-Takt; Zielfarbe haengt
        // davon ab, ob der Spieler sie gewaehlt hat (rot) oder nicht (grau).
        const flash = correct ? ` answer-flash-${selected ? "own" : "missed"}` : "";
        const stateLabel = state === "correct" ? "Richtig" : state === "wrong" ? "Deine Antwort, falsch" : "Nicht gewählt";
        return <li key={option.id} className={`answer-tile answer-marked answer-${state}${flash}`} data-answer-state={state} aria-label={`${option.text}: ${stateLabel}`}>{option.text}</li>;
      })}</ul>}
      {round.solution.kind === "sorting" && round.ownEvaluation.answer?.kind === "sorting" && <ol className="answer-feedback" aria-label="Deine Antwort">{round.ownEvaluation.answer.termIds.map((termId, index) => {
        const term = round.solution.kind === "sorting" ? round.solution.terms.find(item => item.id === termId) : undefined;
        const correct = round.ownEvaluation.positionsCorrect?.[index] === true;
        const state = correct ? "correct" : "wrong";
        return <li key={termId} className={`answer-tile answer-marked answer-${state}`} data-answer-state={state} aria-label={`${term?.text ?? "Begriff"}: ${correct ? "Richtig" : "Falsch"}`}>{term?.text ?? "Begriff"}</li>;
      })}</ol>}
      {round.ownEvaluation.answer && round.solution.kind === "estimation" && <p>Deine abgegebene Antwort: {answerLabel(round.ownEvaluation.answer, [])}</p>}
      {round.ownEvaluation.distance !== null && <p>Dein Abstand zur Lösung: {round.ownEvaluation.distance}</p>}
      <p>Deine Punkte: {round.ownEvaluation.points}</p>
    </>}
  </section></>;
}

function answerLabel(answer: Answer, options: Array<{ id: string; text: string }>) {
  if (answer.kind === "quiz") return options.find(option => option.id === answer.optionId)?.text ?? "Ausgewählt";
  if (answer.kind === "sorting") return `Sortierung mit ${answer.termIds.length} Begriffen`;
  return String(answer.value);
}

export function ProjectorRanking({ snapshot }: { snapshot: ProjectorSnapshot }) {
  // CHG-13: Kein Namenslisten-Fallback mehr — die Tabelle ist immer da und
  // zeigt seit CHG-12 alle Spieler auch vor dem ersten Spiel mit 0 Punkten.
  return <RankingTable ranking={snapshot.ranking} transition={snapshot.rankingTransition} />;
}

export function ProjectorGameView({ snapshot }: { snapshot: ProjectorSnapshot; send: Send }) {
  const round = snapshot.round;
  if (!round) {
    if (snapshot.phase === "lobby") {
      const joinUrl = new URL(snapshot.playerLink, window.location.origin).href;
      return <section className="projector-lobby" aria-label="Spielerbeitritt">
        <p className="player-link">{joinUrl}</p>
        <div role="img" aria-label="QR-Code zum Spieler-Link"><QRCode value={joinUrl} size={256} /></div>
      </section>;
    }
    if (snapshot.phase !== "overview") return <p>Warte auf die Spielauswahl.</p>;
    const unplayed = snapshot.catalog.filter(game => !game.played);
    const played = snapshot.catalog.filter(game => game.played);
    return <section className="projector-overview" aria-label="Übersicht"><h2>Spielübersicht</h2>
      <div className="overview-columns">
        <GameList games={unplayed} label="Offene Spiele" />
        <GameList games={played} label="Gespielte Spiele" />
      </div>
    </section>;
  }
  // CHG-13: '.projector-stage' ist in allen Phasen derselbe Slot — Regeltext,
  // Frage und Aufloesungs-Frage stehen an identischer Position.
  // CHG-14: Die Aufloesung bleibt unter der Frage im Spielbereich; die
  // Ergebnis-Tabelle haengt ProjectorPage als eigene Layout-Spalte an.
  return <div className="projector-game">
    {round.game.kind !== "sorting" && <h3>{round.game.title}</h3>}
    {round.phase === "start" && <><p className="projector-stage">{round.game.rules}</p><p>Das Spiel beginnt gleich …</p></>}
    {round.phase === "playing" && <>
      <p className="projector-stage projector-question"><span className="projector-count">Frage {round.questionIndex + 1} von {round.questionCount}</span>{round.task.question}</p>
      <TimerDisplay timer={round.timer} size="large" />
    </>}
    {round.phase === "evaluation" && <>
      <p className="projector-stage projector-question"><span className="projector-count">Frage {round.questionIndex + 1} von {round.questionCount}</span>{round.solution.question}</p>
      <SolutionContent solution={round.solution} />
    </>}
  </div>;
}
