# Review TECH-18 — player.remove-Kommando, submitted-Flag, PLAYER_NOT_FOUND

**Reviewer:** code_reviewer
**Implementiert von:** integration_engineer
**Branch:** TECH-18

## Scope

- `contracts/lobby.schema.ts` — `PlayerRemoveCommandSchema`
  (`type: 'player.remove'`, `playerId: IdSchema`) in `ClientMessageSchema`;
  `submitted: z.boolean().optional()` auf `ParticipantSchema`;
  `PLAYER_NOT_FOUND` in `ErrorCodeSchema`
- `contracts/test/protocol.test.mjs` — zwei neue Tests (Kommando-Validierung,
  submitted-Flag + Wire-Error) + stale Scoring-Erwartung 1→3 (TECH-17-Nachwehe)

## Findings

- **`submitted` optional** ist bewusste Entscheidung: required haette typisierte
  Web-Test-Fixtures auf main gebrochen, bevor FEAT-19 sie anpassen kann;
  Server setzt das Feld fuer die Host-Ansicht immer.
- **strictObject** auf dem neuen Kommando lehnt Zusatzfelder ab, wie uebrige
  Kommandos.
- Kein Secrets-/Schema-Leak; Error-Code konsistent zum bisherigen Enum-Stil.
- stale Config-Erwartung korrigiert — Contract-Test deckt jetzt den
  TECH-17-Stand ab.

## Evidence

- Rot: `TECH-18-2026-10-30T08-50-43-757Z.json` (exit 1)
- Gruen: `TECH-18-2026-10-30T08-51-22-249Z.json` (exit 0)
- Lint/Build: `TECH-18-2026-10-30T08-51-27-185Z.json` (exit 0, tsc)

## Fazit

Freigabe ohne Blocker.
