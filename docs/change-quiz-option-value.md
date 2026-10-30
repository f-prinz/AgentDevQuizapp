# CHANGE — Quiz-Optionen mit optionalem `value` (TECH-19 + CHG-22)

## Anliegen

Quiz-Antwortoptionen koennen kuenftig neben `id` und `text` einen
numerischen `value` tragen. Der wird beim Katalog-Upload mitgeliefert
und soll **nur in der Aufloesung auf dem Projektor** angezeigt werden —
nicht auf Spieler- und Host-Ansicht.

## Entscheidungen (mit Nutzer bestaetigt)

- `value` ist **optional**; Optionen mit und ohne Wert duerfen gemischt
  vorkommen.
- Rein **informativ** — kein Einfluss auf Punkte/Bewertung.
- Anzeige als Tabelle **ohne Header** (wie CHG-21), Spalten
  `Text | Wert`, zusaetzlich Marker-Spalte: die korrekte Option traegt
  weiterhin "Richtig".
- Optionsreihenfolge bleibt wie geliefert (kein Re-Sortieren nach
  `value` — Quiz ist kein Sortierspiel).
- Tabelle wird nur gerendert, wenn mindestens eine Option `value`
  traegt; sonst bleibt die bisherige markierte Liste.
- Nur Projektor-`SolutionContent`; Spieler-/Host-Ansicht unveraendert.

## Zerlegung

- **TECH-19 (contracts, CONTRACT_CHANGE):** `OptionSchema` um
  `value: FiniteNumberSchema.optional()` erweitern — additive Aenderung
  (abwaertskompatibel, optionales Feld). Betrifft `FourOptionsSchema`
  und damit Task-/Solution-/Seed-Schemata; `QuizQuestionSeedSchema`
  akzeptiert `value` beim Upload automatisch. Server reicht Options
  bereits unveraendert durch (`apps/server/src/game.ts` ~Z511/541) —
  kein Server-Change noetig.
- **CHG-22 (web, abhaengig TECH-19):** `SolutionContent`-Quiz-Zweig:
  Tabelle `Text | Wert | Richtig-Marker`, wenn mind. eine Option
  `value` hat; leere Wert-Zelle bei fehlendem `value`.

## Nicht-Ziele

- Keine `value`-Anzeige fuer Host/Spieler (tragt das Protokoll mit,
  wird clientseitig nicht gerendert).
- Keine Auswirkung auf Bewertung, Seed-Validierung (unique values ist
  NUR fuer sorting vorgesehen) oder Antwort-Eingabe.
