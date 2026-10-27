# CHG-1 code review

**Result: APPROVED.**

Reviewed the branch diff: `apps/web/src/routes/AppShell.tsx`, `routes/Pages.tsx`, `GameViews.tsx`, `styles/app.css` plus Test-Dateien.

## Scope

Nur `apps/web/`.

## Acceptance criteria

- **AppShell ohne Header/Nav** — `AppShell` rendert nur noch `<Outlet />`; `site-header`/`brand`/Nav-CSS entfernt; Test `renders no site header or main navigation on any route` gruen.
- **Keine Phasen-Texte** — `Spielphase:`-Zeile aus `LobbyStatus` entfernt; `phase-label`-Absaetze und Eingabestatus-Texte („Antworten werden entgegengenommen“, „Eingabezeit ist beendet“, „final abgegeben“, „Spielphase: overview“) aus `HostGameView`/`PlayerGameView` entfernt; `LobbyStatus` auf Fehler reduziert.
- **Spieler sieht nie Teilnehmerliste/Statuskarte** — `ParticipantList` aus `JoinPage`/`PlayerPage` entfernt; `PlayerStatus`-Komponente inkl. CSS geloescht; neuer Test assertiert Abwesenheit.
- **JoinPage ohne Beitritts-Bestaetigung** — „Du bist der Lobby beigetreten.“ entfernt; Name/Beitreten-Formular bleibt (Beitrittsfunktion INV-4).
- **HomePage ohne Beitritts-UI** — Hauptnav (mit „Beitreten“-Link) war der einzige Einstieg fuer Spieler auf der Mainpage; entfaellt mit dem Header.
- **Eingabestatus statt Text** — Abgeben-Button wird nur gerendert, wenn Eingabe moeglich; disabled-Button fuer Wartende bleibt (kein Textverlust fuer funktionalen Zustand).

## Findings

- Alt-Test `waiting participants` hatte implizit auf „Wartet“ aus der Teilnehmerliste verlassen — Regex auf den Spieler-Text korrigiert.
- CSS-Leichen (`.site-header`, `.brand`, `.lobby-phase`, `.player-status-card`, `.phase-label`) mit entfernt.
- INV-15 (Spieler-Statusleiste) wird durch diesen Task entfernt.

## Evidence

- Rot: `tasks/evidence/CHG-1-2026-10-27T12-28-37-964Z.json` (exit 1)
- Gruen: `tasks/evidence/CHG-1-2026-10-27T12-34-05-944Z.json` (56/56, exit 0)
- Lint/Typecheck: `tasks/evidence/CHG-1-2026-10-27T12-34-16-248Z.json` (exit 0)
