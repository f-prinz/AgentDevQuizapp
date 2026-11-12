# Review CHG-24 — UI-Redesign Bedburg-Raccoons-Look (Branch ui_changes)

**Reviewer:** code_reviewer
**Implementiert von:** user (Remote-Branch `ui_changes`, Commit 67a996d)
**Task-Typ:** Retrospektive Buchhaltung — Nutzer-Branch wurde auf main gemergt (`--no-ff`), Task dokumentiert Scope/Review/Inventar.

## Diff-Umfang (main..ui_changes)

36 Dateien, ausschliesslich `apps/web/` (+1421/-767):
- Komplettes Dark-only-Redesign im Raccoons-„Trikot-Kante"-Look
  (`styles/theme.css`: `--rq-*`-Tokens, Teal/Rot, Barlow Condensed/Inter,
  clip-path-Kanten, Trikot-Streifen-Backdrop; Alias-Token für Alt-Regeln)
- Neues Styles-Layout: `app.css`, `player.css`, `projector.css`, `ranking.css`
- `projector/RankingBoard.tsx` + `ranking-logic.ts` ersetzt bisherige
  Ranglisten-Darstellung (Podium/Feld, FLIP-Reorder, Hochzählen,
  `RANKING_TIMELINE`, `prefers-reduced-motion`-Fallback)
- `shared/`: `TimerDisplay`, `SubmissionCounter`, `qr`, `submission`
- `player/`: `PlayerGameView`, `PlayerHeader`, `QuestionPeek`
- `brand/Logo.tsx` neu

## Entfernungen / Regressions-Check

- **`ThemeToggle.tsx` geloescht, Light/Dark-Umschaltung entfernt**
  → INV-26 wird `removed` (removed_by CHG-24); Redesign ist bewusst
  dark-only (`color-scheme: dark`). Nutzerentscheidung liegt vor.
- INV-25 (dunkles Farbschema) bleibt `active` — Palette jetzt
  Raccoons-Teal/Rot statt Slate/Indigo (Notes aktualisiert).
- INV-17 (Ranking-Animation) bleibt `active` — neue Implementierung in
  `RankingBoard`/`ranking-logic`, Tests `ranking-board.test.tsx`
  + `test/e2e/ranking.test.tsx` decken Transition ab.
- Keine Contract-/Server-Aenderung — `rankingTransition` kam bereits
  aus main (BUG-5/FEAT-Reihe).

## Findings

- Sauberer Merge ohne Konflikte; Arbeitsbaum ausser untracked
  `package-lock.json` (Root, vom `npm install`) sauber.
- `package-lock.json` im Root ist Artefakt ohne Deps — optional
  aufraeumen oder ignorieren (`.gitignore`-Kandidat).

## Evidence

- Test: `CHG-24-2026-11-12T15-04-01-411Z.json` (exit 0, 126 Tests)
- Lint: `CHG-24-2026-11-12T15-04-17-317Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker — Merge steht, Inventar nachgefuehrt.
