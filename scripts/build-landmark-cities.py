"""Generate city questions from audited UNESCO sites, GeoNames places and licensed media."""
import hashlib
import json
import random
import sys
import unicodedata
from pathlib import Path
from zipfile import ZipFile

base=Path('data/learning')
rows=[line.split('|') for line in (base/'landmark-city-selection.tsv').read_text().splitlines()
      if line and not line.startswith('#')]
sites={v['id']:v for v in json.loads((base/'unesco-sites.json').read_text())}
photos=json.loads((base/'landmark-city-photos.json').read_text())
registry={r['iso']:r['name'] for r in json.loads(Path('data/flags/registry.json').read_text())}
historical=json.loads(Path('data/questions.json').read_text())
def normalize(s):
 return ''.join(c for c in unicodedata.normalize('NFKD',s).casefold() if c.isalnum())

needed={}
for id,iso,landmark,city,wrong,illustration in rows:
 for name in [city,*wrong.split(';')]:
  needed.setdefault(iso,{})[normalize(name)]=name

matches={}
download=Path(sys.argv[1])
with ZipFile(download) as archive, archive.open('cities500.txt') as cities:
 for line in cities:
  fields=line.decode().rstrip('\n').split('\t')
  id,primary,ascii_name,alternates,lat,lon,feature,kind,iso=fields[:9]
  if iso not in needed or feature!='P' or kind in {'PPLX','PPLH','PPLQ','PPLW'}:continue
  names={normalize(v) for v in [primary,ascii_name,*alternates.split(',')]}
  for match in names & needed[iso].keys():
   key=(iso,match)
   name=needed[iso][match]
   score=(normalize(primary)==match,int(fields[14] or 0))
   if key not in matches or score>matches[key][0]:
    matches[key]=(score,{'name':name,'iso':iso,'point':[float(lat),float(lon)],
                   'source':f'https://www.geonames.org/{id}/','geonameId':int(id),'sourceName':primary})

missing=[(iso,name) for iso,names in needed.items() for match,name in names.items() if (iso,match) not in matches]
assert not missing,missing
def city_info(iso,name):
 return matches[iso,normalize(name)][1]

result=[]
for index,(id,iso,landmark,city,wrong,illustration) in enumerate(rows):
 assert id=='91' or sites[id]['iso']==iso,(id,iso)
 assert all(normalize(n) not in normalize(landmark) for n in [city,*wrong.split(';')] if len(normalize(n))>3)
 photo=photos.get(id)
 original=next((q for q in historical if illustration and q['category']=='landmarks' and illustration in q['prompt']),None)
 choices=[city_info(iso,name) for name in [city,*wrong.split(';')]]
 digest=hashlib.sha256(('unesco-city:'+id).encode()).hexdigest()
 random.Random(digest).shuffle(choices)
 media=None
 if photo:
  media={'type':'image','src':photo['path'],'alt':'Foto des gesuchten Wahrzeichens','license':photo['license']}
 elif original:
  media=dict(original['media'],alt='Illustration des gesuchten Wahrzeichens')
 if media:
  prompt='In welcher Stadt befindet sich dieses Bauwerk?'
 else:
  prompt=f'In welcher Stadt befindet sich dieses Wahrzeichen – {landmark}?'
 sources=[f'https://whc.unesco.org/en/list/{id}/',city_info(iso,city)['source']]
 if id=='91':sources.insert(0,'https://colosseo.it/en/area/the-colosseum/')
 p={'sources':sources,'subjectKey':'landmark:'+id,'iso':iso,'siteId':id,
    'cityChoices':choices,'landmarkName':landmark}
 if photo:
  p['imageCredit']={key:photo[key] for key in ['source','title','license','licenseUrl','author']}
 result.append({'id':'landmark-city-v1-'+digest[:20],'category':'landmarks',
  'difficulty':1 if index<8 else 2 if index<26 else 3,'prompt':prompt,
  'options':[c['name'] for c in choices],'correct':next(i for i,c in enumerate(choices) if c['name']==city),
  'enabled':True,'explanation':f'{landmark[0].upper()+landmark[1:]} befindet sich in {city} ({registry[iso]}).',
  'media':media,'provenance':p})
assert len(result)==42
assert len({q['id'] for q in result})==42
Path('data/question-pool/landmark-cities.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(base/'landmark-city-catalog.json').write_text(json.dumps({
 'source':'https://download.geonames.org/export/dump/cities500.zip',
 'license':'https://creativecommons.org/licenses/by/4.0/',
 'sha256':hashlib.sha256(download.read_bytes()).hexdigest(),
 'cities':[v[1] for _,v in sorted(matches.items())],
},ensure_ascii=False,indent=2)+'\n')
print(len(result),'landmarks,',sum(q['media'] is not None for q in result),'with images')
