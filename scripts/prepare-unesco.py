"""Retain factual UNESCO site identifiers/names/country attribution, never copyrighted photos/descriptions."""
import json,sys,hashlib
from pathlib import Path
raw=json.loads(Path(sys.argv[1]).read_text());flags={c['iso'] for c in json.loads(Path('data/flags/registry.json').read_text())}
out=[]
for s in raw:
 codes=s.get('iso_codes') or []
 if len(codes)!=1 or codes[0] not in flags or s.get('transboundary')!='False' or int(s['date_inscribed'])>2024:continue
 out.append(dict(id=s['id_no'],name=s['name_en'],iso=codes[0],kind=s['category'],year=int(s['date_inscribed']),source='https://whc.unesco.org/en/list/'+s['id_no']+'/'))
Path('data/learning/unesco-sites.json').write_text(json.dumps(sorted(out,key=lambda x:int(x['id'])),ensure_ascii=False,indent=2)+'\n')
with Path('data/learning/SOURCES.md').open('a') as f:f.write('\n## UNESCO site metadata\nOfficial UNESCO World Heritage dataset: https://data.unesco.org/explore/dataset/whc001/ . Retrieved 2026-11-10, SHA-256 '+hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()+'. Only factual site names, list IDs, inscription year and single-country attribution retained. Transboundary sites excluded. No photos or copyrighted descriptive text copied. New text questions intentionally have no unlicensed image. Existing original CC0 illustrations retained only with the same site.\n')
print(len(out),'single-country UNESCO metadata rows')
