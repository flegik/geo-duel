"""Reproducible, category-scoped geography pool builder; no network access.
Usage: python scripts/build-pool.py capitals|silhouettes|maps|borders|landmarks|world
"""
import json,math,random,sys,hashlib
from pathlib import Path
registry=json.loads(Path('data/flags/registry.json').read_text());flags={c['iso']:c for c in registry};facts=json.loads(Path('data/learning/countries.json').read_text());geo=json.loads(Path('data/atlas/geography.json').read_text())['countries']
UN='https://unstats.un.org/unsd/demographic-social/products/dyb/documents/DYB2024/table08.xls'
COUNTRIES='https://github.com/mledoze/countries';NE='https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/'
def distance(a,b):
 lat,lon=facts[a]['latlng'];lat2,lon2=facts[b]['latlng'];p,q=math.radians(lat),math.radians(lat2);dl=math.radians(lon2-lon)
 return 6371*2*math.asin(min(1,math.sqrt(math.sin((q-p)/2)**2+math.cos(p)*math.cos(q)*math.sin(dl/2)**2)))
def nearby(iso,eligible=None):
 candidates=[c for c in (eligible or list(flags)) if c!=iso]
 return sorted(candidates,key=lambda c:(geo[c]['continent']!=geo[iso]['continent'],distance(iso,c),c))
def question(category,key,prompt,correct,wrong,difficulty,explanation,sources,media=None,subject=None,**extra):
 options=[correct]+wrong;assert len(options)==4 and len(set(options))==4,(key,options)
 rng=random.Random(hashlib.sha256(key.encode()).hexdigest());rng.shuffle(options)
 return dict(id=f'geo-v3-{category}-{key}',category=category,difficulty=difficulty,prompt=prompt,options=options,correct=options.index(correct),enabled=True,explanation=explanation,media=media,provenance=dict(sources=sources,subjectKey=subject or f'{category}:{key}',edition='geo-v3-2026-11',**extra))
def level(iso,index):
 familiar=set('DE FR GB ES IT US CA AU JP CN IN BR MX RU EG GR AT PT CH NL'.split())
 return 1 if iso in familiar else 2+index%2
category=sys.argv[1];out=[]
if category=='capitals':
 eligible=[iso for iso in flags if facts[iso]['capital']]
 for i,iso in enumerate(eligible):
  city=facts[iso]['capital'];name=flags[iso]['name'];candidates=nearby(iso,eligible);d=level(iso,i)
  # Tight neighboring-country capitals on hard questions; still regional on easy questions.
  offsets=[0,1,2] if d==3 else [0,2,4] if d==2 else [1,3,5]
  alternatives=[candidates[min(n,len(candidates)-1)] for n in offsets]
  assert len(set(alternatives))==3
  out.append(question(category,iso+'-city',f'Was ist die Hauptstadt von {name}?',city,[facts[c]['capital'] for c in alternatives],d,f'{city} ist die Hauptstadt von {name}. Die übrigen Optionen sind Hauptstädte anderer Länder derselben geografischen Umgebung.',[UN,COUNTRIES],subject=f'capital:{iso}',iso=iso,confusions=alternatives))
  out.append(question(category,iso+'-country',f'Zu welchem Land gehört die Hauptstadt {city}?',name,[flags[c]['name'] for c in alternatives],d,f'{city} ist die Hauptstadt von {name}.',[UN,COUNTRIES],subject=f'capital:{iso}',iso=iso,confusions=alternatives))
else:raise SystemExit('Category not implemented yet: '+category)
assert out and len({q['id'] for q in out})==len(out)
for q in out:assert 1<=q['difficulty']<=3 and len(q['provenance']['sources'])>0 and q['explanation']
Path('data/question-pool').mkdir(exist_ok=True);Path(f'data/question-pool/{category}.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(category,len(out),'questions', {d:sum(q['difficulty']==d for q in out) for d in [1,2,3]})
