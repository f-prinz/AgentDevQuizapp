# Review CHG-12 — Rangliste live: alle Spieler immer, laufende Runde eingerechnet

Reviewer: code_reviewer (unterscheidet sich von implemented_by)
Diff-Basis: Branch `CHG-12` vs `main` (Commit 5d0fefb)
Dateien: `apps/server/src/game.ts`, `apps/server/test/game-state.test.ts`, `apps/server/test/e2e/{estimate,lobby,sort}.test.ts`

## Findings

Keine Blocker.

## Pruefpunkte

- **Fachlichkeit**: `projectRanking` liefert jetzt immer alle Spieler (auch mit 0 Punkten vor dem ersten Spiel) und rechnet `lobby.round.totalPoints` als virtuellen `games`-Eintrag ein. Rangliste ist dadurch nie mehr leer und flackert nicht — AK erfuellt.
- **Live-Update**: `revealGame` setzt `rankingTransition` pro Aufloesung (`previous` vor Punktegutschrift, `current` danach). `previous` entspricht exakt dem zuletzt angezeigten Stand — die Client-Animation bleibt konsistent.
- **Doppelzaehlung**: `finishGame` erzeugt keine eigene Transition mehr; `completedGames` wird weiter korrekt gefuellt. Da `lobby.round` erst nach `completedGames.set` gecleart wird und danach keine `projectRanking`-Auswertung mehr erfolgt, gibt es kein Fenster fuer Doppelzaehlung.
- **Transition-Kompatibilitaet**: `RankingTransitionState`-Shape unveraendert (`resultId`, `gameId`, `previous`, `current`); `resultId` wird pro Aufloesung neu gezogen — Client triggert die Animation wie bisher ueber das Transition-Objekt.
- **Scope**: nur `apps/server/` (+ Evidence/Review). Keine Dependency- oder Framework-Aenderungen, keine Duplikation vorhandener Logik (`projectRanking` bleibt einzige Projektion).
- **Inventar**: betrifft INV-9 (Ranking bereitstellen) und INV-17 (Projektor-Ranking mit Animationsuebergang) — Verhalten erweitert, nicht entfernt.

## Hinweis (kein Blocker)

- Die e2e-Wartebedingungen wurden von `ranking.length > 0` auf den `played`-Katalogstatus umgestellt, da das Ranking jetzt immer belegt ist — semantisch gleichwertig.
- Client-Seite der Transition-Animation wird in CHG-13 weiter behandelt (immer-Tabelle, Icon-Header).

## Ergebnis

Review ohne Blocker. Tests gruen (79/79, sequentieller Lauf wegen Parallel-Timeouts), Lint gruen.
