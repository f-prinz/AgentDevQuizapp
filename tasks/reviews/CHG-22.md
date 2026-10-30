# Review CHG-22 — Quiz-Aufloesung mit Option-`value` auf dem Projektor

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** CHG-22 (abhaengig TECH-19, gemergt)
**Requirements:** `docs/change-quiz-option-value.md`

## Vorher / Nachher

- Vorher: `SolutionContent` (nur Projektor) renderte die Quiz-Loesung
  immer als markierte `<ul>`-Liste (`answer-feedback`).
- Nachher: Traegt mindestens eine Option `value` (TECH-19,
  `OptionSchema.value`), rendert die Aufloesung eine `<table
  class="solution-table">` ohne Header — `Text | Wert | "Richtig"`.
  Ohne `value` bleibt die Liste unveraendert.

## Findings

- **AK erfuellt**: Tabelle nur bei vorhandenem `value`; Spalten
  Text|Wert|Marker; korrekte Option traegt "Richtig" (Nutzerwunsch);
  Optionsreihenfolge unveraendert (kein Re-Sort); leere Zelle bei
  fehlendem `value`; kein Header.
- **Scope korrekt**: ausschliesslich `SolutionContent` (Projektor) —
  Spieler- (eigene markierte Antwort, CHG-8) und Host-Ansicht
  unveraendert, obwohl das Protokoll `value` auch dort mitschickt.
- `value?: number` im Prop-Type ergaenzt — konsistent mit dem
  erweiterten `OptionSchema`; `option.value ?? ""` behandelt gemischte
  Optionen sauber.
- Neue Tests decken Tabelle (Struktur, Zellinhalte, Marker) und
  Listen-Fallback (kein `value` -> bisherige Darstellung) ab.
- Kein Server-/Dependency-Impact; Stackkonform.

## Evidence

- Rot: `CHG-22-2026-10-30T13-39-34-500Z.json` (exit 1 — Tabellen-Test
  rot, Listen-Fallback gruen-by-design)
- Gruen: `CHG-22-2026-10-30T13-40-25-018Z.json` (exit 0)
- Lint: `CHG-22-2026-10-30T13-40-45-198Z.json` (exit 0)

## Fazit

Freigabe ohne Blocker.
