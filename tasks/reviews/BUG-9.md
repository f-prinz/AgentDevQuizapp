# Review BUG-9 — Sortier-Punkte: Abwärts-Regel statt exakter Position

**Reviewer:** code_reviewer
**Implementiert von:** server_developer
**Branch:** BUG-9
**Regel (Nutzer, Option A):** Ein Term zählt als richtig, wenn sein
`value` größer ist als der des unmittelbar vorherigen Terms; der erste
Term zählt immer. `positionsCorrect` folgt derselben Regel.

## Vorher / Nachher

- Vorher (`game.ts:270-271`): `termId === correctOrder[index]` — nur
  exakte Position zählte; zyklisch korrekte Ordnungen → 0 Punkte.
- Nachher (`game.ts:273-276`): `valueByTermId`-Map;
  `positionsCorrect[i] = i === 0 || value(i) > value(i-1)`.
  `points = count * pointsPerCorrectPosition` unverändert.

## Findings

- **AK erfüllt**: Alle vier Nutzer-Fälle deckt der neue Test
  (8/7/7/6 Punkte, korrekte `positionsCorrect`-Masken); bestehender
  3-Term-Test angepasst (`[b,a,c]` → `[t,f,t]`, 2 Punkte, errors 1).
- **Konsequenz dokumentiert**: implizit immer ≥1 Punkt bei ≥1 Term
  (vom Nutzer als Default bestätigt).
- Fehler-Markierung (`positionsCorrect` → `ownEvaluation`, `errors`
  in `results`) folgt derselben Regel — UI-Rendering unverändert.
- `?? Number.NEGATIVE_INFINITY` auf unbekannte Term-IDs ist defensiv
  korrekt (Antwort wird zuvor gegen Seed validiert — kein praktischer
  Pfad, aber typsicher).
- `sortingTermsByValue` bleibt für die Lösungs-Darstellung genutzt.
- Nur `apps/server/` im Scope; kein Contract-/Web-Change nötig.

## Evidence

- Rot: `BUG-9-2026-11-12T13-53-22-140Z.json` (exit 1)
- Gruen: `BUG-9-2026-11-12T13-54-21-031Z.json` (exit 0)
- Lint: `BUG-9-2026-11-12T13-55-24-668Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
