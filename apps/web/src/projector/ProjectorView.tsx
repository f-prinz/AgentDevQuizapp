import type { ProjectorSnapshot, Snapshot } from "@raccoons/contracts";
import { Logo } from "../brand/Logo";
import { KIND_LABEL, QRCode } from "../shared/qr";
import { SubmissionCounter } from "../shared/SubmissionCounter";
import { TimerDisplay } from "../shared/TimerDisplay";
import { RankingBoard } from "./RankingBoard";

type Phase = Snapshot["phase"];
type Solution = Extract<NonNullable<ProjectorSnapshot["round"]>, { phase: "evaluation" }>["solution"];
type RoundResults = Extract<NonNullable<ProjectorSnapshot["round"]>, { phase: "evaluation" }>["results"];

function GameList({ games, label }: { games: Snapshot["catalog"]; label: string }) {
  return <section className="projector-games-list" aria-label={label}><h3 className="rq-display">{label}</h3>
    {games.length === 0 ? <p>Keine Spiele.</p> : <ul>{games.map(game => <li key={game.id}><span className="game-kind">{KIND_LABEL[game.kind] ?? game.kind}: </span>{game.title}</li>)}</ul>}
  </section>;
}

export function Results({ kind, results }: { kind: "quiz" | "sorting" | "estimation"; results: RoundResults }) {
  if (results.length === 0) return <section className="results" aria-label="Ergebnisse"><h2 className="rq-display">Ergebnisse</h2><p>Noch keine Ergebnisse vorhanden.</p></section>;
  // CHG-13: sortiert nach Platzierung, bei Spielen ohne Rang (Quiz) nach Punkten absteigend.
  const sorted = [...results].sort((a, b) =>
    (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || b.points - a.points);
  const withRank = kind !== "quiz";
  const withDistance = kind === "estimation";
  const withErrors = kind === "sorting";
  return <section className="results" aria-label="Ergebnisse"><h2 className="rq-display">Ergebnisse</h2>
    <table className="results-table"><thead><tr>
      {withRank && <th aria-label="Platzierung">#</th>}
      <th aria-label="Punkte">Pkt</th>
      {withDistance && <th aria-label="Differenz">Abstand</th>}
      <th aria-label="Spielername">Name</th>
      {withErrors && <th aria-label="Fehler">Fehler</th>}
    </tr></thead>
    <tbody>{sorted.map(result => <tr key={result.playerId} className={result.points > 0 ? "result-scored" : undefined}>
      {withRank && <td className="result-rank">{result.rank ?? "–"}</td>}
      <td className="result-points">{result.points > 0 ? `+${result.points}` : result.points}</td>
      {withDistance && <td>{result.distance ?? "–"}</td>}
      <td className="result-name">{result.name}</td>
      {withErrors && <td>{result.errors ?? "–"}</td>}
    </tr>)}</tbody></table>
  </section>;
}

function SolutionContent({ solution }: { solution: Solution }) {
  return <div className="solution"><h3 className="rq-display">Auflösung</h3>
    {/* CHG-22: Traegt mind. eine Option einen value, zeigt die Aufloesung eine
        Tabelle ohne Header — Text | Wert | 'Richtig'-Marker. */}
    {solution.kind === "quiz" && (solution.options.some(option => option.value !== undefined)
      ? <table className="solution-table"><tbody>{solution.options.map(option => {
          const correct = option.id === solution.correctOptionId;
          return <tr key={option.id} className={correct ? "solution-correct" : undefined}>
            <td>{option.text}</td><td>{option.value ?? ""}</td><td>{correct ? "Richtig" : ""}</td>
          </tr>;
        })}</tbody></table>
      : <ul className="answer-feedback" aria-label="Auflösung der Antworten">{solution.options.map(option => {
          const correct = option.id === solution.correctOptionId;
          const state = correct ? "correct" : "neutral";
          return <li key={option.id} className={`answer-marked answer-${state}`} data-answer-state={state}>{option.text}<span className="answer-mark">{correct ? "Richtig" : ""}</span></li>;
        })}</ul>)}
    {/* CHG-21: Sortier-Aufloesung ohne Header — Position, Text, Wert; aufsteigend nach Wert. */}
    {solution.kind === "sorting" && <table className="solution-table"><tbody>
      {[...solution.terms].sort((a, b) => a.value - b.value).map((term, index) => <tr key={term.id}>
        <td>{index + 1}</td><td>{term.text}</td><td>{term.value}</td>
      </tr>)}
    </tbody></table>}
    {solution.kind === "estimation" && <p className="solution-target">Lösung: <strong>{solution.target}</strong></p>}
  </div>;
}

function LobbyStage({ snapshot }: { snapshot: ProjectorSnapshot }) {
  const joinUrl = new URL(snapshot.playerLink, window.location.origin).href;
  return <section className="projector-lobby" aria-label="Spielerbeitritt">
    <div className="lobby-brand">
      <Logo variant="full" className="lobby-logo" />
      <p className="lobby-title rq-display"><small>Bedburg Raccoons</small>Quiz</p>
    </div>
    <div className="lobby-join">
      <p className="lobby-cta rq-display">Scannen &amp; mitspielen</p>
      <div className="lobby-qr" role="img" aria-label="QR-Code zum Spieler-Link"><QRCode value={joinUrl} size={256} /></div>
      <p className="player-link">{joinUrl}</p>
    </div>
    <div className="lobby-roster">
      <p className="lobby-count rq-display"><span>{snapshot.participants.length}</span> dabei</p>
      <ul>{snapshot.participants.map(participant => <li key={participant.id}>{participant.name}</li>)}</ul>
    </div>
  </section>;
}

function OverviewStage({ snapshot }: { snapshot: ProjectorSnapshot }) {
  return <>
    <RankingBoard ranking={snapshot.ranking} transition={snapshot.rankingTransition} />
    <aside className="projector-games" aria-label="Spielübersicht">
      <Logo variant="full" className="games-logo" />
      <GameList games={snapshot.catalog.filter(game => !game.played)} label="Offene Spiele" />
      <GameList games={snapshot.catalog.filter(game => game.played)} label="Gespielte Spiele" />
    </aside>
  </>;
}

function RoundStage({ snapshot, round }: { snapshot: ProjectorSnapshot; round: NonNullable<ProjectorSnapshot["round"]> }) {
  // CHG-13: '.projector-stage' ist in allen Phasen derselbe Slot — Regeltext,
  // Frage und Aufloesungs-Frage stehen an identischer Position.
  const count = <span className="projector-count">Frage {round.questionIndex + 1} von {round.questionCount}</span>;
  return <>
    <div className="projector-game">
      <header className="projector-game-head">
        <h3 className="projector-game-title rq-display">{round.game.title}</h3>
        <Logo variant="small" className="projector-head-logo" />
      </header>
      {round.phase === "start" && <>
        <p className="projector-stage projector-rules">{round.game.rules}</p>
        <p className="projector-soon rq-display">Das Spiel beginnt gleich …</p>
      </>}
      {round.phase === "playing" && <>
        <p className="projector-stage projector-question">{count}{round.task.question}</p>
        <div className="projector-play-meta">
          <TimerDisplay timer={round.timer} size="large" />
          <SubmissionCounter participants={snapshot.participants} className="rq-display" />
        </div>
      </>}
      {round.phase === "evaluation" && <>
        <p className="projector-stage projector-question">{count}{round.solution.question}</p>
        <SolutionContent solution={round.solution} />
      </>}
    </div>
    {round.phase === "evaluation" && <Results kind={round.game.kind} results={round.results} />}
  </>;
}

export function ProjectorView({ snapshot }: { snapshot: ProjectorSnapshot }) {
  const round = snapshot.round;
  const phase: Phase = round?.phase ?? snapshot.phase;
  return <div className={`projector-layout projector-layout--${phase}`}>
    {round ? <RoundStage snapshot={snapshot} round={round} />
      : snapshot.phase === "lobby" ? <LobbyStage snapshot={snapshot} />
      : snapshot.phase === "overview" ? <OverviewStage snapshot={snapshot} />
      : <p className="projector-wait">Warte auf die Spielauswahl.</p>}
  </div>;
}
