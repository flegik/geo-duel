# Weltatlas · 10.11.2026

Neue App-Version 0.4.1. Bestehende Website: https://geoduel-flegik.flegik.chatgpt.site/ . Implementierungsstand: 098ec34b3f352fdded0dc2e3ab35ccd106b30e9f.

## Umfang

Dritter Startbereich Weltatlas, vollständig getrennt von Fragen, Antworten, Punkten und Statistik. Vier Bereiche: Flaggen, Länderumrisse, Karten und Länderwissen. Suche nach deutschem Namen oder ISO-Code, alphabetische und zufällige Reihenfolge, zyklische Vor-/Zurücknavigation, Touch-Swipe mit vertikaler Scroll-Erkennung, Kontinentfilter, lokale Favoriten und eigene Favoritenansicht. Favoriten verwenden ausschließlich `geoduel-atlas-favorites-v1`; Schreibfehler werden angezeigt, beschädigte Daten sicher abgefangen.

Abdeckung: **195 Flaggen, 195 Umrisse, 195 Kartenansichten, 195 Kontinentzuordnungen**. Vorhandene 30 Karten und 30 Umrisse werden weiterverwendet; fehlende 165 Darstellungen je Bereich werden als lokale SVGs aus Natural-Earth-Geometrien gerendert. Für kleine Staaten erlaubt die neue Weltkarte zusätzlich einen vergrößerten Umriss. Es werden keine Länderflächen künstlich aufgeblasen.

Hauptstädte, bestätigte Nachbarbeziehungen und Sehenswürdigkeiten stammen ausschließlich aus vorhandenen Fragen. Diese Faktenabdeckung ist teilweise; fehlende Angaben werden ausdrücklich gekennzeichnet. Nachbarlisten heißen Auswahl und behaupten keine Vollständigkeit. Kontinente stammen aus dem Geodatensatz; dessen Seven-seas-Ausnahmen verwenden REGION_UN. Keine ungesicherten zusätzlichen Fakten.

## Daten und Reproduzierbarkeit

Natural Earth Admin 0 Countries 1:10m, Public Domain. Herkunft, Original-SHA-256, Projektion und Zuordnungsregeln: `data/atlas/SOURCES.md`. Reproduzierbarer Generator: `scripts/build-atlas-geography.py` mit GDAL. Zuordnung über ISO_A2_EH; Dependencies/Lease-Einträge werden für Hauptumrisse ausgeschlossen, damit etwa Frankreich nicht mit Clipperton verwechselt wird. Binnenringe bleiben per evenodd erhalten. Weltkarte equirektangular, Länderumrisse mit minimaler Längengradspanne am Datumswechsel und Breitenkorrektur. Koordinaten der Umrisse werden vor dem Runden auf eine lokale 1000er-Fläche normalisiert, um Mikrostaaten unverzerrt zu erhalten.

Die Geometrien sind vereinfacht und für geografisches Lernen gedacht, keine rechtlich verbindlichen Grenzkarten. Daten werden lokal gebündelt und über den vorhandenen Service Worker vorgehalten. Atlas wird separat nachgeladen, damit Quiz und Startansicht nicht den Atlas-Code ausführen müssen. Es bleiben Bundlegrößenwarnungen; der Produktionsbuild ist erfolgreich.

## Tatsächliche Prüfungen

- 34 Tests und Produktionsbuild bestanden. Prüfungen decken 195 eindeutige Länder/Flaggenpfade, vorhandene Geometrien und Kontinente, Suchnormalisierung und ISO-Suche, Favoriten-Wiederherstellung, beschädigte/gesperrte Speicherung, Zufallsreihenfolge ohne Duplikate und die Mikrostaaten-Präzision ab. Bestehende Quiztests bestehen.
- Live Chrome: Atlas über dritten Startbereich geöffnet; Deutschland gesucht; Flagge, vorhandenen Umriss, vorhandene Karte sowie Hauptstadt Berlin und gekennzeichnete Nachbarauswahl angezeigt. Neue Weltkartendarstellungen für Palau und Papua-Neuguinea geöffnet. Kontinentfilter Ozeanien zeigte 14 Länder. Zufall und Weiter-Navigation wechselten das Land korrekt.
- Deutschland als Favorit markiert; nach Reload und erneutem Öffnen erschien es in der Favoritenansicht unverändert.
- Desktopdarstellung visuell geprüft. Keine physische Android-/iPhone-Prüfung und keine automatisierte Touch-Simulation durchgeführt; dies wird nicht als bestanden behauptet. Touch-Swipe und responsive CSS sind implementiert.
- Keine Supabase-Änderungen, keine APK, keine Änderung an Quizfragen, Spielständen, Scores oder dem offiziellen Logo. Zusätzliche Python-Abhängigkeiten dienen ausschließlich lokaler Geodatenprüfung, keine neuen Runtime-Abhängigkeiten.

Zuerst wurde die funktionsfähige Version mit vorhandenen Daten auf GitHub gesichert, anschließend die vollständige Geografie und zuletzt die Präzisionskorrektur für Mikrostaaten. Änderungen sind im bestehenden Repository nachvollziehbar.
