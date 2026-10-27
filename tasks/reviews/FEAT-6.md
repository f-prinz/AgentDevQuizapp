# FEAT-6 code review

**Result: APPROVED.**

Reviewed the branch diff against the acceptance criteria, `docs/project-idea.md`
(F2 Uebersicht/Ranking), `docs/agent-context.md` and `contracts/`.

## Scope

Diff limited to `apps/web/` (`GameViews.tsx`, `overview-views.test.tsx`,
`styles/app.css`) + `tasks/evidence/`. Keine Contract-, Schema- oder
Dependency-Aenderung; Commands nutzen vorhandene `game.select`/`game.prepare`/
`lobby.start`-Schemas.

## Acceptance criteria

- **Projektor: links ungespielt, rechts gespielt, zentral Ranking** —
  `ProjectorGameView` rendert in Phase `overview` drei Spalten
  (`Offene Spiele` | `Rangliste` | `Gespielte Spiele`), Format "Spielart: Titel";
  ohne gespielte Spiele nur die Spielernamen; Tabelle mit Kopf
  Platz/Punkte/Spielername/Spiel N und nur gespielten Spielspalten.
- **Animierter Uebergang altes->neues Ranking** — `RankingTable` nutzt
  `rankingTransition`: 800ms alte Tabelle, dann count-up der Punkte
  (Intervall-Interpolation, neue Spalte eingeblendet), danach neue Reihenfolge
  (`ranking-*` Stage-Klassen + `prefers-reduced-motion`-Fallback).
- **Host: Auswahl/Abwahl + Starten-Button + Regeln** — `HostOverview` listet
  verfuegbare/gespielte Spiele, Toggle sendet `game.select` mit `gameId` bzw.
  `null`, Markierung via `aria-pressed` + `.selected`; bei Auswahl Regeltext +
  `Starten` sendet `game.prepare`.

## Findings + Fixes im Review

- Lobby-Phase renderte die Uebersicht fälschlich (doppelte Namensliste,
  `game.select` serverseitig ohnehin nur in `overview` erlaubt) → Uebersichten
  auf Phase `overview` gegated; Host bekommt in `lobby` den bislang fehlenden
  `lobby.start`-Button (disabled ohne `canStartLobby`) — sonst war die
  Uebersicht per UI nicht erreichbar. Alte Tests bleiben gruen.
- Themekonformitaet: nur die vier freigegebenen CSS-Variablen verwendet.

## Evidence

- Rot: `tasks/evidence/FEAT-6-2026-10-27T09-58-50-228Z.json` (exit 1)
- Gruen: `tasks/evidence/FEAT-6-2026-10-27T10-01-37-006Z.json` (exit 0, 49/49)
- Lint+Typecheck: `tasks/evidence/FEAT-6-2026-10-27T10-01-42-514Z.json` (exit 0)
- Build: `tasks/evidence/FEAT-6-2026-10-27T10-01-46-302Z.json` (exit 0)
