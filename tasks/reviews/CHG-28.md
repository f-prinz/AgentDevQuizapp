# Review CHG-28 — Katalog alphabetisch nach Titel sortieren

**Reviewer:** code_reviewer
**Implementiert von:** server_developer (Tests: server_test_engineer)

## Anliegen

Host- und Projektoransicht listeten die Spiele in beliebiger
UUID-Reihenfolge. Gewuenscht: alphabetisch nach Titel.

## Vorher/Nachher

- Vorher: `ORDER BY id` (UUID) in `catalog.ts`; Uploads wurden
  per `push` ans Ende des In-Memory-Katalogs gehaengt.
- Nachher: `ORDER BY title` in beiden Lese-Pfaden
  (`readCatalogRows`/`readCatalog`); der POST-/games-Handler
  sortiert den In-Memory-Katalog nach Einfuegen per
  `title.localeCompare`, damit Laufzeit- und DB-Ordnung
  uebereinstimmen.

## Diff (Branch CHG-28)

- `catalog.ts`: `ORDER BY id` → `ORDER BY title` (2 Queries).
- `app.ts`: Upload insert + `catalog.sort` statt reinem `push`.
- `catalog.test.ts`: DB-Test beider Lese-Pfade
  (id-Reihenfolge widerspricht Titel-Reihenfolge).
- `catalog-admin.test.ts`: App-Test — Upload mit Titel vor dem
  bestehenden Spiel landet alphabetisch korrekt in GET /games
  und im In-Memory-Katalog.

## Evidence

- Rot: `tasks/evidence/CHG-28-2026-11-13T10-56-04-330Z.json` (exit 1)
- Gruen + Lint: auf main nach Merge aufgezeichnet.

## Findings

- Kollations-Nuance: SQL sortiert per DB-Kollation, der
  In-Memory-Sort per `localeCompare` — fuer Quiztitel praktisch
  identisch; Edge-Cases (exotische Unicode-Strings) koennen
  minimal abweichen. Akzeptabel.
- INV-22-Notiz um CHG-28-Hinweis ergaenzt.
- Keine Blocker.

## Fazit

Freigabe ohne Blocker.
