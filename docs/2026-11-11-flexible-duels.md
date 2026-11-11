# GeoDuel 0.9.0 – Frei konfigurierbare 1v1-Duelle

Veröffentlicht am 11. November 2026 auf der bestehenden [GeoDuel-PWA](https://geoduel-flegik.flegik.chatgpt.site/). Hosting-Version 18 verwendet den Quellcommit `f3634daf90186e5db724ddd2fd94a018d772aaba`. Das öffentlich ausgelieferte JavaScript-Bundle stimmt bytegenau mit dem Produktionsbuild überein.

Die Duell-Lobby bietet den bisherigen Zufallsmodus mit vier Kategorien und 8, 12 oder 16 Fragen. Standard sind 12 Fragen. Im eigenen Modus kann der Host die sieben Kategorien einzeln einstellen. Die Summe muss beim Bereitmelden und Start zwischen 4 und 24 liegen. Die Lobby speichert auch Entwürfe mit 0 bis 3 Fragen, damit der Gast die laufenden Änderungen sehen kann.

Vorlagen setzen 12 Flaggen, 16 Flaggen oder 8 Flaggen und 8 Karten. Die Zahlen lassen sich danach einzeln ändern. Die Anzeige reagiert sofort auf Host-Eingaben und synchronisiert die bestätigte Konfiguration an den Gast. Jede gespeicherte Änderung setzt beide Bereitschaften zurück. Eine veraltete Bestätigung wird serverseitig zurückgewiesen.

## Server und Bestand

Die additive Migration `20261111204826_flexible_duel_counts` speichert den Entwurf und die beim Start festgeschriebene Verteilung getrennt. Die verbindliche Gesamtzahl wird in Fortschritt, Abschluss und Statistik verwendet. Vorhandene Räume ohne neue Konfigurationsfelder verwenden die bisherige Berechnung. Die Revanche übernimmt Auswahlmodus und Fragenzahlen, bleibt bis zum Start editierbar und erzeugt bei parallelen Anfragen einen gemeinsamen Raum.

Der Server speichert weiterhin die Fragen und Antwortreihenfolge einmal pro Duell. Die Schwierigkeit rotiert über alle Positionen. Der Pool darf innerhalb der bestehenden geografischen Auswahlregeln auf verfügbare Schwierigkeitsgrade ausweichen. Ist die vollständige Planung mit unterschiedlichen Lernsubjekten unmöglich, werden keine Teilzuordnungen gespeichert. Richtige Antworten und gegnerische Punkte bleiben bis zum vorgesehenen Zeitpunkt verdeckt.

Nach der Produktionsmigration stimmten die Prüfsummen von 2.779 vorhandenen Fragezeilen, 677 vorhandenen Duellzuordnungen, 1.332 gespeicherten Antworten und 70 abgeschlossenen Räumen mit dem Ausgangsstand überein. Ein bestehendes Duellergebnis war identisch. Die neue private Berechnung ist weder für anonyme noch für authentifizierte API-Rollen direkt aufrufbar.

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` und `npm run build` | 64 Tests bestanden. TypeScript, Produktionsbundle und Service Worker erfolgreich. Vite meldet weiterhin große Bundle-Chunks. |
| Lokale SQL-Integration | 18 Verteilungen einschließlich aller geforderten Mischungen, 24 Fragen in jeder der sieben Einzelkategorien und 8/12/16 Fragen im Zufallsmodus. Validierung, Host-Rechte, Bereitschaft, Verlauf eines alten Raums, Ergebnis, Review, neue Revanche-Fragen und atomarer Startabbruch geprüft. |
| Produktion, 12 Flaggen | Beide Gastprofile spielten alle zwölf Fragen. Zwölf Lernsubjekte, je vier Fragen pro Schwierigkeit und 24 zu 0 Punkte bei gezielt richtigen bzw. falschen Antworten. |
| Produktion, 8 Flaggen und 8 Karten | Beide Gastprofile spielten alle 16 Fragen. Exakt acht pro Kategorie und 16 unterschiedliche Lernsubjekte. Bei vorgegebenen richtigen bzw. falschen Antworten 33 zu 0 Punkte. |
| Mobile Browser | Zwei separate Chromium-Sitzungen bei 390 und 320 CSS-Pixeln mit dem Produktionsbackend. Vorlagen, 7+5, beide Summengrenzen, automatische Aktualisierung der Gastansicht, Bereitschafts-Reset, Gast ohne Eingabeelemente, 2+2-Duell, Auswertung und synchronisierte Revanche. Kein horizontaler Überlauf. Die Ansichten wurden emuliert. |
| Öffentliche PWA | Version 0.9.0 nach Abschluss einer offenen QA-Runde regulär aktiviert. In der Live-Lobby 8+8 gewählt, auf 7+5 geändert und die gespeicherte Verteilung nach einem Neuladen bestätigt. |
| Multiplayer-Regression | Unverändertes Standardduell mit acht Fragen. Identische Reihenfolge, verdeckte gegnerische Punkte, Wiederholungs- und Reconnect-Sicherheit, Review, Statistik und Revanche bestätigt. Im flexiblen Test ergaben parallele Revanche-Anfragen dieselbe Lobby und insgesamt 28 erfasste Fragen pro Profil. |

## GitHub

- [Meilenstein A – Backend, Migration und SQL-Tests](https://github.com/flegik/geo-duel/commit/2168c78266d5249dc3aaec9c3ea8e1e38536d27c)
- [Meilenstein B – Lobby, Vorlagen, Zähler und UI-Tests](https://github.com/flegik/geo-duel/commit/e266e1bdea69dfe6a48268d1ca55289ffcab0fd1)
