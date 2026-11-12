import { useEffect, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Answer, PlayerSnapshot } from "@raccoons/contracts";
import { SubmissionCounter } from "../shared/SubmissionCounter";
import { TimerDisplay } from "../shared/TimerDisplay";
import { PlayerHeader } from "./PlayerHeader";
import { QuestionPeek } from "./QuestionPeek";

type Send = (message: Record<string, unknown>) => void;

function SortableTerm({ id, canEdit, children }: { id: string; canEdit: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !canEdit });
  // BUG-3: touch-action:none ist Pflicht für PointerSensor-Drags auf Touch-Geräten
  // (sonst wertet der Browser die Geste als Scroll und feuert keine Pointer-Moves).
  const style = { transform: CSS.Transform.toString(transform), transition, touchAction: "none" };
  return <li ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? "answer-tile sortable-dragging" : "answer-tile"}>{children}</li>;
}

function StartAnimation() {
  return <div className="game-start-animation" role="region" aria-label="Startanimation">
    <div className="start-stripes" aria-hidden="true"><span /><span /><span /></div>
    <p className="rq-display">Das Spiel beginnt gleich …</p>
  </div>;
}

function RoundResult({ points }: { points: number }) {
  return <p className={`round-result round-result--${points > 0 ? "plus" : "zero"}`} aria-label={`Deine Punkte: ${points}`}>
    <span className="visually-hidden">Deine Punkte: {points}</span>
    <span className="round-result-value rq-display" aria-hidden="true">{points > 0 ? `+${points}` : "0"}</span>
    <span className="round-result-caption" aria-hidden="true">{points === 1 ? "Punkt" : "Punkte"}</span>
  </p>;
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
  const header = <PlayerHeader name={myName} rank={mine?.rank} total={mine?.total} />;
  if (!round) return <div className="player-view">{header}<section className="game-view player-card" aria-label="Spielbeginn"><StartAnimation /></section></div>;

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

  return <div className="player-view">{header}<section className={`game-view player-card player-phase-${round.phase}`} aria-label="Spielphase">
    <div className="player-round-head">
      {round.game.kind !== "sorting" ? <h3 className="player-game-title rq-display">{round.game.title}</h3> : <span />}
      {round.phase === "playing" && <TimerDisplay timer={round.timer} size="compact" />}
    </div>
    {round.phase === "start" && <StartAnimation />}
    {round.phase === "playing" && (!snapshot.input.participating
      ? <><p role="status" className="player-note">Du steigst bei der nächsten Spielauswahl ein. In dieser Runde ist keine Antwort möglich.</p>
        <div className="player-actions"><button type="button" className="rq-btn-primary" disabled>Abgeben</button></div></>
      : <>
        <QuestionPeek question={round.task.question} />
        {round.task.kind === "quiz" && <div className="answer-options" role="group" aria-label="Antwortoptionen">{round.task.options.map(option => {
          const chosen = draft?.kind === "quiz" && draft.optionId === option.id;
          return <button type="button" key={option.id} className={`answer-tile answer-option${chosen ? " answer-selected" : ""}`} data-answer-state={chosen ? "selected" : "neutral"} disabled={!canEdit} onClick={() => sendAnswer({ kind: "quiz", optionId: option.id })}>{option.text}</button>;
        })}</div>}
        {round.task.kind === "sorting" && (() => {
          const ids = draft?.kind === "sorting" ? draft.termIds : round.task.terms.map(term => term.id);
          return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSortEnd(ids)}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="sortable-terms">{ids.map((id, index) => {
                const term = round.task.kind === "sorting" ? round.task.terms.find(item => item.id === id) : undefined;
                return <SortableTerm key={id} id={id} canEdit={canEdit}>
                  <span className="sortable-index" aria-hidden="true">{index + 1}</span>
                  <span className="sortable-text">{term?.text ?? "Begriff"}</span>
                  <GripVertical aria-hidden className="sortable-grip" />
                </SortableTerm>;
              })}</ol>
            </SortableContext>
          </DndContext>;
        })()}
        {round.task.kind === "estimation" && <div className="answer-tile estimation-panel"><label className="estimation-input">Deine Schätzung<input type="number" inputMode="decimal" value={draft?.kind === "estimation" ? draft.value : ""} disabled={!canEdit} onChange={event => { const value = Number(event.target.value); if (event.target.value !== "" && Number.isFinite(value)) sendAnswer({ kind: "estimation", value }); }} /></label></div>}
        <div className="player-actions">
          {snapshot.input.final
            ? <><p role="status" className="submitted-status rq-display">Abgegeben ✓ – warte auf die anderen</p><SubmissionCounter participants={snapshot.participants} /></>
            : round.timer.inputClosed
              ? <><p role="status" className="time-up-status rq-display">Zeit abgelaufen</p><SubmissionCounter participants={snapshot.participants} /></>
              : <button type="button" className="rq-btn-primary" disabled={!canEdit || !draft} onClick={submit}>Abgeben</button>}
        </div>
      </>)}
    {/* CHG-8: Spieler sehen in der Evaluation keine Aufloesungs-Box und keine
        Marktexte — die farbliche Markierung der Antworten reicht aus. */}
    {round.phase === "evaluation" && <>
      <RoundResult points={round.ownEvaluation.points} />
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
      {round.solution.kind === "estimation" && <dl className="estimation-result">
        {round.ownEvaluation.answer?.kind === "estimation" && <div><dt>Deine abgegebene Antwort:</dt> <dd>{round.ownEvaluation.answer.value}</dd></div>}
        {round.ownEvaluation.distance !== null && <div><dt>Dein Abstand zur Lösung:</dt> <dd>{round.ownEvaluation.distance}</dd></div>}
      </dl>}
    </>}
  </section></div>;
}
