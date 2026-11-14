# GeoDuel

**Öffentlich spielen:** https://geoduel-flegik.flegik.chatgpt.site

Geografiequiz im Browser mit Singleplayer und 1v1-Duellen. Kein Pflichtkonto, kein Passwort und kein Supabase-Konto für Spieler.

## Installieren

- Android: Link in Chrome öffnen, Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- iPhone/iPad: Link in Safari öffnen, Teilen → „Zum Home-Bildschirm“ → Hinzufügen.
- Desktop: Installationssymbol in Chrome/Edge nutzen, soweit der Browser es anbietet.

## Spielen

Singleplayer bietet 8/12/16 Fragen aus vier zufälligen Kategorien sowie Training aller acht Kategorien. Der lokale Fortschritt, Antworten und Statistiken bleiben beim Neuladen erhalten. Schwierigkeit: 1/2/3 Punkte. [Deutschland](docs/2026-11-14-deutschland.md) ergänzt 970 Fragen sowie einen Bundesländerbereich im Weltatlas.

Für Duelle wählen beide einen Gastnamen. Einer erstellt einen Raum, der andere tritt mit dem vierstelligen Code oder Einladungslink bei. Beide werden bereit; der Host startet. Beide beantworten dieselben Fragen im eigenen Tempo. Gegnerpunkte erscheinen erst am Ende. Bilanz und Ergebnisse werden serverseitig gespeichert.

Gastprofile sind an den Browser gebunden. Löschen der Browserdaten kann den Zugang verlieren; andere Geräte verwenden eigene Profile. Solo-Daten werden nur lokal gespeichert.

## Entwicklung und Tests

```sh
npm ci
npm test
npm run build
npm run dev
```

Build-Ausgabe: `dist`. React, TypeScript, Vite, Tailwind, Motion und Supabase. `.env.production` enthält ausschließlich die öffentliche URL und den Publishable Key des bestehenden Projekts `qngzwhesblhzprurxelv`. Diese Werte dürfen im Browser sichtbar sein. Private Server- oder Signierschlüssel gehören niemals ins Frontend.

```sh
npm run test:multiplayer
```

Der Live-Test erstellt zwei eigene QA-Gäste und ein Testduell im bestehenden Backend. Er prüft unter anderem Raumzugang, identische Fragen, verborgene Punkte, Wertung, Ergebnis, Persistenz und Revanche. Er löscht keine Nutzerdaten.

## Veröffentlichung

Die öffentliche Version läuft über den bereits vorhandenen GeoDuel-Hostingplatz bei ChatGPT Sites. Cloudflare Pages verlangte eine zusätzliche Anmeldung; Vercel war nicht verbunden. Die Veröffentlichung wurde deshalb ohne diese Kontozugänge über das vorhandene Hosting abgeschlossen.

GitHub ist der maßgebliche Quellcodestand. Die Hostingquelle ist eine separate, versionierte Spiegelung des Frontends. Es besteht derzeit **keine automatische Veröffentlichung bei einem GitHub-Push**. Vor künftigen Releases aktuellen GitHub-Stand synchronisieren, testen, bauen und im bestehenden Hostingprojekt veröffentlichen. Projektzuordnung: `.openai/hosting.json`.

Die bestehende Android-APK bleibt unverändert und wird für diese PWA nicht benötigt. Testnachweise und Grenzen: [VERIFICATION.md](VERIFICATION.md).
