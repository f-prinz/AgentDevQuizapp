import type { Snapshot } from "@raccoons/contracts";

// Gleiche Zaehlweise wie der Server (allFrozenPlayersFinal): Nenner sind alle
// Teilnehmer der Runde (waiting === false, auch getrennte), Zaehler davon die
// mit finaler Abgabe. So springt der Zaehler genau dann auf "n von n", wenn
// der Server die Runde beendet.
export function submissionCount(participants: Snapshot["participants"]): { submitted: number; total: number } {
  const playing = participants.filter(participant => !participant.waiting);
  return { submitted: playing.filter(participant => participant.submitted === true).length, total: playing.length };
}
