"""Build city-map questions from the pinned UN WUP F21 workbook and Kyoto coordinate."""
import hashlib
import json
import math
import re
import sys
from pathlib import Path
from openpyxl import load_workbook

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
facts = json.loads((base/'countries.json').read_text())
geo = json.loads(Path('data/atlas/geography.json').read_text())['countries']
countries = {x['iso']:x['name'] for x in json.loads(Path('data/flags/registry.json').read_text())}

# Use a verified interior point of the largest atlas polygon. Largest area excludes overseas pieces.
def area(ring):
 return abs(sum(x*y2-y*x2 for (x,y),(x2,y2) in zip(ring, ring[1:]+ring[:1]))) / 2

def rings(iso):
 return [[tuple(map(float, m)) for m in re.findall(r'(?:M|L)(-?[\d.]+),(-?[\d.]+)', part)]
         for part in geo[iso]['path'].split('M') if part for part in ['M'+part]]

def anchor(iso):
 ring=max(rings(iso),key=area)
 ys=sorted({y for x,y in ring})
 target=(ys[0]+ys[-1])/2
 best=None
 for ratio in [.35,.45,.5,.55,.65]:
  y=ys[0]+(ys[-1]-ys[0])*ratio+.000001
  xs=sorted(x+(y-y0)*(x2-x)/(y2-y0) for (x,y0),(x2,y2) in zip(ring,ring[1:]+ring[:1])
            if (y0>y)!=(y2>y))
  for x0,x1 in zip(xs[::2],xs[1::2]):
   score=(x1-x0)-abs(y-target)*.6
   if best is None or score>best[0]:best=(score,(x0+x1)/2,y)
 if best is None:raise ValueError(iso)
 return [round(90-best[2]/2,5),round(best[1]/2-180,5)]

group_codes=set(' '.join(regions).split())
anchors={iso:anchor(iso) for iso in sorted(group_codes)}
assert all(geo[iso]['continent']!='Afrika' for iso in anchors)
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
 assert geo[iso]['continent']!='Afrika'
 group=next(r.split() for r in regions if iso in r.split())
 options=sorted([c for c in group if c!=iso],key=lambda c:distance(anchors[c],city['point']))[:3]
 assert len(options)==3
 key=iso+':'+city['sourceId']
 digest=hashlib.sha256(key.encode()).hexdigest()
 codes=sorted([iso,*options],key=lambda c:hashlib.sha256((digest+c).encode()).hexdigest())
 return {
  'id':'city-map-v1-'+digest[:20],'category':'maps','difficulty':city['level'],
  'prompt':f'In welchem dieser Länder liegt {name}?','options':[countries[c] for c in codes],
  'correct':codes.index(iso),'enabled':True,'explanation':f'{name} liegt in {countries[iso]}. Der leuchtende Punkt zeigt die Lage der Stadt.',
  'media':{'type':'city-map','src':'choice:city-map','alt':'Regionalkarte mit vier Ländern zur Auswahl','license':'Natural Earth – Public Domain'},
  'provenance':{'sources':[city['source'],ATLAS],'subjectKey':'maps:'+iso,'iso':iso,'confusions':options,
                'cityLocation':{k:v for k,v in city.items() if k not in ['source','level']}},
 }
result=[build(cities[c]) for c in selected]+[build(cities[0])]
for p,data in [(base/'map-country-anchors.json',anchors),(Path('data/question-pool/city-maps.json'),result)]:
 p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(len(result),'city map questions')
