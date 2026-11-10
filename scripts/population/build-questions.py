"""Deterministic population questions from central UN source extracts; no hand-typed counts.
Run from repository root. Revision/year/value changes create new IDs, preserving old duel rows.
"""
import json,hashlib,random,math,itertools,sys
from pathlib import Path
countries=json.loads(Path('data/learning/population-countries.json').read_text());cities=json.loads(Path('data/learning/population-cities.json').read_text());registry={f['iso']:f for f in json.loads(Path('data/flags/registry.json').read_text())};geo=json.loads(Path('data/atlas/geography.json').read_text())['countries']
subjects=countries['suggestedQuestionSubjects']
countryEntities=[dict(id=iso,iso=iso,name=registry[iso]['name'],population=v['population']) for iso,v in countries['countries'].items()]
# A familiar global city selection. Definitions/plausibility are uniform; no Low rows admitted.
cityQuotas={'Europa':18,'Asien':17,'Nordamerika':7,'Südamerika':5,'Afrika':9,'Ozeanien':4}
cityEntities=[dict(id=c['id'],iso=c['iso'],name=c['name'],population=c['population'],cityCode=c['cityCode'],plausibility=c['populationPlausibility']) for c in cities['cities'] if c['quizEligible']]
citySubjects=[]
for continent,count in cityQuotas.items():
 eligible=[c for c in cityEntities if geo[c['iso']]['continent']==continent]
 # Retain a broad city/country spread before admitting several cities in the same country.
 ranked=sorted(eligible,key=lambda c:(sum(x['iso']==c['iso'] for x in citySubjects),hashlib.sha256(c['id'].encode()).hexdigest()))
 # Explicit familiar anchors include the user's Berlin/Tokio examples and major global hubs.
 anchors=['Berlin','Tokio','London','Paris','New York City','Mexiko-Stadt','São Paulo','Sydney','Auckland','Kairo','Lagos','Nairobi','Casablanca']
 ranked.sort(key=lambda c:c['name'] not in anchors)
 citySubjects.extend(ranked[:count])
assert len(citySubjects)==60 and len({c['id'] for c in citySubjects})==60
previous=json.loads(Path('data/question-pool/population.json').read_text()) if Path('data/question-pool/population.json').exists() else []
out=[]
def fmt(n):
 value=n/1_000_000
 if value>=1:return f'{value:.1f}'.replace('.',',')+' Mio.'
 return f'{n/1000:.0f}'.replace('.',',')+' Tsd.'
def plain(n):return f'{n:g}'.replace('.',',')
def bandLabel(a,b):
 unit=1_000_000 if b>=1_000_000 else 1000
 return f'{plain(a/unit)} bis unter {plain(b/unit)} '+('Mio.' if unit==1_000_000 else 'Tsd.')
def niceStep(value):
 target=value*.25;power=10**math.floor(math.log10(target));return min([1,2,5,10],key=lambda n:abs(n*power-target))*power
def make(kind,entity,variant,prompt,options,correctIndex,level,evidence,details):
 source=countries if kind=='country' else cities['source'];year=source['referenceYear'];definition='country-total-wpp-medium' if kind=='country' else 'city-un-degurba'
 extra='Gesamtbevölkerung, beide Geschlechter und alle Altersgruppen; mittlere UN-Projektion für den 1. Juli '+str(year)+'.' if kind=='country' else 'Stets das urban zusammenhängende Zentrum nach UN-DEGURBA, Mitte '+str(year)+': keine Verwaltungsgrenze und keine Metropolregion.'
 explanation=details+' '+extra
 pop=dict(kind=kind,variant=variant,referenceYear=year,referenceDate=source['referenceDate'],definition=definition,status='projection' if kind=='country' else 'modelled-estimate',unit='persons',sourceDataset='WPP2024' if kind=='country' else 'WUP2025-F21-DEGURBA',values=evidence)
 if variant=='estimate':pop['ranges']=options
 values=[o['label'] if isinstance(o,dict) else o for o in options];correct=values[correctIndex];rng=random.Random(kind+entity['id']+variant+str(year));rng.shuffle(values)
 identity=json.dumps([kind,entity['id'],variant,prompt,values,correct,pop],ensure_ascii=False,sort_keys=True)
 id='population-v1-'+hashlib.sha256(identity.encode()).hexdigest()[:20]
 sources=[source['sourceUrl'],source['downloadUrl']] if kind=='country' else [source['url'],source['download'],source['definitions']]
 out.append(dict(id=id,category='world',difficulty=level,prompt=prompt,options=values,correct=values.index(correct),explanation=explanation,media=None,enabled=True,provenance=dict(sources=sources,subjectKey=f'population:{kind}:{entity["id"]}',iso=entity['iso'],topic='Bevölkerung',population=pop)))
for kind,allEntities,chosenIds in [('country',countryEntities,subjects),('city',cityEntities,[c['id'] for c in citySubjects])]:
 chosen=[next(c for c in allEntities if c['id']==id) for id in chosenIds]
 anchors=['DE','CA','US','FR','GB','CN','IN','JP','BR','AU','NZ','EG','ZA','NG','MA','KE'] if kind=='country' else [c['id'] for c in citySubjects if c['name'] in ['Berlin','Tokio','London','Paris','New York City','Mexiko-Stadt','São Paulo','Sydney','Auckland','Kairo','Lagos','Nairobi','Casablanca']]
 estimateIds=list(anchors)
 for c in sorted(chosen,key=lambda c:hashlib.sha256(c['id'].encode()).hexdigest()):
  if len(estimateIds)==24:break
  if c['id'] not in estimateIds:estimateIds.append(c['id'])
 rest=[c for c in chosen if c['id'] not in estimateIds];rest.sort(key=lambda c:hashlib.sha256(('type:'+c['id']).encode()).hexdigest())
 year=(countries if kind=='country' else cities['source'])['referenceYear']
 context=f'UN-Projektion, 1. Juli {year}' if kind=='country' else f'urbanes Zentrum nach UN-DEGURBA, Mitte {year}'
 noun='Land' if kind=='country' else 'Stadt'
 for c in chosen:
  if c['id'] not in estimateIds:continue
  value=c['population'];step=niceStep(value);lo=math.floor(value/step)*step
  # Exact source point must remain comfortably inside the interval.
  if min(value-lo,lo+step-value)<step*.1:lo-=step*.25
  start=max(0,lo-step);correct=round((lo-start)/step)
  ranges=[dict(label=bandLabel(start+j*step,start+(j+1)*step),minInclusive=int(start+j*step),maxExclusive=int(start+(j+1)*step)) for j in range(4)]
  assert sum(r['minInclusive']<=value<r['maxExclusive'] for r in ranges)==1
  index=next(i for i,r in enumerate(ranges) if r['minInclusive']<=value<r['maxExclusive'])
  label=c['name'] if kind=='country' else c['name']+' ('+registry[c['iso']]['name']+')'
  make(kind,c,'estimate',f'In welchem Bereich liegt die Einwohnerzahl von {label} ungefähr? ({context})',ranges,index,2,[c],f'{label}: rund {fmt(value)} nach dem angegebenen UN-Datensatz.')
 # 24 comparisons: max/min in alternating directions; gap is an explicit fairness rule.
 for i,c in enumerate(rest[:24]):
  maxQuestion=i%2==0;value=c['population'];ratio=3 if i<6 else 1.25
  available=[a for a in allEntities if a['id']!=c['id'] and (a['population']<=value/ratio if maxQuestion else a['population']>=value*ratio)]
  if len(available)<3:
   maxQuestion=not maxQuestion
   available=[a for a in allEntities if a['id']!=c['id'] and (a['population']<=value/ratio if maxQuestion else a['population']>=value*ratio)]
  # Prefer same continent and similar scale; broaden only if that cannot provide four unique entities.
  available.sort(key=lambda a:(geo[a['iso']]['continent']!=geo[c['iso']]['continent'],abs(math.log(a['population']/value)),a['id']))
  wrong=available[:3];assert len(wrong)==3
  evidence=[c]+wrong
  differences=[max(value,a['population'])/min(value,a['population']) for a in wrong]
  level=3 if min(differences)<1.6 else 2 if min(differences)<3 else 1
  prompt=f'Welches dieser Länder hat die '+('meisten' if maxQuestion else 'wenigsten')+f' Einwohner? ({context})' if kind=='country' else 'Welche dieser Städte hat die '+('meisten' if maxQuestion else 'wenigsten')+f' Einwohner? ({context})'
  details='; '.join(e['name']+': rund '+fmt(e['population']) for e in sorted(evidence,key=lambda e:-e['population']))+'.'
  make(kind,c,'compare-max' if maxQuestion else 'compare-min',prompt,[e['name'] for e in evidence],0,level,evidence,details)
 # 12 threshold questions mix above/below; every alternative stays >=20% away from the threshold.
 for i,c in enumerate(rest[24:]):
  above=i%2==0;value=c['population'];threshold=niceStep(value)*2
  # Choose an intelligible threshold on the appropriate side of the correct source value.
  threshold=(math.floor(value/niceStep(value)) if above else math.ceil(value/niceStep(value))+1)*niceStep(value)
  if above:
   while value<threshold*1.2:threshold-=niceStep(value)
   assert threshold>0
   others=[a for a in allEntities if a['id']!=c['id'] and a['population']<=threshold*.8]
  else:
   while value>threshold*.8:threshold+=niceStep(value)
   others=[a for a in allEntities if a['id']!=c['id'] and a['population']>=threshold*1.2]
  others.sort(key=lambda a:(geo[a['iso']]['continent']!=geo[c['iso']]['continent'],abs(math.log(a['population']/threshold)),a['id']))
  wrong=others[:3];assert len(wrong)==3
  evidence=[c]+wrong;word='mehr' if above else 'weniger'
  prompt=(f'Welches dieser Länder hat {word} als {fmt(threshold)} Einwohner? ' if kind=='country' else f'Welche dieser Städte hat {word} als {fmt(threshold)} Einwohner? ')+f'({context})'
  details='; '.join(e['name']+': rund '+fmt(e['population']) for e in sorted(evidence,key=lambda e:-e['population']))+'.'
  level=1 if min(max(c['population'],e['population'])/min(c['population'],e['population']) for e in wrong)>=3 else 2
  make(kind,c,'threshold-above' if above else 'threshold-below',prompt,[e['name'] for e in evidence],0,level,evidence,details)
  out[-1]['provenance']['population']['threshold']=int(threshold)
assert len(out)==120 and len({q['id'] for q in out})==120
assert all(len(set(q['options']))==4 for q in out)
if '--retire-replaced' in sys.argv:
 retired=json.loads(Path('data/question-pool/retired.json').read_text());known={q['id'] for q in retired};current={q['id'] for q in out}
 retired.extend({**q,'enabled':False} for q in previous if q['id'] not in current and q['id'] not in known)
 Path('data/question-pool/retired.json').write_text(json.dumps(retired,ensure_ascii=False,indent=2)+'\n')
Path('data/question-pool/population.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('Built',len(out),'population questions: countries/cities 60/60;', {d:sum(q['difficulty']==d for q in out) for d in [1,2,3]})
