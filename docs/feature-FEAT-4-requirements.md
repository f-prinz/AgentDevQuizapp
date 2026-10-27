# FEAT-4: Spielphasen-Ansichten und Timer

## User Story

Als Host, Spieler oder Projektor moechte ich die zur aktuellen Spielphase und
meiner Rolle passende Ansicht sehen, damit die Spielrunde gemeinsam und mit
synchronisiertem Zeitlimit ablaufen und ausgewertet werden kann.

## Akzeptanzkriterien

1. **Startphase:** Nach Auswahl eines Spiels sehen Spieler dessen Titel und
   eine Startanimation; der Projektor sieht Titel und Regeln. Der Host sieht
   Titel und eine Aktion zum Start der Spielphase.
2. **Spielphase und Timer:** Die Ansichten spiegeln die vom Server gemeldete
   Phase wider. Spieler sehen den Timer klein, der Projektor gross; beide
   richten die Anzeige an der vom Server gelieferten Deadline aus.
3. **Finale Abgabe:** Ein Spieler kann waehrend der Spielphase die vollstaendige
   aktuelle Eingabe abgeben. Nach erfolgreicher Abgabe ist seine Eingabe
   gesperrt und wird als final angezeigt. Wenn alle teilnehmenden Spieler final
   abgegeben haben, wird der Spielphasenabschluss aus dem Serverzustand
   angezeigt.
4. **Aufloesen:** Der Host kann die Auswertung erst starten, wenn der Server
   den Eingabeschluss meldet, einschliesslich des Fruehschlusses nach Abgabe
   aller Spieler. Vorher ist die Aktion nicht verfuegbar.
5. **Auswertung und Rueckkehr:** Die Ansichten zeigen die vom Server gemeldete
   Auswertungsphase. Der Host kann danach mit der vorgesehenen Aktion
   „Beenden/Weiter“ zur Uebersicht zurueckkehren.
6. **Spaetbeitritt:** Ein Spieler, der nach Beginn der laufenden Runde
   beitritt, erscheint sichtbar als wartend und kann in dieser Runde keine
   Eingabe abgeben.
7. **Reconnect:** Nach Refresh oder erneutem Oeffnen des Links zeigen die
   Ansichten die aktuelle Serverphase, den eigenen gespeicherten Draft und
   Finalstatus sowie dieselbe Deadline; es wird keine neue Runde oder Deadline
   gestartet.

## Stack-Klassifikation

`CURRENT_STACK_ONLY` — Umsetzung in `apps/web/` mit dem freigegebenen React-
19-, Vite-8-, TypeScript- und react-router-Stack. Kommunikation erfolgt ueber
die bestehenden REST-/WebSocket-Contracts. Eine Contract-Aenderung ist nicht
Teil dieses Features; falls sie erforderlich wird, benoetigt sie einen eigenen
TECH-Task.

## Geklaerte Rueckfragen

- Der Nutzer hat manuelle Browser-/Oberflaechentests sowie den `ui_step`-Anker
  fuer FEAT-4 ausdruecklich erlassen. Automatisierte Tests, Lint, Build und
  unabhaengige Reviews bleiben erforderlich.

## Referenzen

- `docs/project-idea.md`: F3 Spielphasen und F7 Echtzeit-/Timer-Regeln.
- `docs/feature-mvp-requirements.md`: bestaetigte MVP-Anforderungen.
- `tasks/state.json`: Task FEAT-4 und Abhaengigkeiten FEAT-2, FEAT-3, FEAT-15.
