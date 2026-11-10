from pathlib import Path
from decimal import Decimal
from collections import Counter
import json,csv,gzip,hashlib,sys
base=Path(__file__).resolve().parent;file=Path(sys.argv[2]) if len(sys.argv)>2 else base/'WUP2025-DB-DEGURBA-Cities-Population-Surface-Data.csv.gz';sourcefile=Path(sys.argv[1]) if len(sys.argv)>1 else Path('data/learning/population-cities.json');source=json.loads(sourcefile.read_text());year=source['source']['referenceYear'];wanted={c['cityCode']:c for c in source['cities']};found={}
with gzip.open(file,'rt',encoding='utf-8-sig',newline='') as f:
 for r in csv.DictReader(f):
  if r['Year']!=str(year) or int(r['City_Code']) not in wanted:continue
  id=int(r['City_Code']);c=wanted[id];assert id not in found
  value=int(Decimal(r['Pop'])*1000);assert value==c['population'],(c,value)
  found[id]={'cityCode':id,'name':c['name'],'population':value,'iso':r['ISO2_Code'],'plausibility':r['Pop_plausibility'],'areaKm2':r['AREA_km2']}
assert len(found)==len(wanted),(len(found),len(wanted))
audit={'download':'https://population.un.org/wup/assets/Download/Cities/WUP2025-DB-DEGURBA-Cities-Population-Surface-Data.csv.gz','sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'referenceYear':year,'checked':len(found),'mismatches':0,'plausibilityCounts':dict(Counter(r['plausibility'] for r in found.values())),'cities':[found[c['cityCode']] for c in source['cities']]}
Path('docs/POPULATION_CITY_SOURCE_AUDIT.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
for c in source['cities']:
 c['populationPlausibility']=found[c['cityCode']]['plausibility'];c['quizEligible']=c['populationPlausibility']!='Low'
source['source']['plausibilityDownload']=audit['download'];source['source']['plausibilitySourceSha256']=audit['sha256']
note='Die UN-Metadaten zur Plausibilität werden übernommen. Einträge mit der Kennzeichnung Low sollen nicht automatisch für Quizfragen verwendet werden.'
if note not in source['definition']['notesDe']:source['definition']['notesDe'].append(note)
sourcefile.write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')
print('Crosschecked all',len(found),'selected cities against official full CSV; zero mismatches');print(audit['plausibilityCounts']);print('Excluded Low:',[c['name'] for c in source['cities'] if not c['quizEligible']])
