"""Build local Atlas SVG paths from Natural Earth 10m GeoJSON.
Usage: python scripts/build-atlas-geography.py path/to/ne_10m_admin_0_countries.geojson
Requires GDAL ogr2ogr; data license: Public Domain.
"""
import json,math,hashlib,sys,subprocess,tempfile
from pathlib import Path
source=Path(sys.argv[1])
with tempfile.TemporaryDirectory() as temp:
 simplified=Path(temp)/'countries.json'
 subprocess.run(['ogr2ogr','-f','GeoJSON',str(simplified),str(source),'-simplify','0.05'],check=True)
 features=json.loads(simplified.read_text())['features']
registry=json.loads(Path('data/flags/registry.json').read_text())
lookup={f['properties']['ISO_A2_EH']:f for f in features if f['properties']['TYPE'] not in ['Dependency','Lease']}
def rings(f):
 g=f['geometry'];return [r for p in (g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]) for r in p]
def path(rs,project):
 return ''.join('M'+'L'.join(','.join(str(round(v,3)) for v in project(x,y)) for x,y,*_ in r)+'Z' for r in rs if len(r)>3)
world=[{'iso':f['properties']['ISO_A2_EH'],'path':path(rings(f),lambda x,y:((x+180)*2,(90-y)*2))} for f in features]
names={'Asia':'Asien','Europe':'Europa','Africa':'Afrika','North America':'Nordamerika','South America':'Südamerika','Oceania':'Ozeanien','Antarctica':'Antarktika'}
countries={}
for country in registry:
 iso=country['iso'];f=lookup[iso];rs=rings(f);points=[p for r in rs for p in r];xs=sorted(set((p[0]+360)%360 for p in points));_,i=max(((xs[(i+1)%len(xs)]-x)%360,i) for i,x in enumerate(xs));start=xs[(i+1)%len(xs)];ys=[p[1] for p in points];cos=max(.05,math.cos(math.radians((min(ys)+max(ys))/2)))
 def project(x,y):return (((x-start)%360)*cos,-y)
 pts=[project(x,y) for x,y,*_ in points];minx=min(x for x,y in pts);miny=min(y for x,y in pts);width=max(x for x,y in pts)-minx;height=max(y for x,y in pts)-miny
 assert width>0 and height>0
 continent=f['properties']['CONTINENT']
 if continent not in names:continent=f['properties']['REGION_UN']
 countries[iso]={'continent':names[continent],'path':path(rs,lambda x,y:(project(x,y)[0]-minx,project(x,y)[1]-miny)),'width':width,'height':height}
Path('data/atlas').mkdir(exist_ok=True)
Path('data/atlas/geography.json').write_text(json.dumps({'countries':countries,'world':world},separators=(',',':')))
Path('data/atlas/SOURCES.md').write_text('''# Atlas-Geometrien

Natural Earth Admin 0 Countries, 1:10m; Public Domain.
https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
https://www.naturalearthdata.com/about/terms-of-use/
Quelle: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
Abgerufen: 2026-11-10. Original SHA-256: '''+hashlib.sha256(source.read_bytes()).hexdigest()+'''

Zuordnung über ISO_A2_EH; Dependencies und Lease-Geometrien werden für Hauptumrisse ausgeschlossen (z. B. Frankreich statt Clipperton). Weltkarte enthält alle Geometrien als Kontext. Kontinent aus CONTINENT, bei der Datensatz-Kategorie Seven seas aus REGION_UN (Seychellen/Mauritius: Afrika, Malediven: Asien). Deutsche Übersetzung dieser Attribute. Keine zusätzlichen Staaten außerhalb des Flaggenregisters im Katalog.

GDAL-Vereinfachung 0,05 Grad. Weltkarte equirektangular; Umrisse mit minimaler Längengradspanne am Datumswechsel und Kosinuskorrektur der mittleren Breite. Binnenringe bleiben erhalten (evenodd). Grenzen sind kartografische Darstellungen, keine rechtliche Festlegung. Kleine Staaten werden zusätzlich im vergrößerten Umriss gezeigt; Landesflächen werden nicht künstlich vergrößert.
''')
print(len(countries),'countries;',Path('data/atlas/geography.json').stat().st_size,'bytes')
