# Review BUG-11 — option.value beim Spiel-Upload erhalten

**Reviewer:** code_reviewer
**Implementiert von:** server_developer (Tests: server_test_engineer)

## Anliegen

Der Projektor soll in der Aufloesung den `value` einer Quiz-Option
anzeigen, falls vorhanden. Das Frontend konnte das bereits
(CHG-22, `SolutionContent` in `ProjectorView.tsx`) — doch beim
Spiel-Upload ging der Wert verloren.

## Root Cause

`catalog-admin.ts:55` baute Quiz-Optionen beim Upload als
`{ id, text }` nach und verwarf `value` — anders als
Sortier-Terms (Zeile 75), die `value` durchreichen. Damit trug
kein hochgeladenes Quiz je einen Wert.

## Diff (Branch BUG-11)

- `catalog-admin.ts`: `value: option.value` in der Optionen-
  Normalisierung ergaenzt (analog zu Sortier-Terms; fehlende
  Werte bleiben `undefined`, Schema kompatibel).
- `catalog-admin.test.ts`: Regressionstest „preserves option
  values from a quiz draft" (Werte 1/2 bleiben, Option ohne
  value → `undefined`).

## Evidence

- Rot: `tasks/evidence/BUG-11-2026-11-13T10-21-16-520Z.json` (exit 1)
- Gruen + Lint: auf main nach Merge aufgezeichnet.

## Findings

- Server-Suite 85/85 gruen; Schema-Validierung
  (`OptionSchema.value` optional) deckt den Pfad ab.
- INV-22-Notiz um BUG-11-Hinweis ergaenzt.
- Keine Blocker.

## Fazit

Freigabe ohne Blocker.
