# Review: CHG-15 — Spielername Pflichtfeld (min. 3 Zeichen)

**Reviewer:** code_reviewer
**Implementiert von:** web_test_engineer / web_developer
**Branch:** CHG-15

## Geprüfte Umsetzung

- `apps/web/src/routes/Pages.tsx` (`JoinPage`):
  - `Beitreten`-Button `disabled={name.trim().length < 3}` — unter 3
    getrimmten Zeichen nicht klickbar.
  - `input` mit `required` + `minLength={3}` markiert (Pflichtfeld-Semantik).
  - Submit-Guard erweitert auf `< 3 || > 20` mit angepasster Fehlermeldung —
    fängt Enter-Submit ab, das den disabled-Button umgehen koennte.
  - `maxLength={20}` und Bestehende Server-Fehlerbehandlung unveraendert.
- `apps/web/src/lobby-views.test.tsx`: neuer Test — Button disabled bei 0/2
  Zeichen, enabled ab 3 getrimmten Zeichen, direktes Form-Submit loest keinen
  REST-Call aus und zeigt `role="alert"`.

## Verifikation

- Rot: `tasks/evidence/CHG-15-2026-10-30T07-38-58-999Z.json` (exit 1)
- Grün: `tasks/evidence/CHG-15-2026-10-30T07-39-35-162Z.json` — 88/88 (exit 0)
- Lint+Typecheck: `tasks/evidence/CHG-15-2026-10-30T07-39-56-230Z.json` (exit 0)

## Befund

- Scope: `apps/web/` — passt; kein Contract, keine Dependency.
- Serverseitige Validierung bewusst unveraendert (UI-Anforderung); die
  API nimmt weiterhin 1–20 Zeichen entgegen — Dokumentationshinweis, kein
  Blocker.
- Keine Blocker.
