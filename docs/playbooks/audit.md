# Playbook: Audit

Vollstaendigkeitspruefung des Funktionsinventars (tasks/inventory.json) gegen den Ist-Zustand. Laeuft verpflichtend vor jedem Meilenstein-Abschluss und vor docs/final-report.md sowie jederzeit auf Zuruf.

## Ablauf
1. **Mechanische Vorpruefung:** `node scripts/check-inventory.mjs` (Konsistenz zwischen Inventar und tasks/state.json, Existenz der file-/test-/route-Anker).
2. **Delegieren an `scope_auditor`:** Er fuehrt alle Anker aktiver Eintraege wirklich aus — Tests werden gestartet, Routen im Komponenten-Verzeichnis gesucht, `ui_step`-Anker per Browser-/Laufzeitpruefung nachgespielt. Fuer `removed`-Eintraege prueft er die Abwesenheit der Anker.
3. **Befunde aufnehmen:** je Eintrag `vorhanden | verloren | nicht pruefbar (Grund)`.
4. **Findings einsteuern:** verlorene Faehigkeit => neuer `BUG`-Task mit Verweis auf die INV-ID; `nicht pruefbar` => Ursache klaeren (fehlende Umgebung/Freigabe: eskalieren; fehlender/falscher Anker: Inventar via `CHG`- oder `TECH`-Task nachschaerfen).
5. **Aufraeumen:** bei Meilenstein-Abschluss erledigte Tasks via `node scripts/archive-tasks.mjs` nach `tasks/archive.json` verschieben (haelt state.json und backlog.md klein; INV-Verweise bleiben aufloesbar).

## Eskalation
- Ein verlorener oder ungeklaert nicht pruefbarer Eintrag blockiert den Meilenstein-Abschluss.
- Der `scope_auditor` fixt nichts selbst und aendert kein Inventar; Korrekturen laufen ausschliesslich ueber neue Tasks.

## Ergebnisformat
Gepruefte Eintraege | Ergebnis je Eintrag | Findings -> neue Task-IDs | nicht pruefbare Eintraege mit Grund
