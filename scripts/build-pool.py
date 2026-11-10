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
elif category in ('silhouettes','maps'):
 groups=json.loads(Path('data/learning/shape-groups.json').read_text())
 def form(code):
  g=geo[code];return math.log(max(.00001,g['width']/g['height']))
 for i,iso in enumerate(flags):
  d=level(iso,i);ranked=nearby(iso)
  group=next((g for g in groups if iso in g['members']),None)
  if category=='silhouettes':
   candidate=group['members'] if group else ranked[:20]
   candidate=[c for c in candidate if c!=iso]
   candidate.sort(key=lambda c:(abs(form(iso)-form(c))+.15*math.log1p(distance(iso,c)/500),c))
   alternative=candidate[:3]
   assert len(alternative)==3
  else:
   same=[c for c in ranked if geo[c]['continent']==geo[iso]['continent']]
   alternative=same[:3] if d==3 else [same[j] for j in ([0,2,3] if d==2 else [1,3,5])]
  prompt='Welches Land zeigt dieser Umriss?' if category=='silhouettes' else 'Welches Land ist auf der Karte mintfarben markiert?'
  media=dict(type='atlas-outline' if category=='silhouettes' else 'atlas-map',src='atlas:'+iso,alt='Länderumriss ohne Beschriftung' if category=='silhouettes' else 'Karte mit hervorgehobenem Land',license='Natural Earth – Public Domain')
  desc=f"Der Umriss gehört zu {flags[iso]['name']}. Vergleiche Küstenverlauf, Seitenverhältnis und Teilflächen." if category=='silhouettes' else f"Markiert ist {flags[iso]['name']} ({geo[iso]['continent']}). Die anderen Optionen liegen in derselben geografischen Großregion."
  out.append(question(category,iso,prompt,flags[iso]['name'],[flags[c]['name'] for c in alternative],d,desc,[NE],media,subject=f'{category}:{iso}',iso=iso,confusions=alternative,confusionGroup=group['id'] if group and category=='silhouettes' else 'regional-nearest'))
elif category=='borders':
 audit=json.loads(Path('data/learning/borders-audit.json').read_text());verified=audit['verified'];blocked=audit['blocked']
 for i,iso in enumerate(flags):
  neighbors=verified[iso]
  if not neighbors:continue
  candidates=[c for c in nearby(iso) if c not in blocked[iso] and c not in audit['excluded'] and geo[c]['continent']==geo[iso]['continent']]
  if len(candidates)<3:continue
  for j,correct in enumerate(sorted(neighbors,key=lambda c:distance(iso,c))[:2]):
   out.append(question(category,iso+'-yes-'+correct,f'Welches dieser Länder hat eine direkte Landgrenze mit {flags[iso]["name"]}?',flags[correct]['name'],[flags[c]['name'] for c in candidates[:3]],level(iso,i),f'{flags[iso]["name"]} und {flags[correct]["name"]} teilen eine direkte Landgrenze. Die drei anderen Länder grenzen auf dem Landweg nicht an {flags[iso]["name"]}. Seegrenzen sind hier nicht gemeint.',[COUNTRIES,NE],subject='borders:'+iso,iso=iso,confusions=candidates[:3],borderAnswer=correct,relation='adjacent'))
  if len(neighbors)>=3:
   correct=candidates[0];wrong=sorted(neighbors,key=lambda c:distance(iso,c))[:3]
   out.append(question(category,iso+'-no-'+correct,f'Welches dieser Länder hat KEINE direkte Landgrenze mit {flags[iso]["name"]}?',flags[correct]['name'],[flags[c]['name'] for c in wrong],3,f'{flags[correct]["name"]} hat keine direkte Landgrenze mit {flags[iso]["name"]}. '+', '.join(flags[c]['name'] for c in wrong)+' grenzen dagegen direkt an dieses Land. Seegrenzen zählen nicht.',[COUNTRIES,NE],subject='borders:'+iso,iso=iso,confusions=wrong,borderAnswer=correct,relation='not-adjacent'))
elif category=='landmarks':
 import re
 sites=json.loads(Path('data/learning/unesco-sites.json').read_text());by_id={s['id']:s for s in sites};used=set()
 originals=[q for q in json.loads(Path('data/questions.json').read_text()) if q['category']==category]
 for i,q in enumerate(originals):
  correct=q['options'][q['correct']];iso=next(c for c in flags if flags[c]['name']==correct)
  sid=re.search(r'/list/(\d+)',q['provenance']['sources'][0]).group(1)
  assert sid=='91' or by_id[sid]['iso']==iso,(q['id'],sid)
  used.add(sid);alternatives=nearby(iso)[:3]
  title=q['prompt'].split('„')[1].split('“')[0]
  out.append(question(category,'legacy-'+q['id'],q['prompt'],correct,[flags[c]['name'] for c in alternatives],q['difficulty'],f'{title} liegt in {correct} ({geo[iso]["continent"]}). Die Illustration ist eine stilisierte Darstellung, kein Foto.',q['provenance']['sources']+(['https://colosseo.it/en/area/the-colosseum/'] if sid=='91' else []),q['media'],subject='landmark:'+sid,iso=iso,confusions=alternatives,siteId=sid))
 # Round robin across countries prevents the extension being dominated by a few large countries.
 cultural=[s for s in sites if s['kind']=='Cultural' and s['id'] not in used]
 countries=sorted({s['iso'] for s in cultural},key=lambda c:(sum(q['provenance']['iso']==c for q in out),c))
 chosen=[]
 for iso in countries:
  s=next(s for s in cultural if s['iso']==iso)
  if len(s['name'])<=125:chosen.append(s)
  if len(chosen)==90:break
 assert len(chosen)==90
 for i,s in enumerate(chosen):
  iso=s['iso'];alternatives=nearby(iso)[:3]
  out.append(question(category,'unesco-'+s['id'],f'In welchem Land liegt die UNESCO-Kulturerbestätte „{s["name"]}“?',flags[iso]['name'],[flags[c]['name'] for c in alternatives],2+i%2,f'„{s["name"]}“ ist eine UNESCO-Kulturerbestätte in {flags[iso]["name"]} ({geo[iso]["continent"]}). Die UNESCO führt sie unter der Listennummer {s["id"]}.',[s['source']],subject='landmark:'+s['id'],iso=iso,confusions=alternatives,siteId=s['id']))
else:raise SystemExit('Category not implemented yet: '+category)
assert out and len({q['id'] for q in out})==len(out)
for q in out:assert 1<=q['difficulty']<=3 and len(q['provenance']['sources'])>0 and q['explanation']
Path('data/question-pool').mkdir(exist_ok=True);Path(f'data/question-pool/{category}.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(category,len(out),'questions', {d:sum(q['difficulty']==d for q in out) for d in [1,2,3]})
