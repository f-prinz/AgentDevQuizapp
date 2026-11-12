import { useEffect, useState } from "react";
import type { Timer } from "@raccoons/contracts";

// Ab hier wird der Timer rot und pulsiert (Spec-Entscheidung im Redesign).
export const URGENT_SECONDS = 5;

export function TimerDisplay({ timer, size }: { timer: Timer; size: "compact" | "large" }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((timer.deadline - timer.serverTime) / 1000)));
  useEffect(() => {
    const startedAt = Date.now();
    const initial = Math.max(0, timer.deadline - timer.serverTime);
    const update = () => setRemaining(Math.max(0, Math.ceil((initial - (Date.now() - startedAt)) / 1000)));
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [timer.deadline, timer.serverTime]);
  const urgent = remaining <= URGENT_SECONDS;
  return <p className={`game-timer timer-${size}${urgent ? " timer-urgent" : ""}${remaining === 0 ? " timer-done" : ""}`} role="timer" aria-label={`Verbleibende Zeit: ${remaining} Sekunden`}>{remaining}<span className="timer-unit"> s</span></p>;
}
