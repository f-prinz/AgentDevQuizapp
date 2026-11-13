import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RankingEntry, Snapshot } from "@raccoons/contracts";
import { RANKING_TIMELINE, climbers, hasPlayedAnyGame, interpolateTotal, sortByRank, splitPodium } from "./ranking-logic";

type Stage = "before" | "counting" | "after";
type Transition = Snapshot["rankingTransition"];

const KIND_LABEL: Record<string, string> = { quiz: "Quiz", sorting: "Sortieren", estimation: "Schätzen" };

function prefersReducedMotion() {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false; } catch { return false; }
}

// Spec (Uebersicht): erst altes Ranking, dann neues Spiel + Punkte hochzaehlen,
// dann Reihenfolge per Animation aendern. Laeuft einmal pro resultId (BUG-6),
// insgesamt <= 5 s (RANKING_TIMELINE). Reduced Motion -> sofort Endstand.
function useRankingTimeline(transition: Transition) {
  const [stage, setStage] = useState<Stage>(() => (transition && !prefersReducedMotion() ? "before" : "after"));
  const [progress, setProgress] = useState(1);
  const [flashing, setFlashing] = useState<Set<string>>(() => new Set());
  const transitionRef = useRef(transition);
  useEffect(() => { transitionRef.current = transition; });
  const resultId = transition?.resultId ?? null;

  useEffect(() => {
    const current = transitionRef.current;
    setFlashing(new Set());
    if (!current || prefersReducedMotion()) { setStage("after"); setProgress(1); return; }
    const { holdMs, countMs, reorderMs, flashMs } = RANKING_TIMELINE;
    setStage("before");
    setProgress(0);
    const timers: number[] = [];
    let interval: number | undefined;
    timers.push(window.setTimeout(() => {
      setStage("counting");
      const startedAt = Date.now();
      interval = window.setInterval(() => {
        const value = Math.min(1, (Date.now() - startedAt) / countMs);
        setProgress(value);
        if (value >= 1 && interval !== undefined) window.clearInterval(interval);
      }, 50);
    }, holdMs));
    timers.push(window.setTimeout(() => { setProgress(1); setStage("after"); }, holdMs + countMs));
    timers.push(window.setTimeout(() => setFlashing(climbers(current.previous, current.current)), holdMs + countMs + reorderMs));
    timers.push(window.setTimeout(() => setFlashing(new Set()), holdMs + countMs + reorderMs + flashMs));
    return () => { timers.forEach(timer => window.clearTimeout(timer)); if (interval !== undefined) window.clearInterval(interval); };
  }, [resultId]);

  return { stage, progress, flashing };
}

// FLIP: Beim Wechsel auf den Endstand rutschen die Karten von ihrer alten an
// die neue Position (nur transform -> guenstig fuer den Beamer-Laptop).
function useFlip(stage: Stage, container: React.RefObject<HTMLElement | null>) {
  const positions = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-player-id]"));
    const next = new Map(items.map(item => [item.dataset.playerId!, item.getBoundingClientRect()]));
    if (stage === "after" && !prefersReducedMotion()) {
      for (const item of items) {
        const before = positions.current.get(item.dataset.playerId!);
        const after = next.get(item.dataset.playerId!);
        if (!before || !after) continue;
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        item.animate?.(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: RANKING_TIMELINE.reorderMs, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
      }
    }
    positions.current = next;
  }, [stage]);
}

export function RankingBoard({ ranking, transition }: { ranking: RankingEntry[]; transition: Transition }) {
  const { stage, progress, flashing } = useRankingTimeline(transition);
  const rootRef = useRef<HTMLElement | null>(null);
  useFlip(stage, rootRef);

  const animating = Boolean(transition) && stage !== "after";
  const target = new Map((transition?.current ?? ranking).map(entry => [entry.playerId, entry]));
  // Vor/waehrend des Zaehlens bleibt die alte Reihenfolge; im Zaehlen kommen
  // die neuen Spielpunkte dazu und die Summe zaehlt hoch.
  const shown: RankingEntry[] = animating
    ? sortByRank(transition!.previous).map(entry => {
      if (stage !== "counting") return entry;
      const next = target.get(entry.playerId);
      return next ? { ...entry, games: next.games, total: interpolateTotal(entry.total, next.total, progress) } : entry;
    })
    : ranking;

  const namesOnly = !transition && !hasPlayedAnyGame(ranking);
  const { podium, field } = splitPodium(shown);

  const item = (entry: RankingEntry, slot?: number) => <li key={entry.playerId} data-ranking-entry="" data-player-id={entry.playerId}
    className={["ranking-entry", slot ? `podium-slot podium-rank-${Math.min(entry.rank, 3)}` : "field-slot", flashing.has(entry.playerId) ? "ranking-climber" : ""].filter(Boolean).join(" ")}>
    <span className="ranking-rank">{entry.rank}</span>
    <span className="ranking-body">
      <span className="ranking-name">{entry.name}</span>
    </span>
    <span className="ranking-total">{entry.total}</span>
  </li>;

  return <section ref={rootRef} className="ranking-board" aria-label="Rangliste" data-ranking-stage={stage}>
    <h2 className="ranking-title rq-display"><small>Bedburg Raccoons</small>Rangliste</h2>
    {namesOnly
      ? <ol className="ranking-names">{sortByRank(ranking).map(entry => <li key={entry.playerId}>{entry.name}</li>)}</ol>
      : <>
        <ol className="ranking-podium">{podium.map((entry, index) => item(entry, index + 1))}</ol>
        {field.length > 0 && <ol className="ranking-field" style={{ "--field-rows": Math.ceil(field.length / 3) } as React.CSSProperties}>{field.map(entry => item(entry))}</ol>}
      </>}
  </section>;
}
