# Validierung: Quiz-Integration (TECH-8)

Datum: 2026-10-27 · Task: TECH-8 · Komponente: server

## Nachgewiesene Faehigkeiten

`apps/server/test/e2e/quiz.test.ts` (1/1 Test, ~32s wegen echter 30s-Deadline,
Evidence `tasks/evidence/TECH-8-2026-10-27T10-19-55-560Z.json`).

- **Zwei-Fragen-Quiz mit zwei Spielern** — kompletter Ablauf von
  `lobby.start` über `game.select`/`prepare`/`start` bis `game.finish`.
- **Wertung richtig/falsch** — Frage 1: Ada korrekt (1 Punkt), Bo falsch
  (0 Punkte); Host-Solution `correctOptionId` stimmt mit Seed ueberein.
- **Wertung kein Beantworten** — Frage 2 ohne Abgaben: nach echter
  30s-Deadline + `acceptUntil`-Frist schliesst der Server die Eingabe;
  Aufloesung liefert 0 Punkte und `ownEvaluation.answer: null`.
- **Aufloesungs-Gate** — `game.reveal` vor Eingabeende wird mit
  `INVALID_PHASE` abgewiesen (`canReveal` erst bei `inputClosed`).
- **Spaete Abgabe nach Deadline** — `answer.submit` nach `inputClosed`
  wird mit `INPUT_CLOSED`/`INVALID_PHASE` abgewiesen.
- **Rollen-Isolation** — Host-Task enthaelt alle Optionen;
  Projektor-Task enthaelt nur die Frage (`options` nicht vorhanden).
- **Runden-Rotation** — `game.next` erzeugt neue `roundId`, Frage-Index 1,
  `hasNextQuestion: false` am Ende.

## Browserbelege

Bereits erbracht in FEAT-4/FEAT-8 (Inventar-Anker INV-15/INV-16):
Aufgabe auf Projektor/Host, Optionen auf Spielergeraet und Host,
Radio-Auswahl, markierte richtige/falsche Antwort nach Aufloesung.

## Befund aus der Validierung

- `inputClosed` wird ebenfalls gesetzt, sobald alle Teilnehmenden final
  abgegeben haben (deshalb war `reveal1` vor der Deadline moeglich) —
  e2e-verifiziert.
- Waits in e2e-Tests muessen `roundId`-spezifisch filtern: gepufferte
  Snapshots alter Runden koennen Phasen-Praedikate vorzeitig erfuellen
  (im Test gefunden und als Muster dokumentiert).

## Scope-Audit

Diff: nur `apps/server/test/e2e/quiz.test.ts` + `docs/validation/quiz.md` +
Evidence — innerhalb `allowed_paths`. Kein Produktivcode geaendert.
