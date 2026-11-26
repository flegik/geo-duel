# GeoDuel 0.12.1 – Flaggen und Weltwissen

| Produktionsbestand | Vorher | Nachher |
|---|---:|---:|
| Aktive Flaggenfragen | 940 | 862 |
| Flaggen-Lernsubjekte | 236 | 236 |
| Aktive Weltwissen-Fragen | 290 | 368 |
| „Regionen & Gebiete“ in Weltwissen | 0 | 78 |

Die 41 klassischen und 41 umgekehrten Gebietsflaggenfragen bleiben spielbar. Die 78 neuen Weltwissen-Fragen verteilen sich auf 41 Regionen, 32 politische Zugehörigkeiten und 5 Gebietsmerkmale. Jede hat vier Textantworten und eine eindeutige Lösung. Die neuen IDs beginnen mit `world-territory-v1-`. Die alten Fragen wurden nur für die künftige Auswahl deaktiviert.

Solo und Duelle reservieren im Mittel 8 % ihrer Weltwissen-Plätze. Ein Startwert pro Runde verteilt die Auswahl auch bei kurzen Runden. Wenn zwei dieser Fragen vorkommen, kommen sie aus unterschiedlichen Fragetypen. Die übrigen Weltwissen-Plätze folgen der jeweiligen bisherigen Auswahl. Supabase prüft bei aktiven Flaggenfragen Bildtyp, zugelassenen Fragetext und bei inversen Fragen vier Bildoptionen.

## Produktionsprüfung

- Migration `20261126223542_territory_world_topic` mit erfolgreichem Probelauf und anschließender Aktivierung.
- Alle neun gespeicherten Duellzuordnungen für die betroffenen historischen Fragen ergaben vor und nach der Migration dieselbe Prüfsumme für Frageinhalt und Zuordnung. Ein vor der Umstellung abgeschlossenes Testduell lieferte in der Auswertung die ursprüngliche Kategorie, Optionen und beide Antworten. Die verknüpfte Revanche ließ sich weiterhin abrufen.
- `npm test` bestand mit 86 Tests. `npm run build` war erfolgreich.
- In der Live-PWA wurde eine reine Flaggenrunde mit 12 Fragen abgeschlossen. In Weltwissen wurden neue Zugehörigkeitsfragen samt Antwortvorschau geprüft. Die Lösung für Åland wurde im aktiven Produktionspool und durch den automatischen Datenabgleich bestätigt.
- Durchgespielte Produktionsduelle mit zwei Gastprofilen umfassten 16 Flaggenfragen und 24 Weltwissen-Fragen. Letzteres enthielt eine Zugehörigkeits- und eine Gebietsstatusfrage. Geprüft wurden serverseitige Punkte, Fragenfolge für beide Teilnehmer, Wiederverbindung, Revanche und Auswertung.
- ChatGPT-Site-Version 25 veröffentlicht und App-Version 0.12.1 im Browser bestätigt.

[GeoDuel-PWA](https://geoduel-flegik.flegik.chatgpt.site/)
