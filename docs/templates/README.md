# Templates

Zwei Template-Familien:

## Anfrage-Vorlagen (fuer dich als Nutzer)

`request-*.md` — kopieren, ausfuellen und als Auftrag einreichen (oder als
strukturierter Eintrag in `docs/changes.md` mit dem passenden Tag). Sie
spiegeln die Eingangskriterien der Playbooks — ein voll ausgefuelltes
Template durchlaeuft die Klaerungsphase ohne Rueckfragen.

| Vorlage | Fuer |
|---|---|
| `request-feat.md` | neue Funktionalitaet (User Story) |
| `request-bug.md` | Fehlerbehebung (erwartet/tatsaechlich + Repro) |
| `request-chg.md` | Aenderung an Bestehendem (Ist → Soll) |
| `request-tech.md` | expliziter interner Wunsch (Prototyp, Scaffolding) |
| `request-question.md` | reine Verstaendnisfrage (kein Code) |

## Agent-Vorlagen (vom Prozess genutzt)

`component-developer.toml`, `component-test-engineer.toml` — Vorlagen fuer
das Agenten-Paar je Komponente; werden von `scripts/add-component.mjs`
kopiert. Nicht von Hand duplizieren — das Skript uebernimmt das.
