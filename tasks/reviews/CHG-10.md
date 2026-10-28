# Review CHG-10 — Farbschema Slate/Indigo mit Text-Hierarchie

Reviewer: code_reviewer (nicht implemented_by web_developer)
Diff-Basis: Branch CHG-10 gegen main.

## Akzeptanzkriterien

- [x] `theme.css` auf Slate-Palette umgestellt: `--color-bg` `#0F172A` (slate-900), Akzent `#818CF8` (indigo-400), Danger `#F87171` (red-400), Border/Flaechen `#475569` (slate-600); neue Tokens `--color-text` `#E2E8F0` und `--color-muted` `#94A3B8`.
- [x] Body-Text nutzt `--color-text` statt Akzentfarbe (`:root`), sekundaerer Text (`p`, `participant-status`, `ranking-table th`) nutzt `--color-muted` — loest das Hierarchie-Problem „Akzent = Fliesstext".
- [x] Gewaehlte Antwort (`answer-selected`) zeigt Akzent statt Rot — semantisch korrekt (gewaehlt != falsch); Textfarbe `var(--color-bg)` fuer Kontrast auf Indigo.

## Prüfpunkte

- **Stack**: reine CSS-Token-/Regelaenderung, keine Dependencies, keine Framework-Aenderung.
- **Kontrast**: #E2E8F0 auf #0F172A ~15:1 (Text), #94A3B8 ~7:1 (muted), #818CF8 auf #0F172A ~5.5:1 (Akzent) — deutlich besser als zuvor; `#F87171` ersetzt das grelle `#FE0000` ohne Signalverlust.
- **Konsistenz**: `.answer-correct` und `answer-flash-*` nutzen weiter die Tokens — weiches Danger/Akzent wirkt automatisch ueberall; keine hardcodierten Restfarben ausser `#fff` (bewusst fuer Text auf gefuellten Flaechen).
- **Scope**: nur `theme.css`/`app.css` — Preview-Branch `preview/colors-slate-indigo` war Referenz, diese Umsetzung ergaenzt `--color-muted` und den Selected-State.

## Befunde

- Keine Blocker.
- Hinweis: Preview-Branches `preview/colors-*` bleiben unangetastet und koennen nach Entscheidung geloescht werden.

## Evidence

- Tests: `tasks/evidence/CHG-10-2026-10-28T15-56-37-461Z.json` (exit 0, 75/75)
- Lint: `tasks/evidence/CHG-10-2026-10-28T15-56-59-900Z.json` (exit 0)
- Kein `red_evidence` erforderlich (`--no-tdd`, reine Styling-Aenderung).

## Ergebnis

APPROVED — Akzeptanzkriterien erfuellt, keine Blocker.
