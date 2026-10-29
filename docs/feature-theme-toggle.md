# Feature: Light/Dark-Theme-Toggle (Fast Path)

## User Story
Als Nutzer (Host, Spieler, Projektor-Betreiber, Admin) moechte ich jederzeit
zwischen hellem und dunklem Farbschema umschalten, um die Ansicht an
Lichtverhaeltnisse anzupassen.

## Akzeptanzkriterien
- Sonne/Mond-Icon-Button oben rechts, auf jeder Ansicht sichtbar (App-Shell,
  also inkl. Startseite, Join, Player, Host, Projektor, Admin).
- Klick wechselt zwischen Dark und Light; das aktive Theme ist sofort in der
  kompletten UI wirksam (alle Farben ueber CSS-Variablen).
- Die Wahl wird pro Browser persistiert (localStorage) und ueberlebt Reload.
- Initial ohne gespeicherte Wahl: `prefers-color-scheme`, sonst Dark
  (bisheriges Design bleibt Default).
- Icon zeigt den Zielzustand (Mond -> wechselt zu Light, Sonne -> zu Dark)
  mit sprechendem aria-label.

## Geklaerte Rueckfragen
Kein Rueckfragebedarf:
- Default = Dark (Status quo; bisheriges Design).
- Persistenz = localStorage pro Browser (kein Server-State noetig).
- Position fixed top-right auf Shell-Ebene = alle Ansichten.
- Light-Palette wird aus der Slate-Palette abgeleitet, Indigo-Akzent bleibt.

## Stack-Entscheidungsnotiz
KEEP — reines CSS-Variablen-Theming (data-theme auf :root) + lucide-react
Icons (bereits freigegebene Dependency, CHG-13). Keine Contract-, Endpunkt-
oder Datenmodellaenderung.

## Task
FEAT-17 (web): Theme-Toggle + Light-Palette.
