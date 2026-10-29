# Review: CHG-13 — Projektor-Rangliste als Icon-Tabelle, Frage gross, Ergebnis-Tabelle rechts

**Reviewer:** code_reviewer
**Implementiert von:** web_test_engineer / web_developer
**Branch:** CHG-13

## Geprüfte Umsetzung

- `apps/web/src/GameViews.tsx`
  - `RankingTable` rendert immer (kein `return null` bei leerem Ranking); Header
    sind lucide-Icons (`Podium`, `Star`, `User`) mit `aria-label` für
    Accessibility — bestehende Label-Asserts laufen weiter.
  - `ProjectorRanking` ohne Namenslisten-Fallback: Die Tabelle zeigt seit CHG-12
    alle Spieler auch vor dem ersten Spiel mit 0 Punkten.
  - `ProjectorGameView`: Regeltext, Spiel-Frage und Auflösungs-Frage belegen
    denselben `.projector-stage`-Slot an identischer Position. „Frage x von y"
    ist `.projector-count` innerhalb des Slots (weniger Abstand).
  - Auswertung: `.projector-eval`-Grid — `SolutionContent` links,
    `Results` rechts.
  - `Results` ist jetzt eine kompakte Tabelle (`results-table`), sortiert nach
    Platzierung bzw. Punkten. Spalten je Spielart:
    Schätzen: Platzierung, Punkte, Differenz, Spielername;
    Sortieren: Platzierung, Punkte, Spielername;
    Quiz: Punkte, Spielername. Header ebenfalls Icon + aria-label.
  - `SolutionContent` zeigt die Frage nicht mehr in der Box (liegt im
    Stage-Slot), behält Auflösungsliste/Zielwert.
- `apps/web/src/styles/app.css`
  - `.projector-question` auf `clamp(2.4rem, 4.6vw, 3.6rem)` (vorher 1.8rem,
    ~2x), `.timer-large` auf `clamp(6rem, 20vw, 16rem)` (vorher 4/12vw/10rem).
    Änderungen wirken nur auf den Projektor (`.projector-*`-Selektoren bzw.
    `timer-large` wird ausschließlich im Projektor-GameView verwendet).
  - `.projector-eval`-Grid, `.results-table` kompakt mit `max-height: 70vh`
    + Scroll für bis zu 25 Zeilen; `.projector-count`-Styling.
  - `.ranking-names`-Fallback-CSS entfernt; Projektor-Ranglistenzellen
    verdichtet für 25 Zeilen.
- `apps/web/package.json` / `package-lock.json`: `lucide-react` (vom Nutzer
  freigegebene neue Dependency, Task hat `allows_dep_change: true`).

## Testfälle

- Neue/aktualisierte Tests in `game-views.test.tsx` (describe „CHG-13 projector
  ranking and result tables"): Tabelle vor erstem Spiel mit 0 Punkten, Tabelle
  auch bei leerem Ranking, Quiz-Ergebnis-Tabelle punktesortiert, Stage-Slot in
  allen Phasen, Eval-Grid links/rechts. Bestehende Schätz-/Sortier-Tests auf
  Tabellenform mit Icon-Headern umgestellt.
- `overview-views.test.tsx`, `test/e2e/ranking.test.tsx`,
  `lobby-views.test.tsx`: auf neues Verhalten angepasst (immer sichtbare
  Tabelle, Icon-Header via aria-label, Identitätszeile mit Punkte/Rang seit
  CHG-12).

## Verifikation

- Rot: `tasks/evidence/CHG-13-2026-10-29T10-02-03-383Z.json` (exit 1)
- Grün: `tasks/evidence/CHG-13-2026-10-29T10-15-55-026Z.json` — 7 Dateien,
  80/80 Tests (exit 0)
- Lint+Typecheck: `tasks/evidence/CHG-13-2026-10-29T10-16-24-463Z.json` (exit 0)

## Befund

- Scope: alle Änderungen in `apps/web/` — passt zu `allowed_paths`.
- Stack: React/lucide-react (freigegeben), keine neuen Frameworks, keine
  Contract-Änderung.
- Keine Blocker. Hinweis: `errors`-Feld in Ergebnissen wird nicht mehr
  angezeigt (laut Nutzerspezifikation „nur Platzierung, Punkte, Spielername"
  beim Sortieren) — Absicht, kein Bug.
