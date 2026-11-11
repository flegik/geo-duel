# GeoDuel 0.7.0 – Regionale Auswahl und Hauptstadtfragen

Veröffentlicht am 11. November 2026 auf der bestehenden [GeoDuel-PWA](https://geoduel-flegik.flegik.chatgpt.site/), Sites-Version 16. Der Hosting-Quellcommit `88b0ebf71a68de8dde4efab536737f0484c0ec86` enthält denselben Quellbaum wie der GitHub-Meilenstein B. Das ausgelieferte JavaScript-Bundle stimmte bytegenau mit dem lokalen Produktionsbuild überein.

## Auswahl und Simulation

Die fünf regional gewichteten Kategorien teilen sich pro Runde eine zufällige Startphase. Jede Kategorie und die Summe dieser Kategorien erhalten höchstens die aufgerundete Zahl ihrer Afrika-Zielplätze. Über viele Runden entspricht die erwartete Anzahl dem jeweiligen Zielwert. Kürzlich gespielte Themen und Länder werden bei der Auswahl berücksichtigt. Supabase verwendet dafür die jüngste Runde jedes Teilnehmers und die Themenhistorie beider Teilnehmer. Für Nachbarländer hat Ozeanien ein niedrigeres Gewicht, weil der geprüfte Pool dort ein Fokusland mit passenden Landgrenzen enthält. Die Flaggen und die eigene Themengewichtung von Weltwissen folgen weiter ihren bisherigen Auswahlpfaden.

Pro Profiltyp wurden 5.000 gemischte Runden mit 8, 12 und 16 Fragen, 1.000 reine Nachbarländer-Runden mit 12 Fragen und 1.000 Nachbarländer-Runden in der aktuellen 1v1-Länge von 2 bis 4 Fragen simuliert. Die frischen Profile starteten in Gruppen von je zehn Runden. Die langen Historien wurden mit 50 Runden vorgewärmt. Die 12-Fragen-Simulation prüft das gewünschte Belastungsbeispiel. Die öffentliche 1v1-Lobby bietet in einer einzelnen Kategorie weiterhin 2 bis 4 Fragen.

| Kategorie | Ziel Afrika | Vorher, frische Profile | 0.7.0, frische Profile | Vorher, lange Historie | 0.7.0, lange Historie |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nachbarländer | 5 % | 15,16 % | 5,07 % | 14,81 % | 5,03 % |
| Hauptstädte | 8 % | 15,25 % | 7,72 % | 15,28 % | 7,59 % |
| Länderumrisse | 10 % | 15,30 % | 9,90 % | 15,16 % | 10,24 % |
| Länder auf Karten | 10 % | 14,89 % | 10,26 % | 14,19 % | 9,99 % |
| Sehenswürdigkeiten | 10 % | 15,38 % | 9,76 % | 14,90 % | 9,83 % |

Verteilung der übrigen Fokusländer in gemischten Runden mit langer Historie. Die Prozentwerte beziehen sich auf alle Fragen der jeweiligen Kategorie.

| Kategorie | Europa | Asien | Nordamerika | Südamerika | Ozeanien |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nachbarländer | 30,91 % | 27,51 % | 17,64 % | 14,96 % | 3,94 % |
| Hauptstädte | 27,16 % | 25,45 % | 15,03 % | 14,00 % | 10,76 % |
| Länderumrisse | 26,02 % | 24,06 % | 15,34 % | 13,78 % | 10,55 % |
| Länder auf Karten | 26,55 % | 24,67 % | 15,05 % | 13,08 % | 10,66 % |
| Sehenswürdigkeiten | 27,15 % | 25,14 % | 14,93 % | 12,93 % | 10,03 % |

Die Auswertung trennt das Fokusland von den falschen Optionen. In den gemischten Runden mit langer Historie fiel der Anteil afrikanischer Nachbarländer-Distraktoren von 3.786/25.563 auf 1.287/25.563. Die Zahl der Nachbarländerfragen mit drei afrikanischen Distraktoren sank von 1.262 auf 429. Bei Hauptstädten sank die entsprechende Zahl von 1.314 auf 655. Die Rohdaten enthalten die vollständige Verteilung aller falschen Optionen und die Häufigkeit von null bis drei afrikanischen Distraktoren je Frage.

In den 2.000 reinen 12-Fragen-Nachbarländerrunden hatte zuvor gut die Hälfte mindestens zwei afrikanische Fokusländer. Mit 0.7.0 hatten 763 Runden null und 1.237 Runden genau ein afrikanisches Fokusland. In den simulierten 2- bis 4-Fragen-Runden blieb es ebenfalls bei höchstens einem. In benachbarten Runden wiederholte sich nach der Änderung kein Nachbarländer-Thema und kein afrikanisches Nachbarländer-Fokusland. Bei zwölf Fragen kann in zwei aufeinanderfolgenden Runden jeweils ein afrikanisches Land erscheinen. Die Einzelrunden bleiben begrenzt und die Länder wechseln. In gemischten Runden mit langer Historie ging die Zahl direkt wiederholter Themen über alle sieben Kategorien von 244 auf 5 zurück. Bei den fünf gewichteten Kategorien sank die Zahl gemischter Runden mit drei oder mehr afrikanischen Fokusländern von 700 auf 0.

Die JSON-Berichte dokumentieren die vollständigen Übergänge zwischen aufeinanderfolgenden Runden. Die Produktionsauswahl in PostgreSQL wurde zusätzlich mit 1.000 gemischten Runden und 1.000 reinen Nachbarländerrunden mit zwölf Fragen simuliert, einschließlich zweier unterschiedlicher Spielerhistorien. Keine Nachbarländerrunde hatte mehr als ein afrikanisches Fokusland. Beide Gruppen hatten keine doppelten Themen innerhalb einer Runde oder direkt hintereinander.

- [Vorher](REGIONAL_ROUNDS_BEFORE.json) · [Meilenstein A](REGIONAL_ROUNDS_MILESTONE_A.json) · [0.7.0](REGIONAL_ROUNDS_FINAL.json) · [PostgreSQL-Auswahl](REGIONAL_SQL_SIMULATION.json)
- TypeScript-Simulation mit `node --import tsx scripts/analyze-regional-rounds.ts <Bericht.json>`.
- SQL-Simulation mit `node scripts/test-regional-sql.mjs <Bericht.json>` und separat installiertem `@electric-sql/pglite`. `GEODUEL_PGLITE_MODULE` kann auf das lokal installierte Modul zeigen.

## Hauptstädte und Bestandsschutz

- 135 neue Varianten ersetzen 107 bisherige Vorwärtsfragen. 132 Gegenfragen behalten ihre IDs und Länderoptionen. Bei 25 Vorwärtsfragen ohne passende verifizierte Stadt bleiben die vorhandenen Regionaloptionen erhalten.
- Die leichten neuen Fragen verwenden eine Stadt aus dem Land und zwei regionale Hauptstädte. Die mittleren verwenden in 49 von 50 Fällen zwei Städte aus dem Land. Von den 71 schweren Varianten bieten 59 drei inländische Distraktoren. Die übrigen ergänzen geeignete regionale Hauptstädte.
- Für Brasilien, Kanada, Australien, Türkei und USA prüfen Tests den exakten Satz aus vier Antworten auf der schweren Stufe und die Mischung auf den beiden anderen Stufen. Alle überarbeiteten Fragen wurden auf eindeutige Lösung, Stadtzuordnung und historische Quellenverweise geprüft. [Stadtquellen und Sonderfälle](../data/learning/SOURCES.md)
- Supabase-Migrationen `20261111164202_regional_round_selection` und `20261111164210_capital_distractors` sind in Produktion angewendet. Die Migration aktiviert 135 neue und deaktiviert 107 ersetzte IDs atomar. Alte Inhalte bleiben über ihre IDs lesbar. Die Prüfsummen der 1.184 vor der Migration gespeicherten Antworten und aller bisherigen Hauptstadtinhalte stimmen mit dem Ausgangsstand überein. Die bestehende RPC und ihr Snapshot blieben bytegleich. Die neue private Auswahlfunktion ist für anonyme und authentifizierte API-Rollen nicht direkt aufrufbar.

## Veröffentlichungsprüfung

| Prüfung | Ergebnis |
| --- | --- |
| GitHub | A [7268db9](https://github.com/flegik/geo-duel/commit/7268db99bf7977b7728b324bddb995344575dd40), B [7184a16](https://github.com/flegik/geo-duel/commit/7184a1644bb16c4c725323b0c8b05c86ce1cf3d1). |
| Tests und Build | 55 Tests bestanden. Produktionsbuild mit Service Worker erfolgreich. Vite meldet weiterhin große Bundle-Chunks. |
| Produktionsduelle | Zwei anonyme Clients pro Test. Standardduell inklusive Wiederverbindung und gemeinsamer Revanche bestanden. Je ein gezieltes Nachbarländer- und Hauptstadtduell mit drei Fragen abgeschlossen. Das Hauptstadtduell enthielt zwei neue Varianten. Beide Spieler erhielten dieselben Fragen und dieselbe Optionsreihenfolge. Die API lieferte die Auflösung erst nach der eigenen Antwort. Punkte, Review und Statistik stimmten. |
| Live-Chrome | In einer bestehenden PWA-Sitzung den Update-Hinweis verwendet und 0.7.0 geprüft. Je zwölf Hauptstadt- und Nachbarländerfragen bis zur Auswertung gespielt. Darunter USA mit den drei gewünschten Städten sowie Brasilien mit gemischten Distraktoren. Die Nachbarländer-Runde enthielt Äthiopien als einziges afrikanisches Fokusland und ließ sich nach einem Reload an derselben Stelle fortsetzen. Der Weltatlas zeigte je 195 Länder, Flaggen, Karten und Umrisse. |
| Browserabdeckung | Die Live-Prüfung erfolgte in Chrome. Physische Android- und iOS-Geräte waren nicht Teil der Prüfung. |
