# GeoDuel 0.6.1 – 1v1-Fragenauswertung

Veröffentlicht am 11. November 2026 im bestehenden [GeoDuel-Site](https://geoduel-flegik.flegik.chatgpt.site/), Sites-Version 15. Der veröffentlichte Hosting-Quellcommit ist `ee90e004cce114f07dfe3c83795f0a44fbd90b3d`. Der JavaScript-Einstieg des GitHub- und des Sites-Builds ist bytegleich. Die öffentliche Seite liefert dieses Bundle.

## Änderungen

- Unter „Antworten ansehen“ zeigt jede aufklappbare Karte die Fragennummer, Kategorie, Frage sowie „Du“ und den gegnerischen Namen mit ✓/✗, Status und gespeicherten Punkten. Die ursprüngliche Duellreihenfolge bleibt erhalten.
- Geöffnet erscheinen die vollständige Frage, das vorhandene Medium, alle vier Optionen in Duellreihenfolge, die richtige Lösung, die Auswahlmarkierungen beider Spieler und die Erklärung. Bei gleicher Wahl erscheinen beide Markierungen an derselben Option.
- Die Optionen öffnen die vorhandene Lernvorschau. Die Interaktion arbeitet ausschließlich mit lokalem UI-Zustand. Das letzte abgeschlossene Duell lässt sich im selben Browser nach dem Neuladen über die bestehende Startseiten-Schaltfläche wieder öffnen, wenn kein aktives Duell vorliegt.
- Die Migration `20261111123541_duel_review_compare.sql` erweitert ausschließlich den abgeschlossenen, teilnehmergeschützten Zweig `public.geoduel('review', …)`. `answers` enthält Profil-ID, ausgewählten Index und gespeicherte Punkte beider Spieler. Die bisherigen Felder `selected` und `points` bleiben für ältere Clients erhalten. `option_order` bestimmt die angezeigten Optionen und die Position der richtigen Lösung. Die Migration enthält keine Änderungen an gespeicherten Antworten, Profilen, Fragen oder Statistiken.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | 50 von 50 bestanden, auch im Hosting-Checkout. |
| `npm run build` | TypeScript, Produktionsbundle und PWA-Service-Worker erfolgreich. Vite meldet weiterhin große Bundle-Chunks. |
| `npm run test:multiplayer` | Bestanden mit zwei anonymen Sitzungen, verdeckten Gegnerpunkten, idempotenter Antwort, Statistik, Reconnect und Revanche. |
| `node --env-file=.env.production scripts/test-duel-review.mjs` | Acht Fragen mit zwei unabhängigen anonymen Profilen. Beide RPC-Antworten gegen Spiel-Feedback, Optionsreihenfolge und Duellergebnis geprüft. Wiederholter Abruf liefert dieselben Daten und ändert weder Statistik noch Ergebnis. |
| Zugriff auf `review` | In der Lobby, im laufenden Duell und nach Abschluss nur eines Spielers verweigert. Angemeldetes drittes Profil und unauthentifizierter Client abgewiesen. `anon` besitzt kein RPC-Ausführungsrecht und `authenticated` kein direktes SELECT-Recht auf `game.answers`. |
| Historische Duelle | 50 bereits vor der Migration abgeschlossene Duelle, 100 Teilnehmerperspektiven. Angezeigte Optionen, Lösung und beide gespeicherten Antwortsätze per SQL mit den vorhandenen Datensätzen verglichen. |
| Chrome mit zwei Gastprofilen | Vollständiges Duell mit acht Fragen in Flaggen, Karten, Silhouetten und Weltwissen. Beide Perspektiven mit identischer Reihenfolge und passender „Du“-Zuordnung geprüft. Abgedeckt sind beide richtig, beide falsch, nur einer richtig, gleiche Wahl und unterschiedliche falsche Wahl. Ursprüngliche Medien und Vergleichsvorschauen geprüft. |
| Schmale Darstellung in Chrome | 360-Pixel-Testviewport, 345 Pixel nutzbare Breite mit Scrollbar. Beide Statusspalten nebeneinander, kein horizontaler Überlauf. Öffnen, Kartenvorschau und Schließen per Klick geprüft. |
| Öffentliche PWA | Update-Hinweis schützt eine laufende QA-Solorunde. Nach deren Abschluss regulär auf 0.6.1 aktualisiert, das gespeicherte 1v1-Duell wieder geöffnet und alle acht Karten aus der zweiten Gastperspektive geprüft. Die Kartenpunkte summierten sich zu 11 und 9. Erneutes Öffnen und Erkunden einer anderen Flagge änderten die Wertung nicht. |

Android Chrome und iOS Safari wurden nicht auf physischen Geräten getestet. Die Browserprüfung erfolgte in Desktop-Chrome und in einem schmalen Chrome-Viewport.

## GitHub

- Backend und Regressionstest: `3d9dfb294be1240d59e483711068718e282d97ba`
- Frontend und PWA-Version: `459c30d149a45086dd5759476172a966386dc0ee`
