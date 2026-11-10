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
 return dict(id=f'geo-v3-{category}-'+hashlib.sha256((category+':'+key).encode()).hexdigest()[:16],category=category,difficulty=difficulty,prompt=prompt,options=options,correct=options.index(correct),enabled=True,explanation=explanation,media=media,provenance=dict(sources=sources,subjectKey=subject or f'{category}:{key}',edition='geo-v3-2026-11',**extra))
def level(iso,index):
 familiar=set('DE FR GB ES IT US CA AU JP CN IN BR MX RU EG GR AT PT CH NL'.split())
 return 1 if iso in familiar else 2+index%2
category=sys.argv[1];out=[]
if category=='capitals':
 eligible=[iso for iso in flags if facts[iso]['capital']]
 for i,iso in enumerate(eligible):
  city=facts[iso]['capital'];name=flags[iso]['name'];candidates=nearby(iso,eligible);d=3 if iso in set('SI SK HR RS BA ME MK LT LV EE CG CD GN GW GQ'.split()) else level(iso,i)
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
 revealing={'915','135','65','599','1499','699','1483','1245','286'}
 cultural=[s for s in sites if s['kind']=='Cultural' and s['id'] not in used|revealing]
 reviewed=json.loads(Path('data/learning/landmark-difficulty.json').read_text())
 countries=sorted({s['iso'] for s in cultural},key=lambda c:(sum(q['provenance']['iso']==c for q in out),hashlib.sha256(c.encode()).hexdigest()))
 chosen=[]
 for iso in countries:
  s=next(s for s in cultural if s['iso']==iso)
  if len(s['name'])<=125:chosen.append(s)
  if len(chosen)==90:break
 assert len(chosen)==90
 for i,s in enumerate(chosen):
  iso=s['iso'];alternatives=nearby(iso)[:3]
  out.append(question(category,'unesco-'+s['id'],f'In welchem Land liegt die UNESCO-Kulturerbestätte „{s["name"]}“?',flags[iso]['name'],[flags[c]['name'] for c in alternatives],reviewed.get(s['id'],2+int(hashlib.sha256(s['id'].encode()).hexdigest()[:8],16)%2),f'„{s["name"]}“ ist eine UNESCO-Kulturerbestätte in {flags[iso]["name"]} ({geo[iso]["continent"]}). Die UNESCO führt sie unter der Listennummer {s["id"]}.',[s['source']],subject='landmark:'+s['id'],iso=iso,confusions=alternatives,siteId=s['id']))
elif category=='world':
 reviews=json.loads(Path('data/learning/world-review.json').read_text())
 originals=[q for q in json.loads(Path('data/questions.json').read_text()) if q['category']==category]
 for i,q in enumerate(originals):
  correct=q['options'][q['correct']];wrong=reviews[i][:3]
  out.append(question(category,'legacy-'+q['id'],q['prompt'],correct,wrong,q['difficulty'],reviews[i][3],q['provenance']['sources'],subject='world:legacy:'+q['id']))
 sites={s['id']:s for s in json.loads(Path('data/learning/unesco-sites.json').read_text())}
 ids='1 9 24 28 39 63 98 100 120 145 147 150 154 156 167 179 185 186 196 219 225 227 256 258 260 261 280 284 302 308 333 337 355 369 390 402 405 410 421 447'.split()
 assert len(ids)==40
 for i,sid in enumerate(ids):
  s=sites[sid];iso=s['iso'];wrong=nearby(iso)[:3]
  out.append(question(category,'nature-'+sid,f'In welchem Land liegt das UNESCO-gelistete Gebiet „{s["name"]}“?',flags[iso]['name'],[flags[c]['name'] for c in wrong],2+i%2,f'„{s["name"]}“ liegt in {flags[iso]["name"]}. Der UNESCO-Eintrag {sid} bestätigt diese Länderzuordnung.',[s['source']],subject='world:nature:'+sid,iso=iso,confusions=wrong,topic='Naturregionen'))
 # Relative area questions: exclude close numerical ties and ambiguous territorial cases.
 excluded=set('RU UA PS IL CY CN IN PK FR GB DK NL NO RS MA'.split())
 chosen=[]
 for iso in flags:
  if iso in excluded:continue
  smaller=[c for c in nearby(iso) if c not in excluded and geo[c]['continent']==geo[iso]['continent'] and facts[iso]['areaKm2']/3.5<facts[c]['areaKm2']<facts[iso]['areaKm2']/1.2]
  if len(smaller)<3:continue
  chosen.append((iso,smaller[:3]))
 # Deterministically spread selected subjects over the registry instead of taking an alphabetical prefix.
 chosen=sorted(chosen,key=lambda pair:hashlib.sha256(pair[0].encode()).hexdigest())[:40]
 assert len(chosen)==40
 for i,(iso,wrong) in enumerate(chosen):
  opts=[iso]+wrong;detail='; '.join(f'{flags[c]["name"]}: rund {round(facts[c]["areaKm2"]):,} km²'.replace(',','.') for c in sorted(opts,key=lambda c:-facts[c]['areaKm2']))
  out.append(question(category,'area-'+iso,'Welches dieser Länder hat die größte Gesamtfläche?',flags[iso]['name'],[flags[c]['name'] for c in wrong],2+i%2,'Gemeint ist die Gesamtfläche einschließlich Binnengewässern. '+detail+'. Die Werte sind gerundet; die Abstände sind deutlich größer als Rundungsunterschiede.',[COUNTRIES],subject='world:area:'+iso,iso=iso,confusions=wrong,topic='Länderflächen'))
 # Landlocked questions with coastal alternatives from the same geographic neighborhood.
 landlocked=[c for c in flags if facts[c]['landlocked'] and c not in excluded and c not in ('AZ','KZ','TM')]
 landlocked=sorted(landlocked,key=lambda c:hashlib.sha256(c.encode()).hexdigest())[:20]
 assert len(landlocked)==20
 for i,iso in enumerate(landlocked):
  wrong=[c for c in nearby(iso) if not facts[c]['landlocked'] and c not in excluded][:3]
  out.append(question(category,'landlocked-'+iso,'Welches dieser Länder hat keinen Zugang zum offenen Meer?',flags[iso]['name'],[flags[c]['name'] for c in wrong],2+i%2,f'{flags[iso]["name"]} ist ein Binnenstaat. '+', '.join(flags[c]['name'] for c in wrong)+' haben dagegen eine Meeresküste. Eine Seeküste an einem Binnengewässer ist kein Zugang zum offenen Meer.',[COUNTRIES],subject='world:landlocked:'+iso,iso=iso,confusions=wrong,topic='Binnenstaaten'))
 # Continent assignments are used only for countries without transcontinental or overseas ambiguity.
 excluded.update('TR GE AM AZ EG ID MY AU CL EC NZ PT ES US ZA'.split())
 eligible=[c for c in flags if c not in excluded]
 selected=sorted(eligible,key=lambda c:hashlib.sha256(('continent'+c).encode()).hexdigest())[:20]
 for i,iso in enumerate(selected):
  wrong=[c for c in nearby(iso,eligible) if geo[c]['continent']!=geo[iso]['continent']][:3]
  out.append(question(category,'continent-'+iso,f'Welches dieser Länder liegt in {geo[iso]["continent"]}?',flags[iso]['name'],[flags[c]['name'] for c in wrong],1,f'{flags[iso]["name"]} liegt in {geo[iso]["continent"]}. '+ '; '.join(flags[c]['name']+': '+geo[c]['continent'] for c in wrong)+'.',[NE],subject='world:continent:'+iso,iso=iso,confusions=wrong,topic='Kontinente'))
else:raise SystemExit('Category not implemented yet: '+category)
assert out and len({q['id'] for q in out})==len(out)
for q in out:assert 1<=q['difficulty']<=3 and len(q['provenance']['sources'])>0 and q['explanation']
Path('data/question-pool').mkdir(exist_ok=True);Path(f'data/question-pool/{category}.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(category,len(out),'questions', {d:sum(q['difficulty']==d for q in out) for d in [1,2,3]})
