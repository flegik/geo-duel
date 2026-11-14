# Deutschland

- Verwaltungsgrenzen und Amtlicher Gemeindeschlüssel: [BKG VG250-EW, 31.12.2024](https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-250-000-mit-einwohnerzahlen-stand-31-12-vg250-ew-31-12.html). © [BKG](https://www.bkg.bund.de) 2026, [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0). [Quellenverzeichnis](https://sg.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf). Für GeoDuel auf Festland, reguläre Inselgebiete und Binnengewässer gefiltert (GF=4), topologieerhaltend vereinfacht, projiziert und eingefärbt. Die Nachbarschaften beruhen auf gemeinsamen Segmenten der ursprünglichen Landesgrenzen. Seeseitige Küstengewässer zählen bei Nachbarfragen nicht mit.
- Landeshauptstädte: [Bundeszentrale für politische Bildung, Föderalismus und Bundesländer](https://www.bpb.de/themen/politisches-system/24-deutschland/40429/foederalismus-und-bundeslaender/) und Amtliche Gemeindeschlüssel im BKG-Datensatz.
- Landesflaggen: Gemeinfreie Darstellungen von Wikimedia Commons. `states.tsv` nennt je Bundesland die verwendete Variante und die amtliche Beschreibung. Verwendet wird je eine Landesflagge, in Bayern die Rautenflagge und in Bremen die rot-weiß gestreifte Flagge ohne aufgesetztes Wappen. Für Sachsen-Anhalt wird die seit 2017 gültige Landesflagge mit Wappen verwendet. Dateireferenzen und Prüfsummen der lokal gespeicherten SVGs stehen in `states.json`. Metadaten und Titel wurden aus den Originaldateien entfernt.

## Aufbereitung

1. `vg250-ew:vg250_lan` als GeoJSON in EPSG:4326 vom [BKG-WFS](https://sgx.geodatenzentrum.de/wfs_vg250-ew?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities) als `lands.json` speichern. Die 16 Landesflaggen unter den Commons-Dateinamen in denselben Quellordner laden.
2. `mapshaper lands.json -filter 'gf==4' -simplify 8% keep-shapes -o format=geojson lands-simplified.json` im Quellordner ausführen.
3. Aus dem Projektverzeichnis `node scripts/germany/prepare-states.mjs <Quellordner>` und `node scripts/germany/foundation.mjs` ausführen.

## Städte

Die 180 Stadtzuordnungen verwenden BKG VG250-EW und die amtlichen Gemeindeschlüssel. Die 120 Kartenpunkte basieren auf GeoNames (CC BY 4.0) und wurden über AGS, Ortsnamen und einen Punkt-in-Polygon-Test mit den unvereinfachten Landesgrenzen verbunden. Koordinaten sind [Längengrad, Breitengrad] in WGS84.
Abruf: BKG-Layer vg250-ew:vg250_gem als gemeinden.csv mit PROPERTYNAME=ags,gen,bez,ewz,kfl,ibz,ade,ars,gf,bsg,lkz. GeoNames: https://download.geonames.org/export/dump/DE.zip (DE.txt).
Aus dem Projekt: node scripts/germany/prepare-cities.mjs <Quellordner>, danach node scripts/germany/cities.mjs.
