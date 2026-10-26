# RaccoonsQuizgame MVP – Architektur

Stand: 2026-10-26. Vorschlag zur Annahme durch den Orchestrator; Grundlage:
`project-idea.md`, `feature-mvp-requirements.md`, `tech-stack.md` und
`agent-context.md`. O1–O10 sind Nutzerentscheidungen. Keine Implementierung,
Installation oder Stackaenderung ist Teil dieses Dokuments.

## Stackbewertung

| Bereich | Bewertung und Begruendung | Klassifizierung |
| --- | --- | --- |
| server | **KEEP**: Node >=24, TypeScript/ESM, Fastify, ws, pg/SQL und PostgreSQL passen zu HTTP-Setup, Echtzeit und kleinem persistentem Katalog. | Scaffolding TARGET_ALIGNED; danach CURRENT_STACK_ONLY |
| web | **KEEP**: React/Vite/TypeScript, react-router, nativer WebSocket und CSS reichen fuer die drei Rollen. | Scaffolding TARGET_ALIGNED; danach CURRENT_STACK_ONLY |
| contracts | **KEEP**: gemeinsame TypeScript-/zod-Schemas vermeiden unterschiedliche Client-/Serverinterpretationen. | Initial TARGET_ALIGNED; jede Aenderung eigener TECH-CONTRACT_CHANGE |

Es wird keine Stackabweichung empfohlen; REQUIRES_MIGRATION ist fuer das
Greenfield nicht erforderlich. Lockdateien pro Komponente halten die freigegebenen
Dependencies reproduzierbar. Installation und konkrete Dependency-Aenderungen
bleiben an die Freigaberegeln gebunden.

Alternative innerhalb des Stacks: statt vollstaendiger Snapshots nur einzelne
Zustandsdeltas senden. Das spart bei grossen Lobbys Bandbreite, erfordert jedoch
Delta-Reihenfolge, Wiederholung und separaten Reconnect-Aufbau. Fuer das lokale
MVP werden rollenbezogene Snapshots empfohlen: einfacher zu testen und nach
Refresh konsistent. WebSocket-Zustaende und Netzlast bleiben in Integrationstests
zu pruefen; „unbegrenzt“ bedeutet kein fachliches Teilnehmerlimit, keine Zusage
unendlicher Hardwarekapazitaet.

## Komponenten und Grenzen

- `apps/server/`: HTTP-/WS-Adapter, Authentifizierung, In-memory-Lobbyverwaltung,
  reine Spiel-/Wertungslogik, Katalogrepository, SQL-Migrationen und Seed-Dateien.
- `apps/web/`: React-Routen, Verbindungs-/Sessionverwaltung, rollenbezogene
  Darstellung, Timeranzeige und zentrales CSS-Theme. Keine Wertungsautoritaet.
- `contracts/`: versionierte REST-/WS-Datenformen und zod-Schemas;
  `lobby.schema.ts`, `game.schema.ts`, `timer.schema.ts` sowie README.
  Keine Serverobjekte oder Serverdateien werden vom Web importiert.

Die Server-Domaene erhaelt Uhr, Zufallsquelle und Katalog als injizierbare
Abhaengigkeiten. Unit-Tests pruefen Phasen und Wertung ohne echte Wartezeiten
oder Datenbank; Adaptertests pruefen tatsaechliches HTTP/WS und separat PostgreSQL.
Ein Fehler der Datenbank darf nicht durch eine zweite, unbeabsichtigte
Datei-/Speicherpersistenz ersetzt werden.

## Persistentes Inhaltsmodell

PostgreSQL speichert ausschliesslich Kataloginhalte. Vorschlag fuer ein kleines,
validiertes Modell: `games(id TEXT PRIMARY KEY, kind TEXT, title TEXT,
rules TEXT, schema_version INTEGER, content JSONB)` und
`schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ)`.
`kind` hat eine SQL-Constraint fuer `quiz`, `sorting`, `estimation`; zod
validiert den typabhaengigen JSON-Inhalt vor jedem Schreibvorgang und beim Laden.

| Spielart | Inhalt |
| --- | --- |
| quiz | Nichtleere Fragenliste in Seed-Reihenfolge; je Frage stabile ID, Text, genau vier Optionen mit IDs und genau eine korrekte Options-ID |
| sorting | Fragetext und Begriffe mit stabilen IDs, Text und endlichem numerischem Wert; Werte eindeutig, Sollreihenfolge aufsteigend |
| estimation | Fragetext und endlicher numerischer Zielwert |

Seed-Dateien liegen im Serververzeichnis. Beim Start werden alle Seeds zuerst
validiert, Migrationen versionsweise und Seeds in einer Transaktion angewandt.
Stabile IDs erlauben idempotentes Upsert; erneuter Start erzeugt keine Duplikate.
Seed-Laden loescht keine fremden Katalogeintraege. Ein ungueltiger Seed oder eine
fehlgeschlagene Migration stoppt den Start mit einer bereinigten Fehlermeldung.
Danach wird der gesamte Katalog fuer die Prozesslaufzeit gelesen; jede Lobby
erhaelt dieselbe Inhaltsversion. Es gibt keinen Laufzeit-Editor.

Alternative: normalisierte Tabellen je Frage/Option/Begriff. Diese bieten mehr
SQL-Constraints und Inhaltsabfragen, erzeugen aber fuer den ausschliesslich aus
Seeds geladenen Katalog mehr Migrationen und Join-Logik. JSONB mit zwingender
Schema-Validierung bleibt PostgreSQL/pg und fuehrt keinen neuen Ansatz ein.

## Fluechtiges Sitzungsmodell

Eine Prozess-Map fuehrt Lobby-ID, Host-Token-Hash, monotone Zustandsrevision,
Phase, Teilnehmer, ausgewaehltes Spiel, laufendes Spiel und abgeschlossene
Ergebnisse. Teilnehmer besitzen stabile ID, fortlaufende Anzeigenummer, Namen,
Token-Hash, Beitrittszeit und Verbindungsstatus. Namen werden getrimmt; leere
Namen werden als `Spieler N` angezeigt. Die maximale Laenge wird am Server und
im Formular geprueft. Gleiche Namen unterscheiden sich durch Teilnehmer-ID.

Zum Start eines Spiels wird die Teilnehmermenge eingefroren. Neue Teilnehmer
werden bis zur naechsten Spielauswahl als wartend markiert. Ein Disconnect
entfernt keine Spielteilnahme und keinen Eingabestand; er beendet auch keine
Runde. Der Zeitablauf verhindert, dass eine getrennte Verbindung dauerhaft
blockiert. Der Host bleibt ausserhalb aller Teilnehmer-/Wertungslisten.

Ein laufendes Spiel enthaelt Spiel-ID, Teilnehmer-IDs, Quizfragenindex,
Runden-ID, Deadline, letzte gueltige Antwort und Finalstatus je Spieler sowie
bereits ausgewertete Fragen. Bei Sortieren wird die zufaellige Anfangsreihenfolge
je Spieler einmal erzeugt und als Eingabestand gespeichert, damit Refresh sie
nicht neu mischt. Quiz-/Schaetzantworten beginnen ohne Eingabe.

Abgeschlossene Ergebnisse enthalten Punkte je Teilnehmer und Spiel, die alte
und neue Rankingansicht sowie eine eindeutige Ergebnis-ID. Wiederholte
Hostbefehle duerfen kein Ergebnis doppelt verbuchen. Es gibt keine
Lobby-/Ergebnis-SQL-Tabellen. Serverneustart beendet alle Sitzungen.

## Zustandsautomat und Zeit

| Phase | Erlaubte Hostaktion | Ergebnis |
| --- | --- | --- |
| lobby | Lobby starten, mindestens zwei beigetretene Spieler | overview |
| overview | verfuegbares Spiel aus-/abwaehlen; Auswahl starten, mindestens zwei Spieler | start, Teilnehmermenge einfrieren |
| start | Spielphase starten | playing mit neuer Runden-ID und Deadline |
| playing | Aufloesen erst nach Eingabeschluss | evaluation |
| evaluation, Quiz mit Folgefrage | naechste Frage starten | playing mit neuer Deadline |
| evaluation, letzte Quizfrage oder andere Spielart | Beenden/Weiter | overview, Ergebnis einmal verbuchen |

Quiz und Schaetzen laufen 30 Sekunden, Sortieren 60 Sekunden. Der Server
speichert `deadline = startedAt + duration` und `acceptUntil = deadline + 2000`.
Eine Antwort wird angenommen, wenn die passende Runden-ID aktiv, der Spieler
teilnehmend, seine Antwort nicht final und die serverseitige Empfangszeit
`<= acceptUntil` ist. Client-Zeitstempel verlaengern keine Frist.

Ein gueltiges `Abgeben` finalisiert die mitgesendete vollstaendige Antwort
atomar. Haben alle eingefrorenen Teilnehmer final abgegeben, schliesst die
Eingabe sofort; andernfalls nach `acceptUntil`. `Aufloesen` wird entsprechend
freigegeben, aber niemals automatisch ausgefuehrt. Beim Schliessen verbleibt
die letzte gueltige Antwort; fehlende Quiz-/Schaetzantworten zaehlen null.
Die unveraenderte Sortier-Anfangsreihenfolge ist bereits ein gueltiger Stand.

Da die Grenze inklusive gilt, darf ein Timerhandler die Eingabe nicht bereits
bei exakt `acceptUntil` als verstrichen behandeln. Jeder Befehl prueft die Uhr
erneut; verzogene Scheduler-Ticks aendern keine Annahmeregel. Timerhandler
pruefen ihre Runden-ID und koennen keine spaetere Runde schliessen.

Der Snapshot liefert `serverTime`, `deadline`, `acceptUntil` und
`inputClosed`/`canReveal`. Clients schaetzen den Serverzeitversatz aus
Zeitabgleichen; sie zeigen ab Deadline null und einen Wartezustand. Die
Nachfrist ist Latenzausgleich, kein zusaetzlicher sichtbarer Spieltimer.
Die serverseitige Pruefung entscheidet auch bei veraenderter Client-Uhr.

## Wertung und Ranking

- Quiz: pro richtiger Antwort ein Punkt; je Frage genau eine Auswertung.
  Erst nach der letzten Frage wird das Quiz als gespieltes Spiel verbucht.
- Sortieren: Antwort ist eine Permutation aller Begriff-IDs, jede exakt
  einmal. Je korrekter Position ein Punkt. Fehlerzahl = Begriffzahl minus Punkte.
- Schaetzen: nur endliche Zahlen; leere/ungueltige Eingaben werden nicht in die
  Ranggruppen aufgenommen. Abstand ist absolut. Ein Gleichstand hat den Rang
  `1 + Anzahl Spieler mit strikt kleinerem Abstand`. Mit diesem Rang gelten
  die bestaetigten Grenzen `ceil(N/3)` und `ceil(2N/3)`, plus zwei fuer Rang 1.
  Dadurch erhaelt eine Grenzgruppe geschlossen die bessere Stufe. N=0 ergibt
  keine Ranggruppen und null Punkte fuer alle.

Das Gesamtranking summiert abgeschlossene Spiele. Gleich viele Gesamtpunkte
ergeben denselben Wettbewerbsrang (1, 1, 3); Anzeigenreihenfolge innerhalb
eines Gleichstands folgt der Beitrittsnummer und aendert keine Punkte.
Vor dem ersten abgeschlossenen Spiel zeigt der Projektor nur Namen.
Fragepunkte eines laufenden Quiz sind Teil der jeweiligen Auswertung; die
Spalte und Gesamtwertung des Quiz erscheinen mit dessen Abschluss.
Die Ergebnis-ID erlaubt dem Projektor, die Animation einmal in der Reihenfolge
altes Ranking → neue Spielspalte → Punktestand → Reihenfolge auszufuehren.
Reconnect zeigt den aktuellen Stand, ohne vergangene Animationen nachzuspielen.

## REST, WebSocket und Rollenprojektion

REST-Operationen: Health, Lobby erzeugen, Spieler beitreten und
Projektor-/Sitzungsverbindung vorbereiten. Die genaue Form wird im eigenen
CONTRACT_CHANGE-Task festgelegt. Kein oeffentlicher Katalogendpunkt liefert
Loesungen oder gespeicherte Antwortwerte.

WS beginnt mit einer validierten Authentifizierungsnachricht. Weitere Befehle
tragen Protokollversion, Request-ID und bei Rundenaktionen Runden-ID. Der Server
antwortet mit Bestaetigung/strukturiertem Fehler und anschliessend aktuellem
rollenbezogenem Snapshot mit monotoner Revision. Ungueltiges JSON, unbekannte
Events, falsche Rollen und veraltete Runden werden ohne Zustandsaenderung
abgewiesen. Clients akzeptieren keine aelteren Snapshotrevisionen.

| Rolle | Erhaelt vor Aufloesung | Darf veraendern |
| --- | --- | --- |
| Host | Teilnehmerliste, Spielauswahl, Frage/Quizoptionen, Timer und Freigabestatus | Spielauswahl und Phasen |
| Spieler | eigene ID/Antwort/Finalstatus, Teilnehmerliste, passende Spielaufgabe und Timer | eigener Name und eigene Antwort als aktiver Teilnehmer |
| Projektor | oeffentliche Aufgabe, Regeln, Timer und abgeschlossenes Ranking | nichts |

Alle Payloads werden ueber explizite Projektionen gebaut, niemals durch
Serialisierung des gesamten Lobby-/Katalogobjekts. Korrekte Quizoption,
Sortierwerte/-Sollreihenfolge und Schaetzziel verlassen den Server erst in der
Auswertung. Fremde private Antworten oder Tokens werden nicht mitgesendet.
Zur Auswertung werden nur die rollenspezifisch benoetigten Angaben ergaenzt:
eigene Antwort fuer Spieler, richtige Loesung und vorgeschriebene
Fehler-/Abstandstabellen fuer Projektor/Host.

## Token und lokaler Betrieb

Lobby-IDs und Sitzungstokens werden kryptographisch zufaellig erzeugt, Tokens
mit mindestens 256 Bit Entropie; Rollen werden serverseitig gebunden. Der
Host-Link uebergibt das Geheimnis im URL-Fragment, das Web uebernimmt es in
localStorage unter Lobby und Rolle. Das Fragment wird anschliessend mit
`history.replaceState` entfernt. HTTP-/WS-URLs enthalten keine Tokens.
Spielertokens werden beim ersten Beitritt ausgegeben und ebenfalls lokal
gespeichert; der allgemeine Spielerlink allein stellt keinen fremden Spieler
wieder her. Reconnect gilt fuer denselben Browser mit erhaltenem Speicher.

Serverseitig werden nur Token-Hashes verglichen. Logs, Fehlermeldungen,
Snapshots, Testartefakte und Inventare enthalten keine echten Tokens oder
Verbindungsstrings. Der Projektor-Link erteilt ausschliesslich Leserechte.
Mehrfachverbindungen derselben Session nutzen dieselbe Teilnehmer-ID; der
Server verarbeitet Befehle seriell und finalisiert jede Runde hoechstens einmal.

Standardbetrieb bindet lokal. Fuer echte Smartphones ist eine ausdruecklich
konfigurierte LAN-Adresse samt passender Web-/WS-Origin erforderlich; das ist
lokaler Betrieb und kein Deployment. Origins werden gegen die konfigurierten
Web-Origins geprueft, Fastify-CORS wird ebenso eng konfiguriert. Kein externer
Dienst und kein CDN sind erforderlich. PostgreSQL und DATABASE_URL muessen
lokal verfuegbar sein; `.env` bleibt ignoriert, nur Platzhalter in `.env.example`.
Der Server meldet Bereitschaft erst nach Migration, Seed und Katalogladen.

## Pruefstrategie und offene Punkte

Vor Umsetzung: Orchestrator nimmt diesen Vorschlag an und legt die exakten
Vertraege in einem separaten TECH-Task fest. Es gibt keine empfohlene
Stackabweichung und keine zusaetzliche kritische Produktfrage.

Erforderliche Nachweise: Unit-Tests fuer Phasen/Wertung, Grenzzeiten,
Gleichstaende, Wiederholung und Spaetbeitritt; Integrationstests fuer echte
REST-/WS-Rollenrechte und Snapshotfilterung; PostgreSQL-Integration fuer
Migration/Seed-Idempotenz; React-Tests fuer Rollenansichten und Interaktion;
Browserpruefung mit Host, zwei Spielern und Projektor fuer alle drei Spielarten,
Timer, Touch-Sortieren und Reconnect. Tests/Lint laufen ueber record-check.
Dieses Architekturartefakt selbst behauptet keine bestandenen Laufzeittests.
