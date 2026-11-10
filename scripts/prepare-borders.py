"""Conservative land-border audit: mutual country records AND a shared Natural Earth line.
Disputed/overseas-sensitive countries excluded, and union of both sources blocks distractors.
"""
import sys,json
from pathlib import Path
sys.path.insert(0,'/workspace/scratch/dfff2f908647/geo-deps')
from shapely.geometry import shape
facts=json.loads(Path('data/learning/countries.json').read_text());raw=json.loads(Path(sys.argv[1]).read_text())['features'];geoms={}
for f in raw:
 iso=f['properties']['ISO_A2_EH']
 if iso not in facts or f['properties']['TYPE'] in ('Dependency','Lease'):continue
 g=shape(f['geometry']).buffer(0)
 if iso not in geoms or g.area>geoms[iso].area:geoms[iso]=g
exclude=set('PS IL RU UA CY IN PK CN BT KP KR MA ES GB FR NL US DK SD SS RS AM AZ GE YE SA AE OM QA BH EG TR GR'.split())
shared={a:[] for a in facts};blocked={a:set(facts[a]['borders']) for a in facts}
for i,a in enumerate(facts):
 for b in list(facts)[i+1:]:
  # Polygon intersections must contain a line, not just a point or overlap.
  inter=geoms[a].boundary.intersection(geoms[b].boundary)
  if inter.length>0.0001:
   blocked[a].add(b);blocked[b].add(a)
   if a not in exclude and b not in exclude and b in facts[a]['borders'] and a in facts[b]['borders']:
    shared[a].append(b);shared[b].append(a)
for a in facts:
 for b in facts[a]['borders']:
  if b in blocked:blocked[b].add(a)
Path('data/learning/borders-audit.json').write_text(json.dumps({'policy':'Shared mapped land boundary and mutual country records; conservative exclusions for disputed/overseas definitions. No maritime borders.','excluded':sorted(exclude),'verified':shared,'blocked':{a:sorted(v) for a,v in blocked.items()}},ensure_ascii=False,indent=2)+'\n')
print('Verified',sum(len(v) for v in shared.values())//2,'undirected land borders;',sum(bool(v) for v in shared.values()),'eligible countries')
