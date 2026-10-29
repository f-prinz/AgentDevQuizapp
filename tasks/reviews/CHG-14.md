# Review: CHG-14 — Projektor-Eval als 3-Spalten-Layout

**Reviewer:** code_reviewer
**Implementiert von:** web_test_engineer / web_developer
**Branch:** CHG-14

## Geprüfte Umsetzung

- `apps/web/src/routes/Pages.tsx` (`ProjectorPage`): In der Auflösung wird
  `Results` als eigenes Grid-Kind von `.projector-layout` zwischen
  Spielbereich und Rangliste gerendert; Modifier-Klasse
  `projector-layout-eval` schaltet das 3-Spalten-Grid. `Results` dafuer aus
  `GameViews.tsx` exportiert.
- `apps/web/src/GameViews.tsx` (`ProjectorGameView`): `.projector-eval`
  entfernt — Frage (`.projector-stage`) und `SolutionContent` bleiben
  gestapelt im schmaleren Spielbereich.
- `apps/web/src/styles/app.css`:
  - Ranglisten-Spur `minmax(14rem, 20vw)` — vw-basiert, also konstant
    unabhaengig von der Spaltenzahl ("gleiche Breite").
  - `.projector-layout-eval`: `3fr | minmax(18rem, 26vw) | 14rem/20vw` —
    Ergebnisse etwas breiter als die Rangliste.
  - `.projector-ranking` und `.projector-layout > .results` teilen
    `max-height: calc(100vh - padding)` + `overflow-y: auto` — gleiche
    Hoehe, internes Scrollen bei 25 Zeilen.
  - `.projector-eval`-Regel und eigenes `.results`-max-height entfernt.

## Testfälle

- `game-views.test.tsx`: Eval-Test auf neue Struktur umgestellt — `.results`
  als direktes Kind von `.projector-layout` in der Reihenfolge
  Spielbereich → Ergebnisse → Rangliste, `.projector-eval` nicht vorhanden,
  Frage/Aufloesung im Spielbereich. Neuer Test: ausserhalb der Aufloesung
  keine Ergebnis-Spalte / kein Modifier. Sortier-/Schätz-Tests auf
  dokumentweite `.results-table`-Queries angepasst.

## Verifikation

- Rot: `tasks/evidence/CHG-14-2026-10-29T11-06-42-574Z.json` (exit 1)
- Grün: `tasks/evidence/CHG-14-2026-10-29T11-10-38-721Z.json` — 87/87 (exit 0)
- Lint+Typecheck: `tasks/evidence/CHG-14-2026-10-29T11-11-01-972Z.json` (exit 0)

## Befund

- Scope: `apps/web/` — passt; keine Contract-/Dep-Aenderung.
- Keine Blocker. Hinweis: Die Rangliste hat jetzt ebenfalls ein internes
  `max-height`-Scrollen (Konsequenz aus "Ergebnisse genau so hoch wie die
  Rangliste" — gemeinsame Hoehe beider Spalten).
