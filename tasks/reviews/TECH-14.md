# TECH-14 code review

**Result: APPROVED.**

Reviewed the branch diff: `contracts/lobby.schema.ts`, `apps/server/src/lobby.ts`, `apps/server/test/lobby.test.ts` plus Web-Test-Fixtures.

## Scope

Contracts + Server + angepasste Web-Fixtures (scope nachtraeglich um `apps/web/` erweitert, da Contract-Felder Test-Fixtures betreffen).

## Acceptance criteria

- **HostSnapshot traegt links{player,projector}** — `LobbyLinksSchema` in `HostSnapshotSchema`; Server projiziert `lobby.links.player`/`.projector`.
- **ProjectorSnapshot traegt playerLink** — Feld im Schema, Projektion aus `lobby.links.player`.
- **Links aus Lobby-State** — einmal in `create()` aus den Sessions erzeugt und im `Lobby`-State gespeichert (Roh-Tokens werden sonst nirgends gehalten — nur Hashes); `create()`-Response unveraendert.
- **strictObject-Schemas erweitert** — `strictObject` beibehalten; `SnapshotSchema`-Union akzeptiert neue Felder, Tests gruen.
- **Kein Secret-Leak neu** — Host haelt den Projektor-Link bereits seit Lobby-Erstellung; Spieler- und Projektor-Snapshots enthalten weiterhin keine Tokens (Test assertiert das weiterhin, fuer Host angepasst).

## Findings

Keine. Stack-konform, keine neuen Dependencies. Web-Fixtures in vier Testdateien auf den neuen Contract angehoben.

## Evidence

- Server lint/typecheck: `tasks/evidence/TECH-14-2026-10-27T12-07-27-485Z.json` (exit 0)
- Web lint/typecheck: `tasks/evidence/TECH-14-2026-10-27T12-07-31-637Z.json` (exit 0)
- Server tests: `tasks/evidence/TECH-14-2026-10-27T12-23-41-069Z.json` (61/61, exit 0, inkl. neuer Link-Assertions)
