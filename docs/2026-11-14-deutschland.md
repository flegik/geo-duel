# GeoDuel 0.10.1 · Deutschland

Veröffentlicht am 14. November 2026 auf der [bestehenden GeoDuel-PWA](https://geoduel-flegik.flegik.chatgpt.site). Sites-Version 21, Hosting-Commit `838a234fabc211bfcd7dca5136f84606ed0ce280`. Dessen Quellbaum stimmt mit dem [GitHub-Commit `57af02c`](https://github.com/flegik/geo-duel/commit/57af02c464fc39e2e7500877c0d2c874ab6ac993) überein.

| Unterthema | Aktiv |
| --- | ---: |
| Bundesländer auf Karten | 48 |
| Landesflaggen | 64 |
| Landeshauptstädte | 64 |
| Städte und Bundesländer | 180 |
| Städte auf Deutschlandkarten | 120 |
| Nachbarbundesländer | 80 |
| Naturgeografie | 114 |
| Sehenswürdigkeiten | 100 |
| Kfz-Kennzeichen | 120 |
| Einwohnerzahlen und Flächen | 80 |
| **Summe** | **970** |

Der aktive Pool enthält 543 Lernsubjekt-IDs und 180 unterschiedliche Städte mit amtlichem Gemeindeschlüssel. Karten zeigen alle 16 Bundesländer. Die 100 Sehenswürdigkeitenfragen umfassen drei bereits lizenzierte Fotos. [Datenaufbereitung, Quellen und Attributionen](../data/germany/SOURCES.md).

## Testresultate

- `npm test`: 74 bestanden. `npm run build`: erfolgreich, 370 Einträge im Offline-Cache.
- Lokaler PostgreSQL-Test: 18 Konfigurationen und Regressionstests für flexible Duelle, dazu 12 und 24 Deutschlandfragen sowie 8 Deutschland + 8 Flaggen.
- Live-PWA bei 375 CSS-Pixeln Breite: 12-Fragen-Training, Auflösung, interaktive Antwortvorschau und Ergebnis geprüft. Landes- und Stadtpunktkarten passen vollständig in ihren Rahmen. Atlas mit 16 Einträgen geprüft. Physische Android- und iOS-Geräte waren für diese Prüfung nicht im Einsatz.
- Online mit zwei unabhängigen anonymen Profilen: Realtime-Ereignis, neue Sitzung mit demselben Gastprofil, identische Fragen und Antwortreihenfolgen, verborgener Lösungsschlüssel bis zur Abgabe, serverseitige Wertung und vollständige Reviews für beide Spieler.

| Live-Duell | Unterthemen Deutschland | Bundesländer | Punkte QA A / QA B |
| --- | ---: | ---: | ---: |
| 12 Deutschland | 10 | 12 | 24 / 0 |
| 8 Deutschland + 8 Flaggen | 8 | 8 | 31 / 0 |
| 24 Deutschland | 10 | 16 | 48 / 0 |

## Produktion

Das bestehende Supabase-Projekt enthält seit der ersten Migration das kompatible Schema und die private Abfrage zur Deutschland-Auswahl. Die 970 Fragen wurden deaktiviert eingefügt. Die Aktivierung folgte auf die bestätigte Veröffentlichung von GeoDuel 0.10.0. Das Kartenlayout für kleine Viewports wurde mit 0.10.1 nachgebessert. Alte Clients können klassische Duelle weiterhin spielen. Zufallsduelle mit alten Clients wählen aus den bisherigen Kategorien. Die Prüfsummen aller sieben bestehenden Fragenpools stimmten vor und nach dem Rollout überein.

Versionsnummern im Supabase-Migrationsprotokoll und im Repository: `20261114121722_germany_support.sql`, `20261114122116_germany_seed.sql` und `20261114122310_germany_activate.sql`.
