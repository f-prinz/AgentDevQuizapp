# Review BUG-5 — Kick-Kommando ohne version/requestId

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** BUG-5

## Scope

- `apps/web/src/routes/Pages.tsx` — `player.remove` im Kick-Dialog sendet
  jetzt `version: 1` und `requestId: crypto.randomUUID()` (CommandBase)
- `apps/web/src/game-views.test.tsx` — Kick-Test assertiert `version` und
  `requestId` in der gesendeten Message

## Root Cause

`ParticipantList` schickte `{ type: "player.remove", playerId }` ohne die
CommandBase-Pflichtfelder `version`/`requestId`. Der Server lehnt die
Message mit `INVALID_COMMAND` ab → Meldung „Die Lobby-Anfrage konnte nicht
verarbeitet werden". Keine HTTP-Aktivität, weil es ein WebSocket-Frame ist.
Alle anderen Kommandos (`lobby.start`, `answer.set`, …) senden die Felder
bereits — `player.remove` war die einzige Stelle ohne.

## Findings

- Fix ist minimal und deckt sich exakt mit dem Muster der uebrigen
  `send({ version: 1, requestId: crypto.randomUUID(), ... })`-Aufrufe.
- Reproduktionstest faellt rot aus dem richtigen Grund (fehlende Felder)
  und wird gruen.
- Keine neuen Dependencies, kein Stack-Abweichung, kein Contract-Impact.

## Evidence

- Rot: `BUG-5-2026-10-30T09-55-06-146Z.json` (exit 1)
- Gruen: `BUG-5-2026-10-30T09-56-05-963Z.json` (exit 0, 99/99)
- Lint: `BUG-5-2026-10-30T09-56-31-923Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
