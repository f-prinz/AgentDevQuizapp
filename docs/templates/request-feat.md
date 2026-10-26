# Vorlage: FEATURE-Anfrage

Kopieren, ausfuellen und als Auftrag einreichen (oder als Eintrag in
`docs/changes.md` mit Tag `[FEAT]`). Alles, was du mitlieferst, reduziert
Rueckfragen in der Klaerungsphase.

```markdown
# FEATURE: <kurztitel>

**User Story:** Als <Rolle> moechte ich <Ziel>, um <Nutzen>.

**Kontext:** <Bezug zu bestehender Funktion / warum jetzt>   (optional)

**Layout:** <docs/prototypes/<name>.html | Skizze-Pfad | "frei nach Stack-Konventionen">

**Nicht Teil davon:** <explizit ausgeschlossene Punkte>      (optional)

**Bekannte offene Fragen:** <…>                              (optional)
```

## Beispiel

```markdown
# FEATURE: Nutzer deaktivieren

**User Story:** Als Admin moechte ich Nutzer deaktivieren, um Zugaenge
zu sperren, ohne Konten zu loeschen.

**Layout:** docs/prototypes/admin-users.html (Tabelle mit Toggle rechts)

**Nicht Teil davon:** Reaktivierung, Audit-Log
```
