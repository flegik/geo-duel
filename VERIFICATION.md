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

## Meilenstein 2: Öffentliche Veröffentlichung und Browserprüfung

- Öffentliche URL: https://geoduel-flegik.flegik.chatgpt.site
- Bestehenden Hostingplatz appgprj_6af1098933148191908c00ee992b2767 verwendet, Zugriff auf public gesetzt. Keine zusätzliche Spieleranmeldung am Hosting nötig.
- Veröffentlichung: Version 3; Hosting-Quellcommit 5ecc6fb2f9ccb8e1d2477a5c58199942b863c0c0.
- Chromium-Browser: Live-Startseite, vollständige 8-Fragen-Solorunde, Flaggen/Kartenbilder, sofortiges Feedback und Ergebnis bestanden (6/16 Punkte, 3/8 richtig, 38 Prozent).
- Browser-Persistenz in der Vorschau: Antwort und 3 Punkte nach Neuladen erhalten; offene Runde fortgesetzt.
- Browser-Multiplayer: Zwei unabhängige Gastprofile mit getrenntem Origin-Speicher (öffentliche Live-Seite und lokale Vorschau) am identischen Supabase-Backend. Raumbeitritt, Bereitschaft, Start, identische acht Fragen, verborgene Gegnerpunkte, Wartebildschirm, automatisches Ergebnis, 1:1 Unentschieden, dauerhafte gemeinsame Bilanz und gemeinsame Revanchelobby bestanden. Testlobby anschließend regulär verlassen.
- Wiederverbindung eines Browser-Spielers nach Neuladen im laufenden Duell bestanden.
- Öffentliches Manifest im Browser geprüft: standalone, Start-/Scope-URL /, de, Themefarbe, 192-/512-Pixel- und maskierbares Icon. Lokale PNG-Abmessungen stimmen. Produktionsbuild erzeugt registrierten Service Worker mit 137 precache-Einträgen.
- Live-Dokument bindet Manifest, Apple-Touch-Icon und registerSW.js ein; keine Workerfehler im Browserprotokoll beobachtet.

## Verbleibende Prüfgrenzen

- Keine echten Android-/iOS-/Safari-Gerätetests, kein tatsächlicher Installationsdialog auf einem Smartphone und kein erzwungener Offline-Browsertest. PWA-Metadaten-/Buildprüfung ist kein Ersatz dafür.
- Der zweite Browser-Spieler verwendete die lokale Vorschau mit separatem Speicher, keine zweite isolierte Browserinstanz der öffentlichen URL. Zusätzlich bestanden die unabhängigen Live-API-Sitzungstests.
- Direkte HTTPS-Prüfung aus dem Terminal wurde durch HTTP 403 blockiert. Die öffentliche Seite, Medien und das Manifest wurden im Cloud-Browser erfolgreich geöffnet; die Hosting-Zugriffskonfiguration bestätigt public.
- Cloudflare-/Vercel-Kontoanbindung und automatische Deployments aus GitHub sind nicht eingerichtet. Der öffentliche Release erfolgt über den bestehenden Hostingplatz.
- Datenbank und bestehende Edge Functions unverändert. Keine neue APK erstellt.
