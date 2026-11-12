# Review CHG-25 — Quiz-Optionen pro Spieler mischen

**Reviewer:** code_reviewer
**Implementiert von:** server_developer (rote Evidence: server_test_engineer)

## Diff (Branch CHG-25, 2 Dateien)

- `apps/server/src/game.ts`
  - `sortingOrders` → `displayOrders` umbenannt und verallgemeinert
    (per-Spieler-Anzeigereihenfolge fuer Sorting-Terms UND Quiz-Optionen)
  - `sortingOrderForPlayer` → `orderForPlayer` (generisch ueber ids)
  - `projectRound`: Quiz-Spieler bekommen Optionen in per-Spieler
    gemischter Reihenfolge; Host weiterhin Seed-Reihenfolge;
    Projektor weiterhin keine Optionen
  - `nextQuestion` legt frische Map an → neue Mischung pro Frage
- `apps/server/test/game-state.test.ts`
  - Neuer Test: per-Spieler-Shuffle, Host-Seed-Order, Stabilitaet
    innerhalb der Frage (cached)
  - Bestehende Player-Option-Assertion auf Mengen-Gleichheit umgestellt

## TDD-Nachweis

- Rot: `CHG-25-2026-11-12T15-54-50-585Z.json` (exit 1 —
  Shuffle-Assertions schlugen fehl, Optionen kamen in Seed-Reihenfolge)
- Gruen: Branch-Lauf 84/84 Tests

## Pruefpunkte

- **Wertung unveraendert**: `correctOptionId`-Vergleich unabhaengig von
  Anzeigereihenfolge; `validateAnswer` prueft weiterhin ID-Existenz.
- **Stabilitaet**: Order wird in `displayOrders` gecacht — Reconnect
  und Folge-Snapshots zeigen dieselbe Reihenfolge.
- **Keine Pre-Fill-Aenderung**: `resetInputs` prefillt nur Sorting-
  Antworten; Quiz-Antwort bleibt `null` (absichtlich).
- **Host/Projektor unveraendert** in Darstellung und Rechten.
- TECH-20-Grenze 2-6 gilt durch OptionsSchema; Seeds mit 2 Optionen
  sind serverseitig ohne Zusatzcode spielbar.

## Findings

Keine Blocker. Hinweis: Mit `Math.random`-Mock=0 erhalten beide
Spieler dieselbe Permutation — Test prueft bewusst nur
Nicht-Seed-Ordnung + Stabilitaet, keine Per-Spieler-Divergenz
(deterministisch nicht sinnvoll testbar ohne Seed-Injection).

## Fazit

Freigabe ohne Blocker.
