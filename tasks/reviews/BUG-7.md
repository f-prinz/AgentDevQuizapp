# Review BUG-7 — RankingTable-Dedupe per resultId

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** BUG-7

## Scope

- `apps/web/src/GameViews.tsx` — `RankingTable` haengt die
  Transition-Animation an `transition.resultId` (primitive Dependency)
  statt an der Objekt-Identitaet; `transitionRef` liefert dem Effekt das
  aktuelle Objekt
- `apps/web/src/overview-views.test.tsx` — neuer Test: gleiche resultId
  re-animiert nicht, neue resultId startet Animation

## Root Cause

Jeder Snapshot erzeugt beim JSON-Parse ein neues `rankingTransition`-Objekt.
Der Effekt `useEffect(..., [transition])` feuerte deshalb bei **jeder**
Snapshot-Auslieferung neu — die Animation lief bei jeder Host- oder
Spieler-Aktion erneut. Zusammen mit der serverseitig persistierten
Transition (vor BUG-6) = permanente Re-Animation.

## Findings

- Effekt-Dependency `[resultId]` (primitiv): identische Re-Deliverys feuern
  nicht, neue resultId startet korrekt neu, `transition -> null` setzt den
  Stage zurueck auf "after".
- `transitionRef` wird in einem eigenen Effekt **vor** dem
  Animations-Effekt aktualisiert — Deklarationsreihenfolge sichert das
  frische Objekt beim Effekt-Lauf; Render-Zugriff (`shown`, `target`) nutzt
  weiterhin `transition` direkt.
- Serverseitige Ergaenzung (BUG-6): Transition wird bei
  `nextQuestion`/`finishGame` konsumiert — beide Fixes zusammen begrenzen
  die Animation exakt auf die Auswertung.
- Kein Contract-/Dependency-Impact.

## Evidence

- Rot: `BUG-7-2026-10-30T10-22-18-648Z.json` (exit 1 — Dedupe-Test ohne Fix)
- Gruen: `BUG-7-2026-10-30T10-22-50-674Z.json` (exit 0, 100/100)
- Lint: `BUG-7-2026-10-30T10-23-16-871Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
