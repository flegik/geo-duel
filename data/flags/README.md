# Flaggenregister

195 ISO-3166-1-alpha-2-Codes: 193 UN-Mitglieder sowie VA und PS. Keine Gebiete oder weiteren Staaten.

SVGs: Flagpedia/FlagCDN, unveränderte Originalproportionen, lokal gespeichert. Der Anbieter kennzeichnet sie als Public Domain und basiert auf Wikimedia Commons. Quelle, Abrufdatum und SHA-256 stehen je Datei im Register. Historische flag-icons-Dateien bleiben für alte Ergebnisse erhalten.

`groups.json` beschreibt überlappende visuelle Familien nach Farben, Streifen, Symbolen und regionalem Stil. `similar` enthält redaktionell priorisierte Alternativen. `excluded` sperrt bei der richtigen Flagge praktisch nicht unterscheidbare Alternativen (Monaco/Indonesien und Rumänien/Tschad). Die Beispiele Rumänien/Tschad werden deshalb bewusst entschärft.

Pflege: `node scripts/prepare-flags.mjs` importiert die 195 SVGs. Bestehende Dateien werden wiederverwendet; für eine Aktualisierung die betroffene Datei gezielt entfernen, Quelle prüfen und erneut importieren. Keine dynamische CDN-Abhängigkeit im Spiel.

Quellen: https://www.un.org/en/about-us/member-states · https://www.un.org/en/about-us/non-member-states · https://flagpedia.net/download · https://flagpedia.net/download/api
