import { Podium, Star } from "lucide-react";
import { Logo } from "../brand/Logo";

// Spec: Spieler sehen oben immer Name, Punkte und Platzierung. Der Name bleibt
// direkter Textknoten der h2; der zugaengliche Name lautet wie bisher
// "Ada - 2 9" (CHG-16: Rang vor Punkten).
export function PlayerHeader({ name, rank, total }: { name: string; rank?: number; total?: number }) {
  const hasStats = rank !== undefined && total !== undefined;
  return <div className="player-header">
    <Logo variant="small" className="player-header-logo" />
    <h2 className="player-identity" aria-label={hasStats ? `${name} - ${rank} ${total}` : name}>{name}{hasStats
      ? <span className="player-stats">
        <span className="player-stat"><Podium aria-hidden size="1em" /> {rank}</span>
        <span className="player-stat"><Star aria-hidden size="1em" /> {total}</span>
      </span>
      : ""}</h2>
  </div>;
}
