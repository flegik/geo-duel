"""Build city-map questions from the pinned UN WUP F21 workbook and Kyoto coordinate.
Use --anchors-only to refresh the world anchors without rebuilding questions.
"""
import hashlib
import json
import math
import re
import sys
from pathlib import Path

WORKBOOK = 'https://population.un.org/wup/assets/Download/Cities/WUP2025-F21-DEGURBA-Cities_Pop.xlsx'
SHA = '3a96030d87aec6c1c50f658d5321067d6345e1ab936c5d2854524f972caa75c0'
KYOTO = 'https://www.wikidata.org/wiki/Q34600'
ATLAS = 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/'
# Curated comparison regions. The source of country anchor locations is the atlas polygon,
# while these interior reference coordinates fix the zoom independent of the city answer.
regions = [
 'DE AT CH CZ PL NL BE', 'FR BE CH ES IT', 'GB IE FR BE NL', 'ES PT FR IT',
 'IT AT CH FR SI HR', 'SE NO DK FI EE', 'GR TR BG AL MK',
 'JP KR CN KP', 'VN TH MY ID PH KH', 'IN NP BD PK LK BT',
 'IR SA JO AE IQ OM', 'AU NZ FJ PG',
 'US CA MX CU', 'CU MX PA CR JM', 'BR AR CL UY PY BO',
 'PE CO EC BR BO', 'AR CL UY PY BR',
]
base = Path('data/learning')
pool = Path('data/question-pool/city-maps.json')
atlas = json.loads(Path('data/atlas/geography.json').read_text())
countries = {x['iso']:x['name'] for x in json.loads(Path('data/flags/registry.json').read_text())}

def rings(path):
 return [[tuple(map(float, match)) for match in re.findall(r'(?:M|L)(-?[\d.]+),(-?[\d.]+)', part)]
         for part in re.findall(r'M[^M]+', path)]

def area(ring):
 return abs(sum(x*y2-y*x2 for (x,y),(x2,y2) in zip(ring, ring[1:]+ring[:1]))) / 2

def intersections(ring, y):
 return [x+(y-y0)*(x2-x)/(y2-y0) for (x,y0),(x2,y2) in zip(ring,ring[1:]+ring[:1])
         if (y0>y)!=(y2>y)]

def anchor(iso):
 # The world paths use x=2(lon+180), y=2(90-lat). The country silhouettes
 # have their own local viewBox and cannot be inverted to geographic coordinates.
 features=[rings(f['path']) for f in atlas['world'] if f['iso']==iso]
 feature=max(features,key=lambda rs:max(map(area,rs)))
 main_ring=max(feature,key=area)
 low,high=min(y for _,y in main_ring),max(y for _,y in main_ring)
 best=None
 for ratio in [.35,.45,.5,.55,.65]:
  y=low+(high-low)*ratio
  main_xs=sorted(intersections(main_ring,y))
  xs=sorted(x for ring in feature for x in intersections(ring,y))
  # Match the SVG even-odd fill, including inland holes, and stay on the main landmass.
  for x0,x1 in zip(xs[::2],xs[1::2]):
   x=(x0+x1)/2
   if any(a<x<b for a,b in zip(main_xs[::2],main_xs[1::2])):
    score=(x1-x0)-abs(y-(low+high)/2)*.6
    if best is None or score>best[0]:best=(score,x,y)
 if best is None:raise ValueError(f'No interior world anchor for {iso}')
 _,x,y=best
 lat,lon=round(90-y/2,5),round(x/2-180,5)
 assert -90<=lat<=90 and -180<=lon<=180,(iso,lat,lon)
 return [lat,lon]

def write_json(path,data):
 path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

group_codes=set(' '.join(regions).split())
anchors={iso:anchor(iso) for iso in sorted(group_codes)}
assert all(atlas['countries'][iso]['continent']!='Afrika' for iso in anchors)
write_json(base/'map-country-anchors.json',anchors)
if sys.argv[1:]==['--anchors-only']:
 sys.exit(0)

from openpyxl import load_workbook
# Existing IDs are also stored by active duels. Keep their answer assignments
# when rebuilding; the corrected anchors are used for future questions.
previous={question['id']:question for question in json.loads(pool.read_text())} if pool.exists() else {}
def distance(first,second):
 a,b,c,d=map(math.radians,(*first,*second))
 return 2*math.asin(min(1,math.sqrt(math.sin((a-c)/2)**2+math.cos(a)*math.cos(c)*math.sin((b-d)/2)**2)))

file=Path(sys.argv[1])
assert hashlib.sha256(file.read_bytes()).hexdigest()==SHA
rows=load_workbook(file,read_only=True,data_only=True)['Data'].values
ix={str(value):i for i,value in enumerate(next(rows))}
selected={}
for line in (base/'map-city-selection.tsv').read_text().splitlines():
 iso,city_list=line.split(' ',1)
 for i,item in enumerate(city_list.split('|')):
  city_id,name=item.split(':',1)
  selected[int(city_id)]=(iso,name,min(3,1+i//2))
cities={}
for row_number,row in enumerate(rows,2):
 code=row[ix['City_Code']]
 if code not in selected:continue
 iso,name,level=selected[code]
 assert row[ix['ISO2_Code']]==iso,(iso,code)
 point=[round(row[ix['PWCent_Latitude']],5),round(row[ix['PWCent_Longitude']],5)]
 assert -90<=point[0]<=90 and -180<=point[1]<=180
 cities[code]={'iso':iso,'name':name,'level':level,'point':point,'source':WORKBOOK,
               'sourceName':row[ix['City_Name']],'sourceRow':row_number,'sourceId':str(code)}
assert len(cities)==len(selected)
entity=json.loads(Path(sys.argv[2]).read_text())['entities']['Q34600']
coords=entity['claims']['P625'][0]['mainsnak']['datavalue']['value']
assert entity['labels']['en']['value']=='Kyoto' and coords['globe'].endswith('/Q2')
cities[0]={'iso':'JP','name':'Kyoto','level':2,'point':[round(coords['latitude'],5),round(coords['longitude'],5)],
           'source':KYOTO,'sourceId':'Q34600'}

def build(city):
 iso,name=city['iso'],city['name']
 assert atlas['countries'][iso]['continent']!='Afrika'
 group=next(r.split() for r in regions if iso in r.split())
 options=sorted([c for c in group if c!=iso],key=lambda c:distance(anchors[c],city['point']))[:3]
 assert len(options)==3
 key=iso+':'+city['sourceId']
 digest=hashlib.sha256(key.encode()).hexdigest()
 codes=sorted([iso,*options],key=lambda c:hashlib.sha256((digest+c).encode()).hexdigest())
 question_id='city-map-v1-'+digest[:20]
 if question_id in previous:
  existing=previous[question_id]
  options=existing['provenance']['confusions']
  names_to_codes={countries[code]:code for code in [iso,*options]}
  codes=[names_to_codes[name] for name in existing['options']]
  assert codes[existing['correct']]==iso
 return {
  'id':question_id,'category':'maps','difficulty':city['level'],
  'prompt':f'In welchem dieser Länder liegt {name}?','options':[countries[c] for c in codes],
  'correct':codes.index(iso),'enabled':True,'explanation':f'{name} liegt in {countries[iso]}. Der leuchtende Punkt zeigt die Lage der Stadt.',
  'media':{'type':'city-map','src':'choice:city-map','alt':'Regionalkarte mit vier Ländern zur Auswahl','license':'Natural Earth – Public Domain'},
  'provenance':{'sources':[city['source'],ATLAS],'subjectKey':'maps:'+iso,'iso':iso,'confusions':options,
                'cityLocation':{k:v for k,v in city.items() if k not in ['source','level']}},
 }
result=[build(cities[c]) for c in selected]+[build(cities[0])]
write_json(pool,result)
print(len(result),'city map questions')
