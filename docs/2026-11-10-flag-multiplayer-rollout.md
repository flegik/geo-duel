# Flaggen-Multiplayer: produktive Aktivierung am 10.11.2026

Projekt: `qngzwhesblhzprurxelv`. Bestehende URL: https://geoduel-flegik.flegik.chatgpt.site

## Veröffentlichter Frontend-Stand

Sites-Version **4**, unveränderte URL. Grundlage: GitHub `82d1e8e3d5d7c31affcdb5abed52d01d120560eb`; Hosting-Quellcommit `08081c0156b42c6883f7d87becae83506f821be7`.
Vor dem Datenbank-Rollout wurden das öffentlich abgerufene JavaScript `/assets/index-PSzikxeZ.js` und sämtliche **195** SVGs unter `/media/flags/` byteweise mit dem geprüften lokalen Build/Quellstand verglichen: identisch. Alle **24** vorhandenen Tests bestanden. Der Produktionsbuild war bei der Veröffentlichung erfolgreich.

Verifikationsgrenze: Der vorhandene Live-Testbrowser zeigte weiterhin den alten, vom Service Worker gecachten 210-Fragen-Stand. Eine Interaktionsprüfung des neuen Singleplayers in diesem Browser gelang daher nicht; dies wird nicht als bestandener Browser-Test ausgewiesen. Keine Browserdaten oder Spielstände wurden gelöscht. Die Prüfung der öffentlich ausgelieferten neuen Anwendung und aller 195 Assets erfolgte unabhängig davon per HTTP.

## Tatsächlich ausgeführte Migrationen

Die zehn vorbereiteten SQL-Dateien wurden unverändert per Supabase-Migrationstool in folgender Reihenfolge ausgeführt. Jede Ausführung meldete Erfolg. Die Versionsnummern unten stammen aus der tatsächlichen produktiven Migrationshistorie; sie unterscheiden sich von den Datumspräfixen der vorbereiteten Dateien.

| Reihenfolge | Datei unter `supabase/migrations/` | Produktive Version |
| --- | --- | --- |
| 1 | `20261109_flag_registry_schema.sql` | `20261110005532` |
| 2 | `20261109_flag_seed_0.sql` | `20261110005543` |
| 3 | `20261109_flag_seed_1.sql` | `20261110005549` |
| 4 | `20261109_flag_seed_2.sql` | `20261110005554` |
| 5 | `20261109_flag_seed_3.sql` | `20261110005600` |
| 6 | `20261109_flag_seed_4.sql` | `20261110005613` |
| 7 | `20261109_flag_seed_5.sql` | `20261110005618` |
| 8 | `20261109_flag_seed_6.sql` | `20261110005623` |
| 9 | `20261109_flag_seed_7.sql` | `20261110005629` |
| 10 | `20261109_flag_activate.sql` | `20261110005649` |
| 11 | `20261110005902_flag_option_order_alias_fix.sql` | `20261110005902` |

Zeitangaben in den Supabase-Versionen sind UTC. Die sieben ersten Seed-Dateien fügten jeweils 75, die letzte 60 Fragen ein. Vor Aktivierung wurden 585 deaktivierte neue Fragen und 195 Länder nachgewiesen. Die Aktivierung prüfte die vollständige ID-Liste in einer Transaktion, deaktivierte die alten Flaggenfragen und aktivierte die neuen.

Die vorhandenen Migrationen nicht anhand ihrer Dateinamen blind erneut mit `db push` ausführen: Die obige Zuordnung dokumentiert die bereits auf Produktion angewandten Versionen.

### Notwendige Korrektur aus dem Online-Test

Der erste Live-Test scheiterte beim Duellstart. Die vorbereitete Funktion verwendete `array_agg(v ...)` bei gleichzeitig deklarierter PL/pgSQL-Variable `v`. Ein isolierter SQL-Test reproduzierte Fehler **42702: column reference "v" is ambiguous**.

Die zusätzliche Migration ersetzt ausschließlich diesen Ausdruck durch `array_agg(choice.option_index order by random()) from generate_series(0,3) as choice(option_index)` innerhalb derselben RPC-Funktion. Ein isolierter SQL-Test des qualifizierten Ausdrucks bestand. Die Generatorvorlage `scripts/flag-schema.sql` enthält dieselbe Korrektur. Bereits angewandte ursprüngliche SQL-Dateien wurden nicht nachträglich umgeschrieben.

## Verifizierter Datenbestand

| Prüfung | Ergebnis |
| --- | ---: |
| Neue aktive Flaggenfragen | 585 |
| Alte erhaltene, deaktivierte Flaggenfragen | 30 |
| Länder / unterschiedliche neue Flaggenassets | 195 / 195 |
| Varianten je Land | genau 3 |
| Ungültige oder doppelte Antwortoptionen | 0 |
| Neue Fragen mit Schwierigkeit 1 / 2 / 3 | 40 / 232 / 313 |
| Unveränderte Fragen anderer Kategorien | 180 |

Vor und unmittelbar nach den Migrationen wurden nach stabilen Schlüsseln geordnete JSON-Zeilen per MD5 verglichen. Neue additive Spalten wurden beim Vergleich ausgenommen. Die Hashes und Anzahlen blieben identisch:

| Bestand vor Rollout | Anzahl | Unveränderter Hash |
| --- | ---: | --- |
| Profile | 11 | `038af5d81d0c7b25ec13be5d741161d1` |
| Räume / Duellverläufe | 10 | `08c19a6c35f8257dcc159a441e243ec1` |
| Antworten mit Ergebnissen | 88 | `210f855bec413209e1bdc1e2658d2f66` |
| Teilnehmer | 19 | `3468b4531b2688c10a2c69e402c0d626` |
| Zugeordnete historische Fragen | 44 | `3be0b3b7ed56e613bd3f131cb9c1d202` |
| Fragen anderer Kategorien | 180 | `4924afa2704b4269333a7da4ee888f54` |

Auch die fachlichen Felder der 30 alten Flaggenfragen blieben unverändert (`7ec96eddff628969c03d237380a8c3c8`); nur Aktivierung und die vorbereitete Subject-Metadaten-Ergänzung wurden ausgenommen. Alle 44 historischen Fragenzuordnungen erhielten die Identitätsreihenfolge `[0,1,2,3]`, sodass frühere Antwortindizes weiter gültig sind. Nach dem Online-Test wurden die ursprünglichen Profile, Räume und Antworten erneut anhand des Rollout-Zeitpunkts abgegrenzt und mit denselben Hashes bestätigt.

## Vollständiger Online-Test

Ausführung gegen das echte Projekt mit zwei unabhängigen anonymen Auth-Sitzungen über den bestehenden `game`-Edge-Gateway und `geoduel`-RPC, ohne Service-Role-Schlüssel.

```sh
node --env-file=.env.production --import tsx scripts/test-flag-multiplayer.ts
```

Ergebnis: **PASS**, vollständiges Duell `f628bd78-0e11-49cd-a9d7-b13ab56b0057`, 12 Fragen, Kategorien Flaggen / Nachbarländer / Hauptstädte / Sehenswürdigkeiten, **24:0 Punkte**. Spieler 1 beantwortete bewusst alles richtig, Spieler 2 alles falsch.

| Neue Flagge | ISO | Schwierigkeit / korrekte Punkte | Gemeinsame Antwortpermutation |
| --- | --- | ---: | --- |
| Vietnam | VN | 1 | `[1,3,0,2]` |
| Serbien | RS | 2 | `[3,0,2,1]` |
| Salomonen | SB | 3 | `[1,3,0,2]` |

Geprüft: identische Frage-IDs, Medien, Schwierigkeit und Antwortreihenfolge für beide Gäste; keine Länderwiederholung im Duell; serverseitige Wertung anhand der umsortierten korrekten Antwort; null Punkte bei falschen Antworten; idempotente Doppelantwort; keine Lösungsdaten vor Abgabe; Gegnerpunkte bis Abschluss verborgen; erster Spieler wartet; gemeinsamer Abschluss; Auflösungen; dauerhafte Statistik; Wiederverbindung mit derselben Sitzung.

Maschinenlesbares Ergebnis: [verification/2026-11-10-flag-duel.json](verification/2026-11-10-flag-duel.json).

Die Tests hinterließen vier neu angelegte QA-Gastprofile, ein abgebrochenes Testduell aus dem Fehlversuch und ein abgeschlossenes Testduell. Es wurden keine bestehenden Profile oder Duelle zur Prüfung verwendet oder gelöscht.

## Weitere Prüfungen und Umfang

`npm test`: 24/24 bestanden. `npm run check`: erfolgreich. `git diff --check`: erfolgreich.

Die Sicherheits-Advisories vor und nach dem vorbereiteten Rollout zeigten dieselben bestehenden Hinweise: RLS ohne direkte Policies im privaten `game`-Schema, die absichtlich authentifiziert aufrufbare SECURITY-DEFINER-Spiel-RPC, anonyme Teilnehmer-Events und ausgeschalteter Passwort-Leakschutz. Keine Berechtigungen oder Auth-Einstellungen wurden verändert. `anon` hat kein EXECUTE auf `public.geoduel`; `authenticated` besitzt das für Gastspiele notwendige Recht. Bestehende Hinweise: https://supabase.com/docs/guides/database/database-linter und https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Keine neue Datenbank, keine Änderungen am Frageninhalt anderer Kategorien und keine neuen Spielfunktionen. Es erfolgte kein erneutes Frontend-Deployment für diese reine Backend-Aktivierung.
