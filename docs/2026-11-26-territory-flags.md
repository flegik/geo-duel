# GeoDuel 0.12.0 – Gebietsflaggen

Die PWA zeigt 236 Flaggen und verwendet 940 aktive Flaggenfragen. Die 195 Staatsflaggen bleiben im Atlas als eigener Filter verfügbar. Die 41 zusätzlichen Einträge können dort einzeln ausgewählt werden und haben lokale SVG-Dateien mit Originalproportionen, Bildquelle, Statusbeleg und Prüfsumme.

| Fragetyp | Neue Fragen |
|---|---:|
| Flagge erkennen | 41 |
| Richtige Flagge auswählen | 41 |
| Politische Zugehörigkeit | 32 |
| Geografische Region | 41 |
| Flaggenmerkmal zuordnen | 5 |
| Gesamt | 160 |

Das Gebietsregister hält ISO-Kennungen getrennt von internen IDs. Weihnachtsinsel und Kokosinseln nutzen gebräuchliche lokale Flaggen. Neukaledonien zeigt die Kanak-Flagge mit einem Hinweis auf die ebenfalls verwendete französische Trikolore. Martinique zeigt die rot-grün-schwarze Territorialflagge. Zugehörigkeitsfragen setzen eine eindeutige Zuordnung voraus.

Die additive Migration `20261126220500_territory_flags` schaltet die neuen Fragen für Duelle frei, wenn beide Clients das Frageformat 5 unterstützen. Die vorhandene serverseitige Wertung verwendet bei Bildfragen dieselbe Antwortreihenfolge wie die Anzeige. Vor der Antwort sendet der Server die Bildpfade der vier Optionen. Die Varianten eines Gebiets teilen eine Lernsubjekt-ID.

## Verifikation

- `npm test` bestand mit 83 Tests. `npm run build` erzeugte den Produktionsbuild inklusive PWA-Cache.
- Supabase bestätigte 940 aktive Flaggenfragen, 236 Lernsubjekte und 46 neue Bildfragen mit jeweils vier Bildpfaden.
- Zwei Produktionsduelle mit separaten Gastprofilen liefen mit 12 und 24 Fragen durch. In der Stichprobe erschienen fünf neue Gebietsfragen, darunter zwei inverse Bildfragen. Geprüft wurden gemeinsame Antwortreihenfolge, serverseitige Punkte, fehlende Lösung vor der Antwort, Wiederverbindung, Revanche und Auswertung beider Spieler.
- Im veröffentlichten Atlas luden die zehn priorisierten Flaggen. Der getrennte Staatenfilter zeigte 195 Einträge. Die Kaimaninseln wurden zusätzlich bei 390 CSS-Pixeln Breite geprüft.
- Eine veröffentlichte Singleplayer-Runde mit 16 Fragen enthielt Guernsey, die Nördlichen Marianen und die Kaimaninseln. Alle drei Antwortvorschauen öffneten sich.

[Gebietsregister mit Bild- und Statusquellen](../data/flags/territories.json) · [GeoDuel-PWA](https://geoduel-flegik.flegik.chatgpt.site/)
