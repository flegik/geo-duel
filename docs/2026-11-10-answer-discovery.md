# Antwortvorschauen und PWA-Updates

Veröffentlicht am 10.11.2026 unter https://geoduel-flegik.flegik.chatgpt.site/ . Keine Datenbankänderungen, keine neuen Fragen, keine APK.

## Verhalten

Nach gespeichertem Singleplayer-Feedback bzw. bestätigtem Multiplayer-Feedback wählen Antwortklicks ausschließlich den lokalen Vorschauindex. Der Antwort-RPC wird in diesem Zweig nicht aufgerufen. Grün/Rot und ursprüngliche Antwort bleiben erhalten. Die gemeinsame Darstellung in renderQuestion wird für beide Modi verwendet. Beim Weitergehen wird die Vorschau zurückgesetzt. Feedback selbst wird aus gespeicherter Runde bzw. serverseitigem Snapshot wiederhergestellt.

Flaggen: alle 195 lokalen SVGs in Originalproportionen. Karten und Silhouetten: bestehende Natural-Earth-Assets nach ausgewähltem Land, soweit vorhanden. Hauptstädte: geprüfte Erklärung aus bestehenden Fragen. Sehenswürdigkeiten: vorhandene Illustration plus Erklärung eines Wahrzeichens im gewählten Land, sofern verfügbar. Weltwissen: Erklärung aus bestehendem Pool, sofern eindeutig zugeordnet. Nachbarländer: Landesflagge als ausdrücklich gekennzeichneter Vergleich, keine neue Grenzkarte und keine ungesicherte Behauptung über Nachbarschaft. Nicht abgedeckte Optionen erhalten einen ehrlichen Text statt erfundener Fakten. Es wurden keine zusätzlichen Geodaten importiert.

## Updates

Explizite Registrierung über virtual:pwa-register/react, keine doppelte automatische Registrierung. Prüfungen bei Start, Fokus, Online-Rückkehr und Sichtbarkeit. Benutzerbestätigtes Update über updateServiceWorker(true). Offene Solo-Runden, wartende oder laufende Duelle und laufende Aktionen sperren den Button. Keine automatische Update-Aktivierung. Workbox cleanupOutdatedCaches bleibt aktiv. Browserdaten, Auth-Sitzungen und lokale Spielstände werden nicht gelöscht. Versionsanzeige unter Profil → Einstellungen.

## Tatsächliche Prüfungen

- 29 automatisierte Tests bestanden, TypeScript/Produktionsbuild erfolgreich; nur vorhandene Warnung zur Bundlegröße.
- Tests prüfen alle 195 Flaggenpfade, vorhandene Karten/Umrisse, korrekte/falsche gespeicherte Antworten, wiederholte Vorschauauflösung ohne Zustandsänderung und den ausschließlich lokalen Feedback-Klickzweig.
- Live Chrome: falsche Antwort Katar auf Bahrain-Frage; danach Bahrain und Indonesien als Vorschauen gewechselt, Punktestand blieb 0. Nach Reload offene Runde und dieselbes Feedback wiederhergestellt.
- Zwei echte Veröffentlichungen im bestehenden Sites-Projekt: Version 5 (App 0.3.0, Hosting-Commit 5883b994f98e18a764460a962861a8ad5753e9dc), danach Version 6 (App 0.3.1, Hosting-Commit dc97edca2fe4f53636bb594aa06cf56f76426797).
- Während offener Runde erschien das Update-Banner mit gesperrtem Button. Nach Abschluss der 12 Fragen wurde der Button freigegeben. Benutzerbestätigung aktivierte Version 0.3.1 und lud kontrolliert neu. Einstellungen bestätigten 0.3.1; Statistik blieb bei 1 Runde, 10 Punkten und 4/12 richtigen Antworten erhalten.
- Desktopansicht visuell geprüft. Keine physische iPhone-/Android-Geräteprüfung und kein neues Zwei-Gäste-Browserduell durchgeführt; diese werden nicht als bestanden behauptet. Der Multiplayer verwendet denselben lokalen Feedback-Klickzweig; der bestehende Server wurde nicht verändert.

Die Neuinstallation einer unter derselben URL installierten PWA ist für zukünftige Aktualisierungen nicht erforderlich. Alte Installationen müssen zunächst den neuen Frontend-Stand laden, bevor dessen Banner verfügbar ist. Datenlöschen ist dafür nicht vorgesehen.
