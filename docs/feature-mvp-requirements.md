# RaccoonsQuizgame MVP – Anforderungen

Status: abgestimmt mit dem Nutzer am 2026-10-26. Grundlage sind
`docs/project-idea.md` und die ergaenzende `Prinzgame.md`.

## Ziel und Umfang

Eine lokal laufende Mehrspieler-Quiz-Webanwendung fuer einen Host, beliebig
viele Spieler und einen Projektor. Das MVP umfasst Lobby, Uebersicht/Ranking,
Spielphasen, Quiz, Sortieren, Schaetzen, Timer/Reconnect und die festgelegte
Darstellung. Alle folgenden Faehigkeiten gehoeren zum MVP; die Prioritaet
ordnet die Umsetzungsreihenfolge und schliesst nichts aus.

Nicht im MVP: Konten/Login, Inhaltseditor, dauerhafte Lobby-/Ergebnishistorie,
weitere Spielarten und Sound.

## Rollen und Regeln

- **Host:** moderiert auf einem Smartphone, erstellt die Lobby, waehlt und
  startet Spiele, loest Auswertungen auf und steuert die Phasen. Er ist kein
  Spieler und erscheint nicht in Teilnehmerzahl oder Ranking.
- **Spieler:** tritt ueber den Lobby-Link bei, spielt auf einem Smartphone und
  hat einen Namen mit hoechstens 20 Zeichen. Bis zur Namensvergabe lautet die
  Anzeige `Spieler <lfd. Nr.>`.
- **Projektor:** tritt ueber einen eigenen Link bei, zeigt ausschliesslich
  Spielinformationen und nutzt ein Desktop-Layout.
- Spielerzahl ist unbegrenzt. Der Host kann starten, sobald mindestens zwei
  Spieler beigetreten sind.
- Alle Katalogspiele stehen jeder Lobby zur Verfuegung. Abgeschlossene
  Lobbys, laufende Spielstaende und Resultate werden nicht ueber einen
  Serverneustart hinaus gespeichert. Nur Spielinhalte/Katalog sind persistent
  und werden aus Seed-Dateien geladen.

## Anforderungen nach Prioritaet

### P0 – Gemeinsamer Spielablauf und Quiz

#### F1 Lobby

**Als Host** moechte ich eine Lobby eroeffnen und Rollen-Links erhalten,
damit Spieler und Projektor beitreten koennen.

- Die Lobby erhaelt eine eindeutige ID und einen Spieler-Beitrittslink sowie
  einen separaten Projektor-Link und einen eigenen Host-Link fuer die
  Moderation.
- Der Host-Link enthaelt ein nicht erratbares Geheimnis. Wer diesen Link
  besitzt, kann die Lobby moderieren. Ein Refresh im selben Browser stellt den
  Host-Zugriff wieder her, solange Lobby und Serverprozess laufen; Konten oder
  Login gibt es im MVP nicht.
- Der Spielerlink fuehrt zur Namenseingabe und Lobbyansicht. Namen sind auf
  20 Zeichen begrenzt; unbenannte Teilnehmer werden mit fortlaufender Nummer
  angezeigt.
- Host und Spieler sehen dieselbe aktuelle Teilnehmerliste. Der Host ist
  darin nicht enthalten.
- Der Host kann bei mindestens zwei beigetretenen Spielern starten; es gibt
  weder ein Spielerlimit noch eine konfigurierbare Maximalzahl.
- Ein neu beitretender Spieler waehrend eines laufenden Spiels wird fuer die
  naechste Spielauswahl vorgemerkt und nimmt am bereits laufenden Spiel nicht
  teil. Reconnect eines bereits bekannten Spielers stellt dessen bestehende
  Teilnahme wieder her.

#### F3 Spielphasen und F7 Echtzeit/Timer

**Als Host** moechte ich den Spielablauf steuern; **als Spieler/Projektor**
moechte ich die fuer meine Rolle passende Phase und den synchronen Timer
sehen.

- Gemeinsame Phasen sind Start, Spiel und Auswertung. Start: Spieler sehen
  Titel und Startanimation, Projektor Titel und Regeln, Host Titel und
  Start-Button. Der Host-Button startet die Spielphase.
- Die Spielphase endet, wenn alle aktuell teilnehmenden Spieler final
  abgegeben haben oder die Zeit abgelaufen und die Nachfrist verstrichen ist.
- In der Auswertung sehen Host und Projektor die Aufloesung; die vom Spiel
  vorgegebene Host-Aktion fuehrt zur naechsten Frage oder zur Uebersicht.
- Zeitlimits und Deadlines werden serverseitig gefuehrt. Alle Rollen erhalten
  dieselbe Deadline; die Anzeige laeuft in allen Ansichten, bei Spielern
  kompakt und auf dem Projektor gross.
- Spieler koennen waehrend der laufenden Eingabephase ihre Antwort aendern.
  `Abgeben` macht die zuletzt uebermittelte vollstaendige Antwort final und
  sperrt weitere Aenderungen. Sind alle aktuellen Spieler final, endet die
  Eingabephase vorzeitig.
- Nicht final abgegebene Eingaben werden bei Ablauf als letzter Stand
  gewertet. Antworten werden bis einschliesslich Deadline plus 2 Sekunden
  akzeptiert. Wenn alle teilnehmenden Spieler final abgegeben haben, erscheint
  beim Host sofort `Aufloesen`; andernfalls erst nach Ende dieser Nachfrist.
  Die Host-Aktion startet die Auswertung.

#### F4 Quiz

**Als Spieler** moechte ich Fragen gleichzeitig und unabhaengig beantworten;
**als Host** moechte ich die Auswertung und den Quizfortschritt steuern.

- Ein Quiz enthaelt beliebig viele Fragen; jede Frage hat einen Fragetext,
  genau vier Antwortoptionen und genau eine richtige Antwort.
- Alle Spieler sehen dieselbe Frage mit allen vier waehlbaren Antwortoptionen
  gleichzeitig. Pro Frage gelten
  30 Sekunden. Die Antwort ist bis zur finalen Abgabe aenderbar; die letzte
  gueltige Antwort zaehlt. Eine richtige Antwort gibt einen Punkt.
- Projektor zeigt Frage und nach Aufloesung die richtige Antwort; Host sieht
  Frage und Antwortoptionen und nach Aufloesung die richtige Antwort;
  Spieler sehen nach Aufloesung ihre eigene und die richtige Antwort
  markiert.
- Nach jeder Frage folgt eine eigene Auswertung. Danach startet der Host die
  naechste Frage in der Reihenfolge der Seed-Datei. Die allgemeine
  Spieluebersicht erscheint erst nach der letzten Frage des Quiz.

### P1 – Ranking und weitere Spielarten

#### F2 Uebersicht und Ranking

**Als Host** moechte ich verfuegbare Spiele auswaehlen; **als Spieler und
Projektor** moechte ich den aktuellen Punktestand sehen.

- Der Host sieht verfuegbare und gespielte Katalogspiele, kann ein
  verfuegbares Spiel auswaehlen oder abwaehlen und sieht bei Auswahl Regeln
  sowie `Starten`.
- Der Projektor zeigt ungespielte Spiele links, gespielte rechts und das
  Ranking zentral. Nach mindestens einem abgeschlossenen Spiel enthaelt die
  Tabelle Platzierung, Gesamtpunkte, Spielername und je eine Spalte pro
  abgeschlossenem Spiel mit dessen Punkten. Ungespielte Spiele haben keine
  Ergebnisspalte. Vor dem ersten abgeschlossenen Spiel erscheinen nur die
  Spielernamen.
- Spieler sehen oben stets eigenen Namen, Punkte und Platzierung; Punkte
  erscheinen nach der ersten Runde.
- Nach einem abgeschlossenen Spiel animiert der Projektor vom bisherigen
  Ranking ueber das Hinzufuegen des Spiels und Hochzaehlen der Punkte bis
  zur neuen Reihenfolge.

#### F5 Sortieren

**Als Spieler** moechte ich Begriffe in die richtige Reihenfolge bringen;
**als Host/Projektor** moechte ich die Aufloesung und Fehler sehen.

- Ein Spiel enthaelt Fragetext und Begriffe mit Ordnungswerten. Werte werden
  waehrend der Eingabe nicht angezeigt.
- Spieler erhalten die Begriffe in zufaelliger Reihenfolge und koennen sie
  per Drag-and-Drop sortieren. Die Eingabezeit betraegt 60 Sekunden; eine
  korrekte Position gibt einen Punkt.
- Projektor und Host sehen waehrend der Spielphase die Frage. In der
  Auswertung zeigt der Projektor die korrekte Reihenfolge samt Werten und
  Fehlerzahl je Spieler. Spieler sehen ihre Reihenfolge mit richtiger und
  falscher Position farblich markiert.
- Der Host kann die Auswertung mit `Beenden` schliessen und alle zur
  Uebersicht zurueckfuehren.

#### F6 Schaetzen

**Als Spieler** moechte ich einen Zahlenwert schaetzen; **als Host/Projektor**
moechte ich Punkte und Abstaende auswerten.

- Ein Spiel enthaelt Fragetext und einen numerischen Zielwert. Spieler geben
  innerhalb von 30 Sekunden eine Zahl ein; die letzte gueltige Eingabe zaehlt.
- Fuer die Punkteverteilung zaehlen nur Spieler mit gueltiger abgegebener
  Zahl. Diese werden nach absolutem Abstand zum Zielwert sortiert. Rangplaetze
  bis einschliesslich `ceil(N/3)` erhalten 3 Punkte; Rangplaetze groesser als
  `ceil(2N/3)` erhalten 0 Punkte; die uebrigen erhalten 1 Punkt, wobei `N`
  die Anzahl gueltiger Eingaben ist. Bei Gleichstand an einer Grenze erhalten
  alle Gleichplatzierten die bessere Stufe. Alle gleich besten Schaetzungen
  erhalten zusaetzlich je 2 Punkte; maximal sind 5 Punkte moeglich. Spieler
  ohne gueltige Eingabe erhalten 0 Punkte und gehen nicht in die Einteilung
  ein. Bei `N = 0` gibt es keine Ranggruppen und alle erhalten 0 Punkte.
- Host und Projektor sehen waehrend der Eingabe die Frage. In der Auswertung
  zeigt der Projektor Spieler nach Platzierung mit Abstand zum Zielwert;
  Spieler sehen eigene Eingabe und Abstand.
- Der Host kann mit `Weiter` zur Uebersicht zurueckkehren.

### P2 – Wiederbeitritt und Darstellung

#### F8 Reconnect

**Als Spieler** moechte ich nach einem Verbindungsverlust durch Refresh oder
erneutes Oeffnen meines Links weiterspielen.

- Ein bereits beigetretener Spieler kann seine Sitzung und Rolle wiederherstellen.
- Die Wiederherstellung liefert die aktuelle Lobby-/Spielphase und den
  eigenen gespeicherten Eingabestand, ohne eine zweite Teilnahme anzulegen.
- Sitzungswiederherstellung gilt nur solange der Serverprozess und die
  Lobby laufen; nach Neustart ist die Lobby gemaess MVP-Regel beendet.

#### F9 Darstellung

**Als Spieler/Host** moechte ich die Ansichten auf dem Smartphone nutzen;
**als Projektor** moechte ich eine aus der Entfernung lesbare Desktopansicht.

- Spieler- und Hostansichten sind Mobile First; die Projektoransicht ist
  fuer Desktop ausgelegt.
- Das zentrale Theme verwendet Tuerkis `#48A3AE`, Rot `#FE0000`, Grau
  `#706A6A` und Hintergrund `#1D1D1B`.
- Antwortmarkierungen verwenden neutral Grau, richtig Tuerkis und falsch Rot.

## Geklaerte Rueckfragen

- **O1 Schaetzen-Zeitlimit:** 30 Sekunden; widerspruechliche 60-Sekunden-
  Kurzform in `Prinzgame.md` ist damit ueberholt.
- **O2 Spielinhalte:** Seed-Dateien mit Beispielsets werden beim Serverstart
  geladen; kein Inhaltseditor im MVP.
- **O3 Host zaehlt nicht** als Spieler.
- **O4 Spielerzahl:** unbegrenzt; Start ab mindestens zwei Spielern.
- **O5 Katalog:** alle vorhandenen Spiele sind jeder Lobby verfuegbar.
- **O6 Persistenz:** nur Spielinhalte/Katalog; Lobby und Resultate nicht ueber
  Neustart hinweg.
- **O7 Quizfortschritt:** Fragen werden in Seed-Reihenfolge einzeln
  ausgewertet; der Host startet die naechste Frage, die Uebersicht folgt erst
  nach der letzten Frage.
- **O8 Schaetzpunkte:** Ranggrenzen per aufgerundeten Dritteln; Gleichstaende
  an einer Grenze erhalten die bessere Stufe; alle Bestplatzierten erhalten
  den Bonus; fehlende Eingaben zaehlen 0 und werden nicht einsortiert.
- **O9 Spaeter Beitritt:** neue Spieler warten bis zur naechsten
  Spielauswahl; bestehende Spieler koennen sofort reconnecten.
- **O10 Host-Zugriff:** ein eigener Host-Link mit nicht erratbarem Geheimnis
  gewaehrt Moderationsrechte. Ein Refresh im selben Browser stellt den Zugriff
  wieder her, solange Lobby und Serverprozess laufen; Accounts/Login sind
  ausgeschlossen.

## Stackannahmen

Es wird ausschliesslich der freigegebene Stack aus `docs/tech-stack.md`
vorausgesetzt: Server Node.js >=24/TypeScript/ESM mit Fastify, `ws`,
PostgreSQL via `pg` und SQL-Migrationen; Web React/Vite/TypeScript mit
`react-router` und nativem WebSocket; `contracts/` TypeScript-Typen und
`zod`-Schemas. Tests, Lint und Statikanalyse folgen den dort freigegebenen
Werkzeugen. Diese Anforderungen schlagen keine Stackabweichung vor.

## Planungsnotizen

- Die Schaetzregeln sind festgelegt. Gleich weit entfernte Schaetzungen koennen
  in der Anzeige denselben Rang erhalten; die Architektur kann die genaue
  Rangdarstellung festlegen.
- Beim Sortieren werden Punkte pro korrekt positioniertem Begriff vergeben.
  Seed-Inhalte verwenden eine eindeutige Sollreihenfolge. Gleichwertige
  Ordnungswerte gehoeren nicht zum bestaetigten MVP-Inhaltsmodell.
