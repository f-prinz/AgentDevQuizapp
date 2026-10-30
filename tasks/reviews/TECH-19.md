# Review TECH-19 — Optionales `value` an Quiz-Optionen

**Reviewer:** code_reviewer
**Implementiert von:** integration_engineer
**Branch:** TECH-19 (CONTRACT_CHANGE)
**Requirements:** `docs/change-quiz-option-value.md`

## Scope

- `contracts/game.schema.ts` — `OptionSchema` um
  `value: FiniteNumberSchema.optional()` erweitert
- `contracts/test/protocol.test.mjs` — neuer Test: Seeds/Solution mit
  `value` validieren, gemischte Optionen erlaubt, `NaN` abgelehnt

## Findings

- **Additiv/abwaertskompatibel**: optionales Feld auf
  `strictObject` — bestehende Payloads ohne `value` bleiben gueltig;
  fremde Felder werden weiterhin abgelehnt. Keine Versionsaenderung
  noetig (additive Erweiterung laut `contracts/README.md`).
- **Durchgriff korrekt**: `FourOptionsSchema` deckt HostTask,
  PlayerTask, Solution und `QuizQuestionSeedSchema` ab — Upload und
  Snapshots tragen `value` konsistent; `FiniteNumberSchema` lehnt
  `NaN`/`Infinity` ab.
- **Passthrough verifiziert**: `apps/server/src/game.ts` (~Z511/541)
  serialisiert `question.options` unveraendert — kein Server-Change.
- `value` ist rein informativ, kein Einfluss auf Bewertung
  (`game.ts` Punkte-Logik unberuehrt); unique-values-Refinement gilt
  weiterhin nur fuer `sorting.terms` (korrekt).
- Hinweis (kein Blocker): `value` reist auch in Host-/Player-Task-
  Payloads mit — dokumentiert als Nicht-Anzeige-Scope (nur Client-
  Rendering auf dem Projektor); kein Leakage-Schutzbedarf, da der Wert
  informativ ist und der Spieler die richtige Option ohnehin nicht
  kennt.

## Evidence

- Rot: `TECH-19-2026-10-30T13-35-30-795Z.json` (exit 1)
- Gruen: `TECH-19-2026-10-30T13-35-57-978Z.json` (exit 0)
- Lint: `TECH-19-2026-10-30T13-36-00-774Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
