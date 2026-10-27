# CHG-3 code review

**Result: APPROVED.**

Reviewed the branch diff: `apps/web/src/GameViews.tsx`, `routes/Pages.tsx`, `styles/app.css` plus Test-Dateien.

## Scope

Nur `apps/web/`. Keine Contract-/Server-Aenderung.

## Acceptance criteria

- **Host waehrend Spiel: nur Timer + Auflösen** — Frage und Optionen aus `HostGameView` entfernt; Test assertiert Abwesenheit und Timer/Button.
- **Host nach Auflösung: nur End-/Übersichtsaktion** — `SolutionContent`/`Results` aus Host-Auswertung entfernt; nur „Nächste Frage“ bzw. „Spiel beenden / Zur Übersicht“.
- **Projektor: Rangliste rechts, immer** — `ProjectorRanking` (Rangliste + Namens-Fallback ohne Punkte) in rechter Spalte `projector-ranking` (schmäler, vertikal scrollend); Teilnehmerstatus/Verbindungsstatus entfaellt; `ParticipantList` von Projektorroute entfernt.
- **Projektor waehrend Spiel: Frage + grosser Timer** — unveraendert geblieben (`timer-large`), rechts Rangliste.
- **Projektor nach Auflösung: korrekte Antwort zentral** — `SolutionContent`+`Results` in `Spielanzeige`, Rangliste rechts — bestehende Tests decken.
- **Spieler waehrend Spiel: nur Optionen + Timer, keine Frage** — `h3`-Zaehler und Fragetext aus `PlayerGameView` entfernt; Quiz-Optionen als Buttons (grau), Auswahl markiert `data-answer-state="selected"` (rot), kein Radio/Checkbox; Sortierung/Schaetzung unveraendert.
- **Spieler nach Auflösung: richtige Option tuerkis, falsch gewaehlte rot** — `.answer-correct`/`.answer-wrong` als Hintergrundfuellung (statt nur Balken) in `app.css`; `data-answer-state`-Tests gruen.
- **Uebersicht Projektor: offene/gespielte Spiele zentral** — Ranglisten-Spalte aus `projector-overview` entfernt (Aside uebernimmt), `overview-columns` auf 2 Spalten.

## Findings

- Alt-Assertions auf „Teilnehmerstatus“-Region und Host-Frage-/Loesungsanzeige entsprechend Scope geaendert (Projektor zeigt keine Teilnehmerliste mehr — Verbindungsstatus entfaellt komplett).
- `data-answer-state` der gewaehlten Option von `neutral` auf `selected` geaendert; bestehende neutral/correct/wrong-Semantik der Auswertung unveraendert.
- Weisstext auf grauem/rotem Optionsgrund; `color: #fff` lokal in `app.css` (Palette sonst unveraendert).

## Evidence

- Rot: `tasks/evidence/CHG-3-2026-10-27T12-46-31-479Z.json` (exit 1, 13 Fails)
- Gruen: `tasks/evidence/CHG-3-2026-10-27T12-48-28-516Z.json` (62/62, exit 0)
- Lint/Typecheck: `tasks/evidence/CHG-3-2026-10-27T12-48-43-674Z.json` (exit 0)
