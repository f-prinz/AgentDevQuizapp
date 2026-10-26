# Vorlage: TECH-Anfrage

TECH-Tasks (Scaffolding, Contracts, Infrastruktur, Prototypen) erzeugt der
Prozess meist selbst. Diese Vorlage ist fuer explizite Wuensche — z. B.
"baue mir einen HTML-Prototyp", "Refaktorisiere X", "lege Komponente Y an".

```markdown
# TECH: <kurztitel>

**Ziel:** <was technisch erreicht werden soll>

**Bereich:** <Komponente / contracts/ / docs/prototypes/ — falls bekannt>   (optional)
```

## Beispiele

```markdown
# TECH: Prototyp Nutzerliste

**Ziel:** self-contained HTML-Prototyp der Listenansicht zum Pruefen
im Browser, bevor implementiert wird.

**Bereich:** docs/prototypes/
```

```markdown
# TECH: Komponente worker anlegen

**Ziel:** Hintergrund-Verarbeitung als eigene Komponente trennen.

**Bereich:** neue Komponente `worker`
```
