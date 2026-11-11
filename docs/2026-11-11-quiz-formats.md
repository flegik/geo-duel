# GeoDuel 0.8.0 – Vier neue Frageformate

Am 11. November 2026 auf der bestehenden [Live-PWA](https://geoduel-flegik.flegik.chatgpt.site/) veröffentlicht. Das Hosting führt Version 17 mit Quellcommit `bb5ba5f859e5212982451e85af684982346061fd`. Das öffentlich ausgelieferte JavaScript-Bundle und der geprüfte Produktionsbuild stimmen bytegenau überein.

## Fragen und Quellen

| Kategorie | Neu | Umsetzung und Quelle |
| --- | ---: | --- |
| Flaggen | 195 | Je Staat eine umgekehrte Variante. Vier lokale SVGs in Originalproportionen. Optisch ähnliche und anhand der bisherigen Fairnessregeln gefilterte Optionen aus dem [Flaggenregister](../data/flags/README.md). Beide Richtungen verwenden `flag:ISO` als Lernsubjekt. |
| Länder auf Karten | 201 | 200 ausgewählte Städte mit Koordinaten aus [UN WUP 2025 F21](https://population.un.org/wup/downloads?tab=Cities) plus [Kyoto](https://www.wikidata.org/wiki/Q34600). Vier anklickbare Länder-Marker auf [Natural-Earth-Karten](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/). Der Stadtpunkt erscheint nach der Antwort. Fragen und Optionen enthalten keine afrikanischen Länder. Die neuen Varianten teilen sich das Lernsubjekt mit der jeweiligen Länderkarte. |
| Sehenswürdigkeiten | 42 | 18 bestehende Illustrationen, acht lizenzierte Fotos und 16 Textfragen. Offizielle [UNESCO-Einträge](https://whc.unesco.org/en/list/) belegen die Standorte. [GeoNames](https://www.geonames.org/export/) belegt alle angebotenen Städte. Die drei Distraktoren liegen jeweils im selben Land. Foto-Credits erscheinen in der Auflösung. |
| Weltwissen | 64 | Je 16 Fragen zu Bevölkerungsdichte, Landfläche, Länderbevölkerung und Stadtbevölkerung. Die Länderwerte stammen aus [WDI 2023](https://data.worldbank.org/indicator/EN.POP.DNST), die Stadtwerte aus [UN WUP 2025](https://population.un.org/wup/downloads?tab=Cities). Jede Kennzahl umfasst Höchstwert, Tiefstwert sowie Rang zwei und drei. Alle vier Werte stammen je Frage aus derselben Reihe und demselben Jahr. Der Abstand zwischen benachbarten Werten beträgt je nach Kennzahl mindestens 17 bis 25 %. Keine afrikanischen Länder oder Städte in Lösungen oder Distraktoren. |

Die sieben Hauptkategorien umfassen jetzt 2.453 aktive Fragen. Bei Bildflaggen enthält die offene Duellfrage vier neutrale Dateipfade. Die API liefert die Ländernamen der Flaggenoptionen und die Lösung erst nach der eigenen Antwort. Der Server speichert die Optionsreihenfolge pro Duellposition und verwendet sie für Wertung und Review. Bei Städtekarten enthält die offene Frage nur die Länderoptionen und den Medientyp. Der Stadtpunkt steht in den geschützten Auflösungsdaten.

Die Spieler geben ihre Formatversion beim Bereitmelden an. Duelle mit mindestens einem älteren Client greifen auf die vorhandenen Fragetypen zu. Die bisherige regionale Gewichtung, Punkteberechnung und Lernhistorie gelten weiter. Größenvergleiche sind eine zusätzliche Auswahlgruppe innerhalb von Weltwissen. Das Verhältnis zwischen den Gewichten der bisherigen Weltwissen-Gruppen bleibt erhalten. [Daten- und Lizenznachweise](../data/learning/SOURCES.md)

## Prüfergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | 61 Tests bestanden. Geprüft wurden unter anderem eindeutige Optionen, IDs, Datenquellen und Medien, alle 195 Flaggenproportionen, Stadtmarker vor und nach der Antwort, null Afrika-Optionen bei Städten auf Karten und Größenvergleichen sowie numerische Abstände und Ranglösungen. |
| `npm run build` | TypeScript, Produktionsbundle und PWA-Service-Worker erfolgreich. Vite meldet große Bundle-Chunks. |
| PostgreSQL-Integration | 502 neue Zeilen zunächst deaktiviert eingespielt, danach atomar freigeschaltet. Die SQL-Integration prüfte die Kompatibilität alter Clients, die verdeckten Flaggenoptionen und die serverseitige Auflösung aller vier Formate. |
| Echte Produktionsduelle | Sechs Duelle mit zwei separaten anonymen Gastprofilen und 60 gemeinsamen Fragen abgeschlossen. Darunter zwei umgekehrte Flaggen, drei Städtekarten, zwei Sehenswürdigkeiten nach Stadt und ein Größenvergleich. Beide Spieler erhielten dieselbe Reihenfolge. Lösung, Koordinaten und Vergleichswerte erschienen erst nach der eigenen Antwort. Punkte, beide Review-Perspektiven, Reconnect, Revanche und ein Duell mit altem Client-Format bestanden. |
| Live-Browser | Die 0.8.0 geöffnet und alle Formate gespielt. Umgekehrte Flagge der Republik Kongo, Stadtkarte Innsbruck mit auswählbarem Marker und erst danach sichtbarem Stadtpunkt, Wahrzeichen mit Kyoto als Lösung sowie Bevölkerungsdichte-Vergleich aus WDI 2023. Jeweils die Antwortvorschau geöffnet. Alle acht neuen WebP-Dateien wurden vom Live-Host bytegenau ausgeliefert und stehen im PWA-Precache. |
| Mobile Chromium-Ansichten | Alle vier Formate bei 390 CSS-Pixeln, Flaggen und Städtekarten zusätzlich bei 320 CSS-Pixeln. Jeweils Auswahl, Auflösung, Antwortvorschau und Solo-Ergebnisprüfung durchlaufen. Keine horizontalen Überläufe. Im Atlas bleiben 195 Länder sichtbar. Physische Android- und iOS-Geräte waren nicht Teil der Prüfung. |
| Auswahlprobe | 2.400 gemischte Solorunden mit 8, 12 und 16 Fragen. Alle vier Formate wurden mit frischen und längeren Spielerhistorien ausgewählt. Keine Runde enthielt ein Lernsubjekt doppelt. |
| Produktion und Bestand | Prüfsummen aller 2.277 bisherigen Fragezeilen, 617 bisherigen Duellzuordnungen und 1.212 zuvor gespeicherten Antworten stimmen mit dem Ausgangsstand überein. Anonyme und authentifizierte Clients können weder die private Fragentabelle lesen noch den privaten Snapshot direkt aufrufen. |

## GitHub und Supabase

1. [Umgekehrte Flaggenfragen](https://github.com/flegik/geo-duel/commit/221a70bb8d5f65202db39fca7acf33db4a378977)
2. [Städte auf Karten](https://github.com/flegik/geo-duel/commit/487a6d94b772ae6bd011aad888b6e7dde72ca408)
3. [Sehenswürdigkeiten nach Stadt](https://github.com/flegik/geo-duel/commit/bff8bf02fc38da5a7bd71914a1f552752851aa7d)
4. [Größenvergleiche](https://github.com/flegik/geo-duel/commit/94b63723394b5cf96f42de2a96eb13a7d86ea217)
5. [Duell-Kompatibilität, Migrationen und PWA-Version](https://github.com/flegik/geo-duel/commit/32f5741d31354ed7045099c147adb3e15febe11e)

Produktive Migrationen `20261111191541_expanded_quiz_compatibility`, sechs Seed-Migrationen von `20261111191547` bis `20261111191637` und `20261111193123_expanded_quiz_activate`. Die Aktivierung erfolgte nach Prüfung des veröffentlichten Produktionsbundles.
