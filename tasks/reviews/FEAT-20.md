# Review FEAT-20 — Begrenzter Auto-Reconnect

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** FEAT-20
**Requirements:** `docs/feature-reconnect.md` (Fast Path)

## Scope

- `apps/web/src/routes/Pages.tsx` — `useLobbySnapshot` um Retry-Budget
  (3x, Backoff 2s/5s/10s), Lifecycle-Trigger (`visibilitychange`,
  `online`, `pageshow`), `sessionGone`/`closedByUs`-Guards sowie
  `reconnect()`/`connectionLost` erweitert; `LobbyStatus` mit
  "Erneut verbinden"-Button; alle vier Hook-Nutzer (Host, Join,
  Player, Projector) verdrahtet
- `apps/web/src/game-views.test.tsx` — neuer `FEAT-20 auto
  reconnect`-Block (4 Tests, fake timers)

## Findings

- **Budget korrekt**: `retriesRef` zaehlt nur geplante Retries
  (`scheduleRetry`), ein Sofort-Retry via `checkAlive` verwirft den
  ausstehenden Timer statt doppelt zu zaehlen; nach
  `MAX_RECONNECT_ATTEMPTS` greift `exhausted()` — Fehler + Button,
  kein weiterer Timer.
- **Kein unbegrenzter Loop**: Budget wird erst bei stabilem
  Snapshot-Empfang (`retriesRef = 0` in `onmessage`) zurueckgesetzt —
  ein flackernder Socket verbraucht das Budget und landet beim Button.
- **Fatal-Guard**: `sessionGone` bei `LOBBY_NOT_FOUND`/`UNAUTHORIZED`
  blockiert `scheduleRetry` und `checkAlive`; `closedByUs` verhindert
  Retries nach Unmount/Cleanup (plus `onclose = null` vor `close()`).
- **Race-Sicherheit**: Timer-Cleanup in Effekt-Cleanup, Reset-Effekt
  und `reconnect()`; `socketRef` wird in `onclose` genullt, damit
  `checkAlive` den toten Zustand sieht.
- **A11y/UX**: Zwischenmeldung waehrend Retry (`role="status"`), finaler
  Fehler mit sichtbarem Button; identisches Verhalten fuer alle Rollen.
- `onerror` entfernt — `close` folgt dem Error-Event zuverlaessig;
  kein Bestands-Test hing an der alten Meldung.
- Kein Contract-/Dependency-/Server-Impact.

## Evidence

- Rot: `FEAT-20-2026-10-30T11-40-51-886Z.json` (exit 1 — 3 neue
  Fails; Fatal-Guard-Test gruen-by-design)
- Gruen: `FEAT-20-2026-10-30T11-43-18-393Z.json` (exit 0, 107/107)
- Lint: `FEAT-20-…` (exit 0)

## Fazit

Freigabe ohne Blocker.
