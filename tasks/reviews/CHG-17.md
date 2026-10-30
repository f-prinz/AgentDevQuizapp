# Review CHG-17 — Projektor-Tabellen: kleinere Basis, Top-3-Gradient

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** CHG-17

## Scope

- `apps/web/src/styles/app.css` — Basis-Schrift von
  `.projector-ranking .ranking-table` und `.projector-layout .results-table`
  auf `clamp(0.9rem, 1.4vw, 1.2rem)` (vorher min 1.05rem/1rem, max 1.6rem/1.5rem);
  `tbody tr:nth-child(1..3)` mit `1.55em / 1.3em / 1.15em` gestaffelt;
  font-size aus dem generischen `.results-table`-Block in die
  Projektor-selektierte Regel verschoben (Layout-Props bleiben generisch)
- `apps/web/src/projector-layout.test.tsx` — zwei CSS-Text-Tests:
  Basis-Minimum kleiner als bisher + strikt fallender Gradient 1>2>3>Basis

## Findings

- **Ansatz**: reine CSS-Loesung via `:nth-child` — kein Markup-Eingriff, da
  beide Tabellen bereits sortiert rendern (Rangliste nach Platz, Ergebnisse
  nach Platz/Punkten). Bei Gleichstand zaehlt die angezeigte Zeilenposition.
- **em-Skalierung**: Gradient relativ zur Tisch-Basis — proportional und
  unabhaengig von clamp-Aufloesung.
- **Scope**: `.projector-layout`-Scoping auf results-table haelt den Effekt
  projektor-seitig, wie gewuenscht.
- **Keine Dependency-Aenderungen**, Stack-konform.

## Evidence

- Rot: `CHG-17-2026-10-30T08-29-56-161Z.json` (exit 1 — neue Tests rot)
- Gruen: `CHG-17-2026-10-30T08-32-29-111Z.json` (exit 0, 94/94)
- Lint: `CHG-17-2026-10-30T08-31-33-425Z.json` (exit 0, eslint + tsc)

## Fazit

Freigabe ohne Blocker.
