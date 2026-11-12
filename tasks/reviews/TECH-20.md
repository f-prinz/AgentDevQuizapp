# Review TECH-20 — Quiz-Optionen variabel 2-6 (CONTRACT_CHANGE)

**Reviewer:** code_reviewer
**Implementiert von:** contracts_developer

## Diff

- `contracts/game.schema.ts`: `FourOptionsSchema` (`.length(4)`) →
  `OptionsSchema` (`.min(2).max(6)`), umbenannt und an allen vier
  Verwendungsstellen ersetzt: `HostTaskSchema`, `PlayerTaskSchema`,
  `SolutionSchema`, `QuizQuestionSeedSchema`.
- `contracts/test/protocol.test.mjs`: Grenztests angepasst —
  1 Option und 7 Optionen werden abgelehnt, 2 und 6 akzeptiert.

## Pruefpunkte

- **Konsistenz**: Seed, Solution, HostTask und PlayerTask nutzen alle
  dasselbe Schema — keine divergierenden Grenzen.
- **Abwaertskompatibilitaet**: 4 Optionen bleiben gueltig (Teilmenge von
  2-6); bestehende Seeds funktionieren unveraendert.
- **uniqueIds-Refine** bleibt erhalten; `strictObject` auf OptionSchema
  unveraendert (value optional, TECH-19).
- **Namensbruch**: `FourOptionsSchema` export umbenannt — keine externen
  Referenzen ausserhalb `contracts/` (grep verifiziert).
- **Keine Logik-Aenderung**: korrekte Antwort weiterhin per
  `correctOptionId`, optionale `value` weiterhin informativ.

## Findings

Keine Blocker. Hinweis: Server/Web konsumieren `@raccoons/contracts` via
`file:`-Dependency auf `dist/` — CHG-25/26 bauen darauf auf; dort wird
die Runtime-Seite (Shuffle, Layout) verifiziert.

## Evidence

- `contracts test`: 11/11 pass
- `contracts lint` (`tsc --noEmit`): sauber

## Fazit

Freigabe — kleiner, konsistenter Contract-Change.
