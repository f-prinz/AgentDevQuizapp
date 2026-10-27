# CHG-2 code review

**Result: APPROVED.**

Reviewed the branch diff: `apps/web/src/routes/Pages.tsx`, `GameViews.tsx`, `styles/app.css`, `lobby-views.test.tsx`, `game-views.test.tsx`, `package.json`/Lockfile (`react-qr-code`).

## Scope

Nur `apps/web/` (inkl. freigegebener QR-Dependency `react-qr-code@2.0.18`, vom Nutzer genehmigt).

## Acceptance criteria

- **Lobby-Ersteller landet als Host** — `HomePage` navigiert nach `create()` direkt auf `links.host` (Fragment-Session via Router-Hash); Links-Liste auf HomePage entfernt; Test prueft `router.state.location` + WS-Auth.
- **Host sieht Links mit Copy-Icons** — `HostGameView` Lobbyphase zeigt `snapshot.links.player`/`.projector` via `CopyLinkButton` (`navigator.clipboard` + execCommand-Fallback, „Kopiert"-Feedback); Test stubbt Clipboard und prueft beide Aufrufe.
- **Projektor: Link+QR nur in Lobby** — `ProjectorGameView` rendert `snapshot.playerLink` + `react-qr-code`-SVG (als absolute URL) nur bei `phase === "lobby"`; nach `lobby.start` verschwinden beide (Test assertiert beides).
- **Host nach lobby.start: keine Teilnehmerliste** — `ParticipantList` auf `HostPage` nur bei `phase === "lobby"`; Test assertiert Wechsel lobby → overview.
- **Spieler nach lobby.start: nur „Das Spiel beginnt gleich …"** — `PlayerGameView` ohne Runde zeigt nur diesen Text (keine Teilnehmer, keine Statusinfos); bestehende Assertions angepasst.
- **Projektor zentral offene/gespielte Spiele** — bestehende `projector-overview` bleibt (Offene/Gespielte + Rangliste); Teilnehmerliste auf Projektor unveraendert (Layout-Feinschliff gehoert CHG-3).

## Findings

- `document.execCommand("copy")`-Fallback fuer Nicht-Secure-Contexts; primaerer Weg `navigator.clipboard`.
- Waiting-Marking-Test auf Projektor beschraenkt (Host-Liste existiert nur noch in Lobbyphase — dort ist `waiting` nicht moeglich).
- Kein neues Secret-Leak: Host-Link-Anzeige nutzt Snapshot-Felder aus TECH-14.

## Evidence

- Rot: `tasks/evidence/CHG-2-2026-10-27T12-39-12-107Z.json` (exit 1, 5 neue CHG-2-Tests)
- Gruen: `tasks/evidence/CHG-2-2026-10-27T12-41-15-684Z.json` (59/59, exit 0)
- Lint/Typecheck: `tasks/evidence/CHG-2-2026-10-27T12-41-25-305Z.json` (exit 0)
