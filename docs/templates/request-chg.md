# Vorlage: CHANGE-Anfrage

Kopieren, ausfuellen und als Auftrag einreichen (oder als Eintrag in
`docs/changes.md` mit Tag `[CHG]`). Jede Aenderung = ein eigener Punkt im
Format **Ist → Soll**. Punkte, die Verhalten aendern, werden mit TDD
umgesetzt (roter Test zuerst); reine Refactorings erkennbar formulieren.

```markdown
# CHANGE: <kurztitel>

- Ist: <aktuelles Verhalten> → Soll: <gewuenschtes Verhalten>   (Grund: optional)
- Ist: <…> → Soll: <…>

**Bereich:** <Komponente/Screen falls bekannt>                 (optional)
```

## Beispiel

```markdown
# CHANGE: Listenansicht

- Ist: Liste sortiert aufsteigend → Soll: absteigend nach Datum
- Ist: 50 Eintraege pro Seite → Soll: 20 (Grund: Ladezeit)

**Bereich:** web, Screen /eintraege
```
