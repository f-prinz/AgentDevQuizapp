# Review FEAT-19 — Host-Statusliste mit Kick-Dialog

**Reviewer:** code_reviewer
**Implementiert von:** web_developer
**Branch:** FEAT-19

## Scope

- `apps/web/src/routes/Pages.tsx` — `ParticipantList` mit `send`-Prop,
  `kickTarget`-State und Bestaetigungsdialog (`role="dialog"`,
  Abbrechen/Entfernen); Zeilen zeigen `MonitorCheck`/`MonitorX` (Verbunden/
  Getrennt), waehrend `playing` zusaetzlich `Check`/`Loader` (`submitted`),
  `Trash`-Button rechts; `HostPage` rendert die Liste nun hinter
  `HostGameView` und in jeder Phase
- `apps/web/src/styles/app.css` — Zeilenlayout (`participant-name` flex),
  Icon-Abstaende, Kick-Button, `.confirm-dialog`/`.confirm-actions`/
  `.confirm-danger`
- `apps/web/src/game-views.test.tsx` — fuenf neue Tests: Reihenfolge
  (letztes Element, nach `.game-view`), Sichtbarkeit ausserhalb lobby,
  Verbindungs-Icons, Abgabe-Icons, Kick-Dialog (Abbruch sendet nichts,
  Entfernen sendet `player.remove`)
- `apps/web/src/lobby-views.test.tsx` — alter Test „Liste verschwindet nach
  lobby.start" auf neues gewuenschtes Verhalten umgeschrieben

## Findings

- **Reihenfolge** erfuellt: `ParticipantList` rendert nach `HostGameView`,
  immer bei vorhandenem Snapshot — letztes Element und in allen Phasen
  sichtbar.
- **Kick-Gate**: `player.remove` geht nur aus dem Bestaetigungsdialog raus;
  Abbruch sendet nichts (Test deckt beide Pfade).
- **`Trash` statt `Trash2`**: installierte lucide-Version kennt kein `Trash2`
  — `Trash` ist das verfuegbare, semantisch passende Icon.
- **Abgabe-Icons** nur in `playing`-Phase und nicht bei `waiting`-Zeilen —
  entspricht der abgesprochenen Granularitaet.
- `participant.submitted` bleibt optional (TECH-18) — `?`/`undefined` faellt
  korrekt auf `Loader`.
- Keine neuen Dependencies; bestehender `submitted`/`connected`-Snapshot-
  Vertrag wird nur gelesen.

## Evidence

- Rot: `FEAT-19-2026-10-30T09-08-14-108Z.json` (exit 1)
- Zwischenlauf: `FEAT-19-2026-10-30T09-09-57-458Z.json` (exit 1 — alter
  Bestandstest kodierte lobby-exklusive Liste, wurde angepasst)
- Gruen: `FEAT-19-2026-10-30T09-11-19-319Z.json` (exit 0, 99/99)
- Lint: `FEAT-19-2026-10-30T09-11-41-452Z.json` (exit 0, eslint + tsc)

## Fazit

Freigabe ohne Blocker.
