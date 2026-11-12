# Review CHG-27 — Sortierspiel-Titel einblenden

**Reviewer:** code_reviewer
**Implementiert von:** web_developer (Tests: web_test_engineer)

## Anliegen

Sortierspiele zeigten auf Projektor und Spieleransicht keinen
Spieltitel (bewusste CHG-5-Entscheidung, in INV-14 dokumentiert).
Der Nutzer will denselben Stil wie bei Quiz/Schaetzen: Titel in
Vorbereitung, Spielphase und Aufloesung.

## Root Cause

- `apps/web/src/projector/ProjectorView.tsx:107`
- `apps/web/src/player/PlayerGameView.tsx:70`

`{round.game.kind !== "sorting" ? <h3>{title}</h3> : <span />}` —
Titel-Unterdrueckung aus dem UI-Redesign (67a996d).

## Diff (Branch CHG-27, 3 Dateien)

- `ProjectorView.tsx` / `PlayerGameView.tsx`: Bedingung entfernt,
  `<h3 className="...-game-title rq-display">` nun unbedingt —
  1-Zeilen-Fix je Datei, kein CSS noetig (gleiche Klassen wie
  Quiz/Schaetzen).
- `game-views.test.tsx`: neuer describe `CHG-27 sorting game title`
  (it.each start/playing/evaluation auf Projektor und Player); der
  alte FEAT-10-Absenz-Test wurde auf das neue Verhalten invertiert.

## Evidence

- Rot: `tasks/evidence/CHG-27-2026-11-12T17-10-53-338Z.json` (exit 1)
- Gruen + Lint: auf main nach Merge aufgezeichnet.

## Findings

- INV-14-Notiz "Sortierspiel zeigt keinen Titel" (CHG-5) ist
  veraltet → wird mit diesem Task angepasst.
- Keine Blocker. Verhalten deckt sich mit Nutzerbeschreibung
  (Titel in allen drei Phasen, gleicher Stil).

## Fazit

Freigabe ohne Blocker.
