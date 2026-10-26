# Vorlage: BUG-Anfrage

Kopieren, ausfuellen und als Auftrag einreichen (oder als Eintrag in
`docs/changes.md` mit Tag `[BUG]`). Die Eingangskriterien des Bug-Playbooks
sind Erwartet/Tatsaechlich + Reproduktion — je voller, desto direkter geht
es in die Reproduktion.

```markdown
# BUG: <kurztitel>

**Erwartet:** <was passieren sollte>

**Tatsaechlich:** <was passiert stattdessen — Fehlermeldung/Fehlverhalten>

**Reproduktion:**
1. <Schritt>
2. <Schritt>
3. <Schritt>

**Umgebung:** <Browser/Client, Rolle, Route/Endpoint — was du weisst>

**Seit wann / Regression?:** <optional>

**Impact:** <blockiert Arbeit | Funktionsfehler | kosmetisch>
```

## Beispiel

```markdown
# BUG: Speichern wirft 500

**Erwartet:** Formular speichert und Liste aktualisiert sich.

**Tatsaechlich:** HTTP 500, Toast "Serverfehler", Eintrag fehlt nach Reload.

**Reproduktion:**
1. Als Editor einloggen
2. /eintraege → "Neu" klicken
3. Titel "x" eingeben → "Speichern" → Fehler

**Umgebung:** Chrome, Rolle Editor, Route POST /eintraege

**Impact:** blockiert Arbeit
```
