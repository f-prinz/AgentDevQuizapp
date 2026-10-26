# TECH-3 Code Review

Reviewer: `code_reviewer`; Datum: 2026-10-26.
Aktueller Stand: Commit `08d9448`; Erstpruefung: Commit `9e5de1c`.

## Aktuelles Ergebnis der Nachpruefung

**Freigegeben, keine offenen Findings.** Die Nachpruefung hat den vollstaendigen
Fix-Diff `9e5de1c..08d9448` einschliesslich aller drei Evidence-Dateien gelesen,
die geaenderten Vertrags-, Test- und README-Dateien vollstaendig gelesen und
gegen das offene Finding, die TECH-3-Akzeptanzkriterien und Architekturvorgabe
fuer Rundenaktionen abgeglichen. Die Erstpruefung des urspruenglichen gesamten
Branch-Diffs bleibt unten als historischer Nachweis erhalten.

Das Finding `blocker`, `contracts/game.schema.ts:21`, Fehlerklasse `code`, ist
**behoben**: `game.start` verlangt jetzt `roundId: IdSchema`. Dieses bestehende
Schema erlaubt nur nichtleere, begrenzte IDs; das neue Testbeispiel akzeptiert
einen Startbefehl mit ID und lehnt den Befehl ohne ID ab. Die Befehlstabelle
dokumentiert den Rundenbezug. Der Server muss spaeter weiterhin pruefen, ob
die uebermittelte ID die aktuelle Runde bezeichnet; hier wird nur die
erforderliche Vertragsform nachgewiesen.

Keine weiteren Schema-/Dependency-Aenderungen oder Komponentenuebergriffe im
Fix. Die Wiederverwendung von `IdSchema` vermeidet eine zweite ID-Validierung.
`docs/feature-inventory.md` enthaelt weiterhin keine vorhandenen
Nutzerfaehigkeiten; keine Duplikation. Die invarianten Grenzen aus
`docs/agent-context.md` bleiben gewahrt. `lint_command` ist fuer TECH-3 nicht
gesetzt; `docs/tech-stack.md` definiert fuer contracts keinen Lint-Befehl.

### Tatsaechlich in der Nachpruefung ausgefuehrt

| Befehl | Ergebnis |
| --- | --- |
| `git diff 9e5de1c..HEAD -- contracts/game.schema.ts contracts/test/protocol.test.mjs contracts/README.md` | Fix vollstaendig gelesen |
| `git diff 9e5de1c..HEAD -- tasks/evidence/` | Rote Evidence (Exit 1) und gruene Test-/Typecheck-Evidence (je Exit 0) gelesen |
| `npm --prefix contracts test` | Exit 0; Build erfolgreich, 7/7 Tests bestanden |
| `npm --prefix contracts run typecheck` | Exit 0; TECH-3-Kriterium `tsc-Check gruen` erfuellt |
| `git diff --check 9e5de1c..HEAD` | Exit 0 |

Die gespeicherten Nachweise sind
`tasks/evidence/TECH-3-2026-10-26T13-23-54-281Z.json` (rot),
`tasks/evidence/TECH-3-2026-10-26T13-25-08-567Z.json` (Tests gruen) und
`tasks/evidence/TECH-3-2026-10-26T13-25-12-099Z.json` (Typecheck gruen).

Geaenderte Datei durch den Reviewer: ausschliesslich
`tasks/reviews/TECH-3.md`. Offene Blocker: keine; Fehlerklasse: entfaellt.

## Historischer Erstbericht (Commit `9e5de1c`)

Gepruefter Branch-Diff der Erstpruefung: `main...TECH-3`.

### Ergebnis der Erstpruefung

**Aenderung erforderlich: ein Protokollblocker.** Der vollstaendige Diff
einschliesslich Lockfile, Schema-Beispielen und Evidence wurde gegen TECH-3,
`docs/agent-context.md`, den freigegebenen Stack, Anforderungen, Architektur
und Plan gelesen. Die Komponente bleibt TypeScript/ESM mit zod; nur die
freigegebenen zod-/TypeScript-/Node-Typ-Pakete werden versioniert eingefuehrt.
Keine Anwendungskomponente oder Buchhaltungsdatei wurde auf dem Branch geaendert.

### Finding der Erstpruefung (oben als behoben nachgeprueft)

1. **blocker**, `contracts/game.schema.ts:21`: `game.start` hat keine
   `roundId`. Der Vertrag akzeptiert daher einen Startbefehl ohne Rundenbezug
   und lehnt denselben Befehl mit `roundId` als unbekanntem Feld ab. Die
   Architektur verlangt bei Rundenaktionen die Runden-ID; auch README
   beschreibt damit abgesicherte Rundentransitionen. Im bereits mit einer
   Runden-ID versehenen Startzustand kann der Server so einen verspaeteten
   Startbefehl fuer eine andere Runde nicht anhand des Protokolls erkennen.
   **Fix:** `roundId: IdSchema` fuer `game.start` verpflichtend machen;
   positiven Startbefehl samt ID und Ablehnung der fehlenden ID testen;
   die Befehlstabelle in README entsprechend praezisieren.

### Weitere gepruefte Kriterien der Erstpruefung

- Lobby-, Spiel- und Timerfamilien sowie Auth/Resume und Versionsregeln sind
  vorhanden. Die Schema-Beispiele pruefen gueltige und ungueltige Payloads.
- Die Rollen-/Phasenschemas sind strict und unterscheiden Spielaufgabe von
  Auswertung. Private Spielereingaben sind ausschliesslich im Spielerzustand
  vorgesehen; Seeds sind getrennt als Speicherform dokumentiert.
- Timer modellieren die zusaetzlichen 2000 ms und den Freigabezustand.
  Empfangszeit, Rollenbindung, Wertung, Permutations-/Rundenpruefungen und
  Snapshotprojektion sind explizite spaetere Serverpflichten, kein hier
  vorgetaeuschter Laufzeitnachweis.
- Die Paketexports verweisen auf gebaute ESM-Dateien und Typdeklarationen.
  Ein Selbstimport ueber `@raccoons/contracts` funktioniert nach dem Build.
  Es gibt noch keinen Web-/Serververbraucher, daher keine Behauptung zur
  tatsaechlichen Vite-/Serverintegration.
- `docs/feature-inventory.md` enthaelt keine vorhandenen Nutzerfaehigkeiten;
  keine solche Faehigkeit wird dupliziert. TECH-3 schafft nur Schnittstellen.
- `lint_command` ist fuer contracts nicht gesetzt. Es besteht kein
  verpflichtender ESLint-Lauf fuer diesen Task. Die gespeicherte gruene
  Typecheck-Evidence und der zuvor dokumentierte Sandbox-EPERM wurden gelesen;
  ein eigenes Typecheck-Ergebnis wird hier nicht behauptet.

### Tatsaechlich ausgefuehrte Pruefungen der Erstpruefung

- Vollstaendige Dateilekture des Branch-Diffs und aller Vertragsdateien,
  README, Tests, Paket-/Lockdatei sowie Evidence. Ein erster Leseaufruf
  verwendete den nicht vorhandenen Testnamen `contracts.test.mjs`; danach
  wurde die tatsaechliche Datei `test/protocol.test.mjs` vollstaendig gelesen.
- `node --test contracts/test/protocol.test.mjs`: Exit 0, **6/6** Tests.
- `git diff --check main...TECH-3`: Exit 0.
- ESM-Probe `ClientMessageSchema.safeParse` fuer `game.start` ohne/mit
  `roundId`: `true` / `false`, bestaetigt Finding 1.
- Selbstimport ueber `@raccoons/contracts` aus dessen Paketverzeichnis:
  Exit 0; `ClientMessageSchema.safeParse` und `SnapshotSchema.safeParse`
  sind Funktionen.

Geaenderte Datei: ausschliesslich `tasks/reviews/TECH-3.md`.
Blocker-Fehlerklasse: `code`.
