"""Derive a compact major-lake layer aligned with the existing Natural Earth atlas.
Usage: python scripts/build-atlas-water.py ne_10m_lakes.geojson
"""
import json,sys,hashlib,subprocess,tempfile
from pathlib import Path
source=Path(sys.argv[1])
with tempfile.TemporaryDirectory() as temp:
 simplified=Path(temp)/'lakes.json'
 subprocess.run(['ogr2ogr','-f','GeoJSON',str(simplified),str(source),'-simplify','0.015'],check=True)
 features=json.loads(simplified.read_text())['features']
out=[]
for f in features:
 if f['properties']['scalerank']>5:continue
 g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
 path=''.join('M'+'L'.join(f'{(x+180)*2:.3f},{(90-y)*2:.3f}' for x,y,*_ in ring)+'Z' for poly in polys for ring in poly)
 out.append({'path':path,'name':f['properties'].get('name') or f['properties'].get('name_en') or ''})
Path('data/atlas/water.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False)+'\n')
Path('data/atlas/WATER_SOURCES.md').write_text('''# Major lake layer

Natural Earth 1:10m Lakes + Reservoirs, scale rank <= 5, GDAL simplification 0.015 degrees; Public Domain.
https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-lakes/
https://www.naturalearthdata.com/about/terms-of-use/
Source: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson
Retrieved 2026-11-10. SHA-256: '''+hashlib.sha256(source.read_bytes()).hexdigest()+'''

Same equirectangular coordinates as the existing atlas world layer. No live map service or external image requests. Generalized reference geometry; no claim of current seasonal lake extents. Smaller lakes and relief are intentionally omitted for readability.
''')
print(len(out),'major lakes;',Path('data/atlas/water.json').stat().st_size,'bytes')
