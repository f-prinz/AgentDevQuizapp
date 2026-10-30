# Review TECH-17 — GAME_CONFIG: Quiz 3 Punkte richtige Antwort + Regeltexte

**Reviewer:** code_reviewer
**Implementiert von:** integration_engineer (auf Basis einer Nutzer-Vorlage im Arbeitsbaum)
**Branch:** TECH-17

## Scope

- `contracts/game.config.ts` — `pointsPerCorrectAnswer` 1→3, Quiz-Regeltext auf
  „3 Punkte" angeglichen, Nutzer-Formulierungen für Sortier-/Schätz-Regeltexte
- `apps/server/test/game-state.test.ts`, `test/e2e/lobby.test.ts`,
  `test/e2e/quiz.test.ts` — Quiz-Punkt-Erwartungen aus `GAME_CONFIG` abgeleitet

## Wichtiger Befund

`@raccoons/contracts` löst auf `dist/` auf — ohne `contracts run build` lief die
Server-Suite gegen den alten Build und war fälschlich grün. Nach Rebuild zeigten
die harten `toBe(1)`-Asserts echte Fehlschläge (rote Evidence).

## Evidence

- Rot: `TECH-17-2026-10-30T07-54-40-285Z.json` (exit 1, e2e/quiz erwartet 1 Punkt)
- Grün: `TECH-17-2026-10-30T07-58-49-263Z.json` (exit 0, 79/79)
- Lint: `TECH-17-2026-10-30T07-59-40-088Z.json` (exit 0, eslint + tsc)
- Hinweis: Erste Rot-Aufzeichnung `07-50-51` war stale-dist + flaky Timeout und
  wurde durch den echten Lauf ersetzt.

## Findings

- **Scoring-Pfad korrekt**: `questionPoints` in `apps/server/src/game.ts:257`
  nutzt `GAME_CONFIG.quiz.scoring.pointsPerCorrectAnswer` — Änderung wirkt
  ohne Server-Code-Anpassung.
- **Regeltext-Konsistenz**: Quiz-Text sagte „einen Punkt" bei Scoring 3 — auf
  „3 Punkte" angeglichen (Korrektur innerhalb des Contract-Scopes).
- **Test-Robustheit**: Erwartungen jetzt config-getrieben wie bereits in
  `catalog-admin.test.ts` üblich — künftige Scoring-Änderungen brechen nicht mehr.
- **Keine Dependency-/Framework-Änderungen**, Scope eingehalten, keine
  Duplikation vorhandener Funktionalität.
- **dist/ ist gitignored** — nur Quell-Änderung committet; Rebuild gehört zum
  normalen Workflow (bestehende Konvention, kein Finding).

## Fazit

Freigabe ohne Blocker.
