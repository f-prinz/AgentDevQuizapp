# FEAT-14: Design-System, Statusleiste und Antwort-Farbmarkierung

## User Story

Als Spieler moechte ich in meiner Ansicht jederzeit meinen Namen, Punktestand
und Rang sehen und Antworten anhand konsistenter Farben einordnen koennen,
damit ich meinen Stand und die Auswertung schnell verstehe. Als Host moechte
ich eine fuer ein mobiles Geraet geeignete Ansicht nutzen, waehrend der
Projektor Inhalte auf einem Desktop-Bildschirm praesentiert.

## MVP-Relevanz und Prioritaet

F9 ist Teil des MVP in `docs/project-idea.md`. FEAT-14 hat Prioritaet P1 und
haengt von TECH-2, FEAT-4 und FEAT-5 ab. FEAT-4 und FEAT-5 sind umgesetzt.
Die bestehende Ranking-Berechnung und das Snapshot-Schema enthalten die
benoetigten Informationen; aktuell erhalten Spieler-Snapshots jedoch ein
leeres Ranking. Fuer die Statusleiste muss die bestehende Projektion auf dem
Server die eigene Ranking-Zeile bereitstellen.

## Akzeptanzkriterien

1. **Zentrales Theme:** Ein zentrales Web-Theme stellt genau die verbindlichen
   CSS Custom Properties fuer Tuerkis `--color-turquoise: #48A3AE`, Rot
   `--color-red: #FE0000`, Grau `--color-grey: #706A6A` und Hintergrund
   `--color-bg: #1D1D1B` bereit. Antwort- und Statusdarstellungen referenzieren
   diese Variablen; die Farbwerte werden nicht als eigene Hex-/RGB-Werte in
   weiteren Web-CSS-Regeln dupliziert.
2. **Eigene Ranking-Projektion:** Sobald ein Spieler im Ranking vertreten ist,
   enthaelt sein Snapshot genau seinen eigenen `RankingEntry` (eigene
   Spieler-ID, Name, Rang, Gesamtpunkte und Spielpunkte). Kein Snapshot fuer
   einen Spieler enthaelt Ranking-Eintraege anderer Spieler. Vor dem ersten
   abgeschlossenen Spiel ist das Ranking leer. Das bestehende Contract-Schema
   wird verwendet; keine Schema- oder Protokollaenderung ist Teil des Tasks.
3. **Spieler-Statusleiste:** In jeder Spieleransicht steht oben eine
   Statusleiste mit eigenem Spielernamen, Gesamtpunkten und Rang. Name wird
   anhand der eigenen Spieler-ID aus dem Snapshot aufgeloest. Punkte und Rang
   entsprechen der eigenen Ranking-Zeile; solange diese noch nicht existiert,
   werden Punkte als 0 und Rang als noch nicht verfuegbar angezeigt. Die Leiste
   aktualisiert sich bei neuem Snapshot ohne Seitenreload.
4. **Antwortfarben:** Vor der Auswertung wird keine Antwort als richtig oder
   falsch ausgegeben; neutrale Antworten verwenden Grau. In der Auswertung ist
   eine richtige Antwort Tuerkis und eine falsche eigene Antwort Rot markiert.
   Farbige Markierungen haben zusaetzlich ein Text-/Statusmerkmal, sodass die
   Bedeutung nicht allein von der Farbe abhaengt. Die Regeln gelten fuer die
   im Web-Client dargestellten Antworttypen, soweit der Snapshot eine
   Auswertung dafuer enthaelt.
5. **Mobile First:** Spieler- und Hostansichten bleiben bei einer CSS-Viewport-
   breite von 320 CSS-Pixeln ohne horizontales Scrollen bedienbar; Statusleiste,
   Frage und Eingaben bleiben sichtbar und in sinnvoller Reihenfolge. Bei
   breiteren Viewports duerfen Inhalte wachsen, ohne dass Bedienfunktionen
   verschwinden.
6. **Projektor:** Die Projektor-Route behaelt ein Desktop-orientiertes Layout.
   Die Spieler-Statusleiste und private Spielerdaten erscheinen dort nicht.
7. **Automatisierte Pruefung:** Servertests pruefen, dass ein Spieler nach
   abgeschlossenen Spielen ausschliesslich seine eigene Ranking-Zeile erhaelt
   und vor dem ersten Ergebnis ein leeres Ranking. Webtests pruefen
   Statuswerte fuer vorhandenes und noch nicht vorhandenes Ranking,
   Farbstati vor und nach der Auswertung, Textalternativen zu Farben sowie
   keine private Statusleiste auf dem Projektor. Lint und Production-Build
   muessen fuer betroffene Komponenten erfolgreich sein. Responsive
   Anforderungen werden, soweit das vorhandene Testtooling es erlaubt, durch
   Viewport-/CSS-Pruefungen automatisiert abgesichert.

## Geklaerte Rueckfragen

- Klaerungsphase abgeschlossen: kein weiterer Produktentscheid ist fuer den
  beschriebenen Umfang erforderlich.
- Der Nutzer hat fuer kuenftige Features manuelle Browser-/Oberflaechentests
  sowie den `ui_step`-Inventarnachweis erlassen. Automatisierte Tests, Lint,
  Build und unabhaengiges Review bleiben erforderlich. Es wird daher keine
  manuelle Browserabnahme als erfolgt behauptet.

## Stack-Annahmen und Konflikte

Die Klassifikation ist **CURRENT_STACK_ONLY** fuer beide betroffenen
Komponenten:

- **server:** bestehende Node.js/TypeScript/WebSocket-Snapshot-Projektion in
  `apps/server/`; Spieler-Snapshots erhalten hoechstens den Ranking-Eintrag
  ihrer eigenen Spieler-ID.
- **web:** bestehende React/Vite/TypeScript-Ansichten und CSS in `apps/web/`;
  Theme, Statusleiste und Antwortdarstellung nutzen den freigegebenen Stack.

Die vier Farben folgen der Web-Invariante aus `docs/agent-context.md`. Das
bestehende Ranking-Schema in `contracts/lobby.schema.ts` enthaelt bereits die
benoetigten Felder; die Aenderung benoetigt keinen `CONTRACT_CHANGE`. Keine
Dependency-, Runtime-, Framework-, Kommunikations- oder Persistenzaenderung
ist vorgesehen. Falls bei der Umsetzung ein fehlendes Contract-Feld entdeckt
wird, ist anzuhalten und ein separater CONTRACT_CHANGE-Task vorzuschlagen.

## Referenzen

- `docs/project-idea.md`, Abschnitt F9 Design / Darstellung.
- `docs/agent-context.md`, UI-/Browser-Pruefung und Web-Farbinvariante.
- `docs/tech-stack.md`, freigegebener Web- und Server-Stack.
- `contracts/lobby.schema.ts`, `PlayerSnapshotSchema` und `RankingEntrySchema`.
- `apps/server/src/lobby.ts`, aktuelle Snapshot-Projektion.
- `tasks/state.json`, FEAT-14 und FEAT-5 Akzeptanzkriterien.
