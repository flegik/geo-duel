# GeoDuel 0.6.0 – Bevölkerungswissen und regionale Auswahl

Veröffentlicht am 10. November 2026 unter https://geoduel-flegik.flegik.chatgpt.site/ (bestehendes Projekt, Sites-Version 14; Hosting-Quellcommit `43358e340da302c2936e56150fa436a533379a21`).

## Daten und Umfang

120 neue Weltwissen-Fragen: 60 Länder, 60 Städte. Je Typ 24 Schätzfragen mit getrennten Intervallen, 24 Größenvergleiche und 12 Schwellenfragen. Schwierigkeit: 14 leicht, 78 mittel, 28 schwer. Bestehende Punktewerte 1/2/3 bleiben unverändert. Weltwissen enthält nun 270 aktive Fragen; der gesamte aktive Pool 1.923. Alle 195 Atlas-Länder und 585 Flaggenvarianten bleiben erhalten.

Länder: UN World Population Prospects 2024, mittlere Projektion für den 1. Juli 2025, Gesamtbevölkerung aller Altersgruppen und Geschlechter. Die UN-Korrektur für Togo vom 19. Januar 2026 ist berücksichtigt. Städte: UN World Urbanization Prospects 2025, F21-DEGURBA, Modellschätzung zum 1. Juli 2025; einheitlich urbane Zentren, ausdrücklich weder Gemeindegebiet noch Metropolregion. Niedrig plausible Stadtschätzungen werden nicht für Fragen oder Alternativen verwendet. Quellen, Originaldatei-Prüfsummen, exakte Werte und Definitionen stehen in `data/learning/population-*.json` und den begleitenden Quellenberichten. Lizenz: CC BY 3.0 IGO.

Vergleiche trennen die richtige Extremoption von jeder anderen um mindestens 25%; Schwellenfragen halten mindestens 20% Abstand. Schätzintervalle überlappen nicht. Jede Frage trägt Referenzjahr, Quelle, Definition, zugrunde liegende Werte und eine Erklärung. Es werden keine unterschiedlich definierten Stadtbevölkerungen verglichen.

## Konfigurierbare Auswahl

`data/learning/selection-policy.json` ist die gemeinsame Quelle für Solo- und Servergewichte: Europa 34, Asien 28, Nordamerika 10, Südamerika 9, Ozeanien 4, Afrika 15. Afrikanische Auswahl bevorzugt zu 85% die konfigurierten größeren/bekannteren Länder, sofern passende Kandidaten vorliegen. Andere vertraute Länder erhalten ein moderates höheres Subjektgewicht. Kein historischer Datensatz wird gelöscht. Flaggen bleiben ungewichtet; gezieltes Solo-Kategorietraining behält den breiten Pool. Freie Multiplayer-Kategorien bleiben erhalten; deren Serverauswahl verwendet die Gewichte auch bei einer einzigen Kategorie.

Weltwissen mischt Bevölkerung 40%, allgemeines Wissen 12%, Natur 18%, Fläche 12%, Binnenlage 9%, Kontinente 9%. Bevölkerung teilt sich im Auswahlverfahren 50/50 auf Länder und Städte. Fehlende regionale Kandidaten führen zur nachvollziehbaren Umverteilung; die Afrika-Zielquote bleibt bei vorhandenen Afrika-Kandidaten 15%. Neue Lernsubjekte werden innerhalb des gewählten Themen-/Regionalbereichs vor bereits gesehenen bevorzugt, danach die am längsten nicht gesehenen. In einer Runde wiederholt sich kein Lernsubjekt. Kleine regionale Schwierigkeitsgruppen können nach Ausschöpfung zu anderen Schwierigkeitsgraden führen; die tatsächliche Frage bestimmt weiterhin die Punkte.

## Reproduzierbare Simulation

Seed 20261110, jeweils 1.000 reguläre Runden à 12 Fragen. Nenner: Fragen mit einem zugeordneten Fokusland, ohne Flaggen und ohne globale Fragen ohne Landeszuordnung; nicht die Länder sämtlicher falscher Antwortoptionen.

| Kontinent | Vorher | Danach, neue Spieler |
|---|---:|---:|
| Afrika | 22,575% | 15,478% |
| Europa | 31,362% | 33,613% |
| Asien | 21,682% | 27,941% |
| Nordamerika | 11,769% | 9,976% |
| Südamerika | 6,950% | 9,487% |
| Ozeanien | 5,662% | 3,505% |

Über 1.000 aufeinanderfolgende Runden mit gespeicherter Historie: Afrika 15,290%, keine Wiederholung innerhalb einer Runde, 75 unmittelbar erneut vorkommende Lernsubjekte bei 12.000 Auswahlen. Die Afrika-Auswahl umfasst zu 88,1% die konfigurierten Schwerpunktländer. In den vier angesprochenen Kernkategorien sinkt der Anteil frisch von 23,227% auf 15,318%.

Zusätzlich 4.000 echte SQL-Auswahlen vor/nach der Serveränderung (1.000 je Hauptstädte, Karten, Silhouetten, Nachbarn): Afrika vorher 23,575%, danach 15,250%. Nachher: Europa 33,875%, Asien 27,525%, Nordamerika 10,125%, Südamerika 9,200%, Ozeanien 4,025%. Rohbelege: `POPULATION_SERVER_SELECTION.json`. Weitere 1.000 SQL-Auswahlen in Weltwissen ergaben 389 Bevölkerungsfragen, davon 194 Städte und 195 Länder; allgemeines Wissen und Natur/Fläche/Binnenlage/Kontinente bleiben vertreten.

## Tatsächlich ausgeführte Migrationen

1. `20261110201843_population_selection_helpers.sql`: private SECURITY INVOKER-Auswahlhilfen; kein EXECUTE für PUBLIC/anon/authenticated, Aufruf nur durch den bestehenden geprüften Spiel-RPC.
2. `20261110201852_population_seed.sql`: 120 neue IDs zunächst deaktiviert eingefügt; bestehende Fragen nicht überschrieben.
3. `20261110202728_population_balance_activate.sql`: bestehender Spiel-RPC ersetzt ausschließlich den nicht auf Flaggen bezogenen Auswahlblock; aktiviert die 120 geprüften IDs atomar. Gespeicherte Duellfragen, Antwortreihenfolge und Bewertungslogik bleiben erhalten.

Serverprüfung: 120 erwartet, 120 gespeichert, null Abweichungen zur geprüften Quelle. Unveränderte Prüfsummen aller 2.022 vorher vorhandenen Fragen einschließlich Aktivierungszustand, aller bisherigen Flaggen und aller 21 Nicht-QA-Profile vor/nach Aktivierung. Keine Profile, Spielstände, Antworten oder historischen Fragen gelöscht. Ein vor der Umstellung gestartetes, bereits beantwortetes QA-Duell wird nach der Aktivierung vollständig fortgesetzt; Einzelheiten im Multiplayer-Testbericht.

## Prüfungen

`npm test`: 50/50 erfolgreich; Produktionsbuild mit TypeScript erfolgreich. Enthalten: Quelldaten-Abgleich, Intervalle, Vergleichsabstände, eindeutige Lösungen, Referenzjahre, alle 195 Kontinentzuordnungen, Auswahlverteilung, Trainingsvielfalt, Punkte, Wiederherstellung und Alt-IDs. Alle 91 aufgenommenen Stadtdaten stimmen mit dem offiziellen CSV überein; 89 sind quizgeeignet. Keine neuen Sicherheits-Advisory-Befunde gegenüber der Ausgangslage; private Auswahlhilfen sind für Gastrollen nicht direkt aufrufbar.

Live-Browser: bestehende 0.5.2-Testrunde blieb beim angebotenen Update erhalten; Update-Button war während der Runde gesperrt und nach Abschluss verfügbar. Reguläres Update auf 0.6.0 ohne Neuinstallation; vorhandene lokale Statistik blieb sichtbar. Startseite zeigt 1.923 Fragen. Neue Bevölkerungsfrage einschließlich Jahr, UN-Quelle, Erklärung und korrekter 2-Punkte-Wertung geprüft; anschließende Antwortvorschau verändert Punkte nicht. Multiplayer-Prüfungen mit zwei unabhängigen anonymen Profilen werden in `POPULATION_MULTIPLAYER_TEST.json` dokumentiert.

## Spätere Aktualisierung

Offizielle Dateien beziehen, portable `scripts/population/prepare-countries.py` und `prepare-cities.py` mit dem gewünschten Referenzjahr ausführen, Stadtdaten auditieren, danach `build-questions.py` und Tests/Simulationen ausführen. Bei Ersetzung `--retire-replaced` verwenden: alte IDs bleiben als historische deaktivierte Fragen lesbar. `make-migrations.py` erzeugt zur Prüfung getrennte Hilfs-, Seed- und Aktivierungsvorlagen; tatsächliche Supabase-Versionsnummern erst nach erfolgreicher Ausführung übernehmen. Keine Rohdownloads oder Zugangsdaten werden im Repository gespeichert.
