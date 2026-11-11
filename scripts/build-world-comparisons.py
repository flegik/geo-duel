"""Build audited, deterministic geography comparisons from pinned WDI and UN data."""
import hashlib
import json
import math
import random
import sys
from collections import Counter
from pathlib import Path

base=Path(sys.argv[1])
year=2023
indicators={'density':'EN.POP.DNST','land':'AG.LND.TOTL.K2','population':'SP.POP.TOTL'}
world_bank='https://data.worldbank.org/indicator/'
registry={x['iso']:x['name'] for x in json.loads(Path('data/flags/registry.json').read_text())}
continent={k:v['continent'] for k,v in json.loads(Path('data/atlas/geography.json').read_text())['countries'].items()}
city_source=json.loads(Path('data/learning/population-cities.json').read_text())
eligible=set('''
AT BE CH CZ DE DK ES FI FR GB GR HR HU IE IS IT NL NO PL PT RO SE SK SI UA BG EE LT LV
BD CN IN ID IR IQ JP KH KR LK MY MN NP OM PH PK SA SG TH TR VN AE JO KZ UZ
CA CR CU DO GT HN HT JM MX NI PA US
AR BO BR CL CO EC PE PY UY VE
AU FJ NZ PG SB WS VU
'''.split())
existing={tuple(sorted(q['options'])) for file in ['world','population'] for q in
          json.loads(Path(f'data/question-pool/{file}.json').read_text())}
records={}
sources={}
for metric,code in indicators.items():
 path=base/(metric+'.json')
 raw=path.read_bytes()
 response=json.loads(raw)
 assert response[0]['pages']==1
 source=f'https://api.worldbank.org/v2/country/all/indicator/{code}?date={year}&format=json&per_page=350'
 sources[metric]={'series':code,'url':world_bank+code,'download':source,'sha256':hashlib.sha256(raw).hexdigest(),'year':year}
 records[metric]=[
  {'id':iso,'iso':iso,'name':registry[iso],'value':r['value']}
  for r in response[1] if (iso:=r['country']['id']) in eligible and r['date']==str(year)
  and r['value'] is not None and r['value']>0 and continent[iso]!='Afrika']
records['cityPopulation']=[
 {'id':c['id'],'iso':c['iso'],'name':c['name'],'value':c['population']}
 for c in city_source['cities'] if c['quizEligible'] and continent[c['iso']]!='Afrika']
sources['cityPopulation']={'series':'WUP2025-F21','url':city_source['source']['url'],
 'download':city_source['source']['download'],'sha256':city_source['source']['sha256'],'year':2025}
names={k:{c['name']:c for c in v} for k,v in records.items()}
assert all(len(v)==len(names[k]) for k,v in records.items())
assert set(c['iso'] for c in records['density'])<=eligible
selected=set(existing)
rules=(('max',0,1),('min',3,2),('rank2',1,3),('rank3',2,3))
format_info={
 'density':('Bevölkerungsdichte','Einw./km² Landfläche',1.22),
 'land':('Landfläche','km²',1.17),
 'population':('Einwohnerzahl','Einwohner',1.24),
 'cityPopulation':('Einwohnerzahl urbaner Zentren','Einwohner',1.25),
}
def format_value(metric,value):
 if metric=='density':
  if value<10:return f'{value:.1f}'.replace('.',',')
  return f'{round(value):,}'.replace(',','.')
 if metric=='land':
  return f'{round(value/100)*100:,}'.replace(',','.')
 if value>=1_000_000:return f'{value/1_000_000:.1f}'.replace('.',',')+' Mio.'
 return f'{round(value/1000)*1000:,}'.replace(',','.')

def question(metric,sort_rule,rank,level,options):
 unit_name,unit,minimum=format_info[metric]
 source=sources[metric]
 ordered=sorted(options,key=lambda x:-x['value'])
 answer=ordered[rank]
 keys=tuple(sorted(x['name'] for x in options))
 selected.add(keys)
 key=metric+':'+sort_rule+':'+':'.join(sorted(x['id'] for x in options))
 digest=hashlib.sha256(key.encode()).hexdigest()
 shuff=list(ordered)
 random.Random(digest).shuffle(shuff)
 noun='Stadt' if metric=='cityPopulation' else 'Land'
 quant=('die größte' if metric=='land' else 'die höchste') if rank==0 else ('die kleinste' if metric=='land' else 'die niedrigste')
 label={'density':'Bevölkerungsdichte','land':'Landfläche','population':'Einwohnerzahl','cityPopulation':'Einwohnerzahl'}[metric]
 if rank in (0,3):
  prompt=f'Welches Land hat {quant} {label}?' if noun=='Land' else f'Welche Stadt hat {quant} {label}?'
 else:
  prompt=(f'Welches Land liegt bei der {label} auf Platz {rank+1}?' if noun=='Land'
          else f'Welche Stadt liegt bei der {label} auf Platz {rank+1}?')
  prompt+=' Sortierung absteigend.'
 if metric=='cityPopulation':prompt+=' Urbane Zentren, UN 2025.'
 else:prompt+=f' Weltbank, {source["year"]}.'
 values=[dict(c,display=format_value(metric,c['value'])+' '+unit) for c in ordered]
 comparisons=' · '.join(f'{c["name"]} ({c["display"]})' for c in values)
 explanation=f'{answer["name"]} ist richtig. Vergleichswerte, absteigend: {comparisons}.'
 if metric=='density':explanation+=' Die Weltbank bezieht die Einwohnerzahl auf die Landfläche ohne Binnengewässer.'
 if metric=='land':explanation+=' Gezählt wird Landfläche ohne Binnengewässer.'
 if metric=='cityPopulation':explanation+=' Die UN zählt urbane Zentren nach DEGURBA.'
 return {'id':'world-compare-v1-'+digest[:20],'category':'world','difficulty':level,
  'prompt':prompt,'options':[c['name'] for c in shuff],'correct':shuff.index(answer),'enabled':True,
  'explanation':explanation,'media':None,'provenance':{
    'sources':[source['url'],source['download']],'subjectKey':'world:comparison:'+digest[:20],
    'topic':'Größenvergleiche','iso':answer['iso'],
    'comparison':{'metric':metric,'label':unit_name,'year':source['year'],'unit':unit,
                  'rule':sort_rule,'rank':rank+1,'minimumRatio':minimum,'values':values},
  }}

result=[]
regions=['Europa','Asien','Nordamerika','Südamerika','Ozeanien']
for metric,items in records.items():
 min_ratio=format_info[metric][2]
 rng=random.Random(metric+':2026-11')
 focus_counts=Counter()
 option_counts=Counter()
 for ri,(rule,rank,level) in enumerate(rules):
  for index in range(4):
   preferred=regions[(ri*4+index)%len(regions)]
   best=None
   for i in range(2600):
    same_region=[x for x in items if continent[x['iso']]==preferred]
    source=same_region if i<900 and len(same_region)>=4 and index!=3 else items
    choices=rng.sample(source,4)
    key=tuple(sorted(x['name'] for x in choices))
    if key in selected:continue
    order=sorted(choices,key=lambda c:-c['value'])
    if min(a['value']/b['value'] for a,b in zip(order,order[1:]))<min_ratio:continue
    if len({format_value(metric,c['value']) for c in choices})!=4:continue
    country=order[rank]['iso']
    max_min=order[0]['value']/order[-1]['value']
    score=7*(continent[country]==preferred)-5*focus_counts[country]-sum(option_counts[c['id']] for c in choices)*.35-abs(math.log(max_min)-1.65)*1.35
    if best is None or score>best[0]:best=(score,choices,country)
   assert best,(metric,rule,index)
   _,options,focus=best
   result.append(question(metric,rule,rank,level,options))
   focus_counts[focus]+=1
   option_counts.update(x['id'] for x in options)
assert len(result)==64
assert len({q['id'] for q in result})==64
catalog={metric:{'source':sources[metric],'records':[
 record for record in records[metric] if any(record['id']==value['id'] for q in result
  if q['provenance']['comparison']['metric']==metric for value in q['provenance']['comparison']['values'])
]} for metric in records}
for path,data in [(Path('data/learning/world-comparison-sources.json'),catalog),(Path('data/question-pool/world-comparisons.json'),result)]:
 path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
