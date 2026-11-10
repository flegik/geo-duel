# Offizielles GeoDuel-Logo · 10.11.2026

App-Version 0.3.2, Sites-Version 7, unveränderte URL: https://geoduel-flegik.flegik.chatgpt.site/ . Branding-Commit: 8c4ac0518cda3110a5f311d4a47417a9687e38f6.

Quelle ist ausschließlich das vom Nutzer bereitgestellte quadratische PNG (1254 × 1254). Keine KI-Generierung, keine Retusche, keine neue Zeichnung, kein Zuschnitt und keine Verzerrung. Ableitungen verwenden Lanczos-Skalierung und verlustfrei gespeicherte PNGs. Für das maskierbare Icon wird das vollständige Bild auf 400 × 400 innerhalb einer 512 × 512 großen Midnight-Atlas-Fläche zentriert; der sichtbare Globus liegt in der sicheren Kreisfläche. Das Bilddesign und der vorhandene GeoDuel-Schriftzug bleiben erhalten.

## Dateien

| Datei in public/ | Abmessungen |
| --- | --- |
| brand/geoduel-logo.png | 512 × 512 |
| icon-192.png | 192 × 192 |
| icon-512.png | 512 × 512 |
| icon-maskable.png | 512 × 512 |
| apple-touch-icon.png | 180 × 180 |
| favicon.png | 48 × 48 |
| favicon.ico | 16, 32, 48 und 64 px |
| icon.svg | Legacy-URL: SVG-Container mit eingebettetem neuen PNG |

React verwendet das neue Bild im Kopfbereich, auf dem Startbildschirm und im Footer. Die frühere gezeichnete Hero-Kugel wurde ersetzt. Funktionssymbole (z. B. Kategorien, Navigation) sind keine Markenlogos und bleiben erhalten. Manifest, HTML-Favicons, Apple-Touch-Icon und Workbox-Precache wurden aktualisiert. Versionierte Asset-Referenzen und das vorhandene benutzerbestätigte PWA-Update vermeiden die Wiederverwendung alter Icons nach dem App-Update. Das Betriebssystem kann zusätzlich einen eigenen Icon-Cache besitzen.

## Prüfungen

- Sämtliche Rasterdateien mit Pillow geöffnet und Abmessungen geprüft; quadratische und unverzerrte Darstellung.
- npm test: 29 bestanden.
- npm run build: erfolgreich, nur bestehende Bundlegrößenwarnung.
- Öffentliche Website in Chrome geprüft: alle drei Markenbilder vollständig geladen, korrekt quadratisch mit 44/340/20 px dargestellt; Screenshot visuell mit dem gelieferten Original verglichen.
- Mobile CSS passt das Headerbild auf 38 px und den Startglobus auf höchstens 70vw/280 px an. Eine zusätzliche mobile Browseransicht konnte wegen nicht verfügbarer nativer UI-Steuerung nicht ausgeführt werden; keine physische iOS-/Android-Prüfung behauptet.

## Bereits installierte PWAs

Zuerst regulär das vorhandene Update-Banner verwenden und die App neu öffnen. Android/Browser können Manifest-Icons zeitversetzt übernehmen. iPhone/iPad können das beim Hinzufügen gespeicherte Apple-Touch-Icon behalten; gegebenenfalls wird ein neues Symbol erst beim erneuten Hinzufügen zum Home-Bildschirm übernommen. Diese Übernahme ist betriebssystemabhängig und wurde nicht auf physischen Geräten geprüft.

Keine Websitedaten, Browserdaten, Gastprofile oder lokalen Spielstände löschen. Eine Neuinstallation wurde weder durchgeführt noch ist sie für die Funktion der aktualisierten Anwendung nötig. Vor dem Entfernen einer installierten App die Wiederherstellbarkeit des Gastprofils und der lokalen Daten beachten; ein altes Home-Symbol kann bis dahin weiterverwendet werden.

Keine Änderungen an Gameplay, Fragenpool, Supabase oder Datenformaten. Keine APK erstellt.
