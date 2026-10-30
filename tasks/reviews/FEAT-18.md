# Review FEAT-18 — Host-Kick + submitted im Snapshot

**Reviewer:** code_reviewer
**Implementiert von:** server_developer
**Branch:** FEAT-18

## Scope

- `apps/server/src/lobby.ts` — `LobbyRegistry.removePlayer`: host-only
  (FORBIDDEN), PLAYER_NOT_FOUND bei unbekannter ID; entfernt Spieler aus
  `players`, `round.participantIds`, `completedGames`-Score-Maps und loescht
  alle zugehoerigen Sessions; `participants[].submitted = player.final`
- `apps/server/src/app.ts` — Dispatch `player.remove` (Ack + Broadcast), danach
  alle offenen Sockets des Spielers mit Close-Code 1008 beendet;
  Fehlermeldung `Player not found.`
- `apps/server/test/e2e/player-remove.test.ts` — drei E2E-Tests: Rollen-/
  Fehlerfaelle, vollstaendiges Entfernen + Socket-Close + Session-Invalidierung,
  Abgabestatus + Kick mitten in laufender Runde bis ins Ranking

## Findings

- **Vollstaendiges Entfernen** wie abgesprochen (Default A): Ranking/Results
  werden aus `lobby.players`/`participantIds`/`completedGames` projiziert —
  alle drei Quellen werden bereinigt, `results` faellt live weg.
- **Session-Invalidierung** ueber `lobby.sessions.delete` — Re-Auth schlaegt
  mit UNAUTHORIZED fehl (Test deckt das), Sockets werden zusaetzlich aktiv
  geschlossen.
- **`submitted` = `player.final`** ist akkurat: `final` wird je Runde
  zurueckgesetzt; Anzeigeentscheidung (nur playing) bleibt dem Web-Layer.
- Kein Schema-Bruch (TECH-18-Contract liegt zugrunde, dist rebuilt).
- Kein unerlaubter Dependency-/Framework-Wechsel; Stil konsistent zum
  bisherigen Registry-/Dispatch-Muster.

## Evidence

- Rot: `FEAT-18-2026-10-30T08-55-41-900Z.json` (exit 1)
- Gruen: `FEAT-18-2026-10-30T08-59-46-868Z.json` (exit 0, 82/82)
- Lint: `FEAT-18-2026-10-30T09-01-00-194Z.json` (exit 0, eslint + tsc)

## Fazit

Freigabe ohne Blocker.
