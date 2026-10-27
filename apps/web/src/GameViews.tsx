import { useEffect, useState } from "react";
import type { Answer, HostSnapshot, PlayerSnapshot, ProjectorSnapshot, Timer } from "@raccoons/contracts";

type Send = (message: Record<string, unknown>) => void;

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
  if (!round) return <section className="game-view" aria-label="Spielphase"><h2>Spielauswahl</h2><p>Wähle ein Spiel aus der Lobbyübersicht.</p></section>;
  const command = (type: string) => send({ version: 1, type, requestId: crypto.randomUUID(), roundId: round.roundId });
  return <section className="game-view" aria-label="Spielphase">
    <h2>{round.game.title}</h2>
    <p className="phase-label">{round.phase === "start" ? "Startphase" : round.phase === "playing" ? "Spielphase" : "Auswertung"}</p>
    {round.phase === "start" && <>
      <p>{round.game.rules}</p><p>Frage 1 von {round.questionCount}</p>
      <button type="button" onClick={() => command("game.start")}>Spielphase starten</button>
    </>}
    {round.phase === "playing" && <>
      <p>Frage {round.questionIndex + 1} von {round.questionCount}: {round.task.question}</p>
      {round.task.kind === "quiz" && <ul>{round.task.options.map(option => <li key={option.id}>{option.text}</li>)}</ul>}
      <TimerDisplay timer={round.timer} size="compact" />
      <p>{round.timer.inputClosed ? "Die Eingabezeit ist beendet." : "Antworten werden entgegengenommen."}</p>
      <button type="button" disabled={!round.timer.canReveal} onClick={() => command("game.reveal")}>Auflösen</button>
    </>}
    {round.phase === "evaluation" && <>
      <SolutionContent solution={round.solution} />
      <Results results={round.results} />
      {round.hasNextQuestion
        ? <button type="button" onClick={() => command("game.next")}>Nächste Frage</button>
        : <button type="button" onClick={() => command("game.finish")}>Spiel beenden / Zur Übersicht</button>}
    </>}
  </section>;
}

function SolutionContent({ solution }: { solution: { kind: "quiz"; question: string; options: Array<{ id: string; text: string }>; correctOptionId: string } | { kind: "sorting"; question: string; terms: Array<{ id: string; text: string; value: number }> } | { kind: "estimation"; question: string; target: number } }) {
  return <div className="solution"><h3>Auflösung</h3><p>{solution.question}</p>
    {solution.kind === "quiz" && <p>Richtige Antwort: {solution.options.find(option => option.id === solution.correctOptionId)?.text ?? "Antwort nicht verfügbar"}</p>}
    {solution.kind === "sorting" && <ol>{[...solution.terms].sort((a, b) => a.value - b.value).map(term => <li key={term.id}>{term.text}: {term.value}</li>)}</ol>}
    {solution.kind === "estimation" && <p>Lösung: {solution.target}</p>}
  </div>;
}

export function PlayerGameView({ snapshot, send }: { snapshot: PlayerSnapshot; send: Send }) {
  const round = snapshot.round;
  const [draft, setDraft] = useState<Answer | null>(snapshot.input.answer);
  useEffect(() => setDraft(snapshot.input.answer), [snapshot.revision, snapshot.input.answer]);
  if (!round) return <section className="game-view" aria-label="Spielphase"><h2>Warte auf die nächste Spielauswahl</h2></section>;
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
    <p className="phase-label">{round.phase === "start" ? "Startphase" : round.phase === "playing" ? "Spielphase" : "Auswertung"}</p>
    {round.phase === "start" && <div className="game-start-animation" role="region" aria-label="Startanimation"><p>{round.game.rules}</p><p>Das Spiel beginnt gleich …</p></div>}
    {round.phase === "playing" && <>
      <TimerDisplay timer={round.timer} size="compact" />
      <h3>Frage {round.questionIndex + 1} von {round.questionCount}</h3><p>{round.task.question}</p>
      {!snapshot.input.participating ? <><p role="status">Du steigst bei der nächsten Spielauswahl ein. In dieser Runde ist keine Antwort möglich.</p><button type="button" disabled>Abgeben</button></> : <>
        {round.task.kind === "quiz" && <fieldset disabled={!canEdit}><legend>Wähle eine Antwort</legend>{round.task.options.map(option => <label className="answer-option" key={option.id}>
          <input type="radio" name="quiz-answer" value={option.id} checked={draft?.kind === "quiz" && draft.optionId === option.id} onChange={() => sendAnswer({ kind: "quiz", optionId: option.id })} />{option.text}
        </label>)}</fieldset>}
        {round.task.kind === "sorting" && <fieldset disabled={!canEdit}><legend>Ordne die Begriffe</legend><ol className="sortable-terms">{(draft?.kind === "sorting" ? draft.termIds : round.task.terms.map(term => term.id)).map((id, index, ids) => {
          const term = round.task.kind === "sorting" ? round.task.terms.find(item => item.id === id) : undefined;
          return <li key={id}><span>{term?.text ?? "Begriff"}</span><button type="button" disabled={!canEdit || index === 0} aria-label={`Verschiebe ${term?.text ?? "Begriff"} nach oben`} onClick={() => sendAnswer({ kind: "sorting", termIds: ids.map((item, i) => i === index - 1 ? ids[index] : i === index ? ids[index - 1] : item) })}>↑</button><button type="button" disabled={!canEdit || index === ids.length - 1} aria-label={`Verschiebe ${term?.text ?? "Begriff"} nach unten`} onClick={() => sendAnswer({ kind: "sorting", termIds: ids.map((item, i) => i === index ? ids[index + 1] : i === index + 1 ? ids[index] : item) })}>↓</button></li>;
        })}</ol></fieldset>}
        {round.task.kind === "estimation" && <label className="estimation-input">Deine Schätzung<input type="number" value={draft?.kind === "estimation" ? draft.value : ""} disabled={!canEdit} onChange={event => { const value = Number(event.target.value); if (event.target.value !== "" && Number.isFinite(value)) sendAnswer({ kind: "estimation", value }); }} /></label>}
        {snapshot.input.final ? <p role="status">Deine Antwort ist final abgegeben.</p> : round.timer.inputClosed ? <p role="status">Die Eingabezeit ist beendet.</p> : <button type="button" disabled={!canEdit || !draft} onClick={submit}>Abgeben</button>}
      </>}
    </>}
    {round.phase === "evaluation" && <><SolutionContent solution={round.solution} />
      {snapshot.input.answer && <p>Deine abgegebene Antwort: {answerLabel(snapshot.input.answer, round.solution.kind === "quiz" ? round.solution.options : [])}</p>}
      <p>Deine Punkte: {round.ownEvaluation.points}</p>
    </>}
  </section>;
}

function answerLabel(answer: Answer, options: Array<{ id: string; text: string }>) {
  if (answer.kind === "quiz") return options.find(option => option.id === answer.optionId)?.text ?? "Ausgewählt";
  if (answer.kind === "sorting") return `Sortierung mit ${answer.termIds.length} Begriffen`;
  return String(answer.value);
}

export function ProjectorGameView({ snapshot }: { snapshot: ProjectorSnapshot; send: Send }) {
  const round = snapshot.round;
  if (!round) return <p>Warte auf die Spielauswahl.</p>;
  return <div className="projector-game">
    <h3>{round.game.title}</h3>
    {round.phase === "start" && <><p>{round.game.rules}</p><p>Das Spiel beginnt gleich …</p></>}
    {round.phase === "playing" && <><h4>Frage {round.questionIndex + 1} von {round.questionCount}</h4><p>{round.task.question}</p><TimerDisplay timer={round.timer} size="large" /></>}
    {round.phase === "evaluation" && <><SolutionContent solution={round.solution} /><Results results={round.results} /></>}
  </div>;
}
