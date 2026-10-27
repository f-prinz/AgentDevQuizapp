# Validierung: Ranking und Darstellung (TECH-11)

Datum: 2026-10-27 · Task: TECH-11 · Komponente: web

## Nachgewiesene Faehigkeiten

`apps/web/test/e2e/ranking.test.tsx` (1/1 Test, Evidence
`tasks/evidence/TECH-11-2026-10-27T10-29-38-228Z.json`) — Web-e2e ueber
die echte Projektorroute mit Snapshot-Sequenz (FakeWebSocket +
React Router, kein Mock der Komponenten).

- **Leeres Ranking** — vor dem ersten Spiel keine Tabelle, nur
  Spielernamen in der Rangliste.
- **Nach Spiel 1** — Tabelle mit Kopf Platz/Punkte/Spielername/Spiel 1;
  `rankingTransition` animiert vorherige->aktuelle Werte
  (`data-ranking-stage` before→counting→after); Katalog wandert korrekt
  zwischen "Offene Spiele" und "Gespielte Spiele".
- **Nach Spiel 2** — zweite Spielspalte, aktualisierte Gesamtpunkte und
  neue Rangfolge (Bo 6 > Ada 4); keine offenen Spiele mehr.
- **Darstellung/Theme** — `app.css` verwendet ausschliesslich die vier
  freigegebenen CSS-Variablen (`--color-turquoise/-red/-grey/-bg`);
  Ranglisten-Animationsklassen respektieren
  `prefers-reduced-motion`.

## Browserbelege

Bereits erbracht in FEAT-6 (Inventar-Anker INV-17): Projektor-Übersicht
mit dreispaltigem Layout, Ranking-Tabelle und animiertem Übergang im
Browser geprueft.

## Scope-Audit

Diff: nur `apps/web/test/e2e/ranking.test.tsx` +
`docs/validation/ranking.md` + Evidence — innerhalb `allowed_paths`.
Kein Produktivcode geaendert.
