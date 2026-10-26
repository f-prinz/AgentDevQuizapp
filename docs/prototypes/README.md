# Prototypen

Layout-Prototypen fuer Features: **self-contained HTML-Dateien** (`<name>.html`,
CSS/JS inline, kein Build) plus optional ein Screenshot (`<name>.png`).
Eine Datei pro Prototyp, committet, in Anfragen per Pfad referenziert.

## Herkunft

- selbst gebaut oder KI-generiert (z. B. Claude Artifact, v0-Export als HTML)
- Skizze: Foto/Excalidraw-Export als PNG — fuer Struktur, nicht fuer Styles
- vom Framework selbst: TECH-Task `--scope docs/prototypes/` baut den Prototyp,
  Nutzer prueft ihn im Browser, bevor echte Implementierung startet

## Konventionen

- CSS Custom Properties im Prototyp definieren — sie werden zum Ausgangspunkt
  des zentralen Theme-Files der UI-Komponente.
- Kommentar im `<head>`: was ist Platzhalter, was ist verbindlich
  (Layout, Farben, Reihenfolge) vs. nur Fuellmasse (Texte, Bilder, Daten).
- Prototypen sind Layout-Referenz, keine Produktspezifikation — Verhalten und
  Akzeptanzkriterien kommen aus dem Requirements-Dokument.
