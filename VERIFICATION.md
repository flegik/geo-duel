# GeoDuel – Validierung und Veröffentlichung

Ausgangsstand: 3b04848f9dfa140398807efbd36115de27132948. Bestehende React-/TypeScript-/Vite-Anwendung weiterverwendet.

## Meilenstein 1: Bestand und Spielserver

- npm ci erfolgreich; npm test: 16/16 bestanden; npm run build erfolgreich.
- 210 eindeutige Fragen, 30 je Kategorie, alle referenzierten Medien lokal vorhanden.
- Bestehendes Supabase-Projekt qngzwhesblhzprurxelv und Function game weiterverwendet. Keine Datenbankänderung und keine Löschung von Nutzerdaten.
- Frontend verwendet ausschließlich den öffentlichen Publishable Key. .env.production enthält bewusst nur öffentliche Browserkonfiguration.
- Live-API-Test mit zwei unabhängigen Gast-Sitzungen bestanden: Erstellen/Beitreten, vierstelliger Code, Bereitschaft, Start, identische Fragen, verborgene Gegnerpunkte, Punkteberechnung, idempotente Antworten, Warten, Ergebnis, dauerhaft gespeicherte Statistik, Sitzungswiederherstellung, Antworten ansehen und gemeinsame Revanche.
- Reproduzierbar mit npm run test:multiplayer. Der Test erzeugt eigene QA-Gastprofile und ein abgeschlossenes Testduell; die Revanche wird verlassen. Er löscht keine Daten.

## Testgrenzen

API-Prüfungen sind keine Browser- oder Smartphone-Prüfungen. Echte Android-/iPhone-Installation steht aus.
