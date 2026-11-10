"""Prepare auditable country facts, matching capitals against UN DYB table 8.
python scripts/prepare-learning-facts.py countries.json table08.xls
"""
import sys,json,re,unicodedata,hashlib
from pathlib import Path
from lxml import etree
raw=json.loads(Path(sys.argv[1]).read_text());registry=json.loads(Path('data/flags/registry.json').read_text());by2={r['cca2']:r for r in raw};by3={r['cca3']:r['cca2'] for r in raw};names={r['iso']:r['name'] for r in registry}
def norm(s):return re.sub('[^a-z]','',unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().lower())
ns={'s':'urn:schemas-microsoft-com:office:spreadsheet'};doc=etree.parse(sys.argv[2]);capitalRows={};current=''
for row in doc.xpath('//s:Worksheet[1]/s:Table/s:Row',namespaces=ns):
 for cell in row[:1]:
  text=''.join(cell.itertext()).strip();style=cell.get('{'+ns['s']+'}StyleID')
  if style=='sCountryName':current=text;capitalRows.setdefault(current,[])
  elif style=='sCityName' and text.upper()==text and len(text)>2:capitalRows[current].append(text)
alias={'KR':'Republic of Korea','KP':"Democratic People's Republic of Korea",'VN':'Viet Nam','MD':'Republic of Moldova','TZ':'United Republic of Tanzania','IR':'Iran','SY':'Syrian Arab Republic','LA':"Lao People's Democratic Republic",'BN':'Brunei Darussalam','CZ':'Czechia','TR':'Türkiye','CD':'Democratic Republic of the Congo','RU':'Russian Federation','US':'United States of America','GB':'United Kingdom'}
exclude=set('ZA LK BO CH NL BJ MY SZ NR IL PS ID GQ YE SD'.split())
translations={'Vienna':'Wien','Rome':'Rom','Prague':'Prag','Warsaw':'Warschau','Copenhagen':'Kopenhagen','Beijing':'Peking','Moscow':'Moskau','Athens':'Athen','Lisbon':'Lissabon','Cairo':'Kairo','Mexico City':'Mexiko-Stadt','Tokyo':'Tokio','Brasília':'Brasília','Bucharest':'Bukarest','Budapest':'Budapest','Belgrade':'Belgrad','Kyiv':'Kyjiw','Damascus':'Damaskus','Tirana':'Tirana','Algiers':'Algier','City of San Marino':'San Marino'}
facts={};audit=[]
for f in registry:
 iso=f['iso'];r=by2[iso];possible=[r['name']['common'],r['name']['official'],alias.get(iso,'')]
 matches=[(country,cities) for country,cities in capitalRows.items() if any(p and (norm(country.split(' - ')[0]).rstrip('abcdefghijklmnopqrstuvwxyz')==norm(p) or norm(country.split(' - ')[0])==norm(p)) for p in possible)]
 # Footnote digits vanish through normalization; only exact country aliases qualify.
 cap=r['capital'][0] if len(r['capital'])==1 else None
 verified=cap and iso not in exclude and any(norm(cap) in norm(city) for _,cities in matches for city in cities)
 facts[iso]={'latlng':r['latlng'],'areaKm2':r['area'],'subregion':r['subregion'],'landlocked':r['landlocked'],'capital':translations.get(cap,cap) if verified else None,'borders':[by3[c] for c in r['borders'] if c in by3 and by3[c] in names]}
 audit.append({'iso':iso,'capitalIncluded':bool(verified),'unCountryRows':[c for c,_ in matches],'unCapitalRows':[city for _,cities in matches for city in cities],'excludedComplexCase':iso in exclude})
Path('data/learning/countries.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n');Path('data/learning/capital-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
Path('data/learning/SOURCES.md').write_text('''# Country facts

Country attributes: https://github.com/mledoze/countries (ODbL-1.0; derived country database under the same license, attribution required).
Capitals are included only when matched against uppercase capital-city entries in UN Demographic Yearbook 2024 table 8: https://unstats.un.org/unsd/demographic-social/products/dyb/documents/DYB2024/table08.xls . Complex/transition/disputed cases excluded rather than treated as single unqualified capitals. German city spellings are explicitly mapped in the preparation script. Borders from the community source are NOT trusted without separate geometric validation; known India–Sri Lanka sea adjacency is not a land boundary.

Fetched 2026-11-10. Source hashes:\n'''+''.join(f'- {Path(p).name}: SHA-256 {hashlib.sha256(Path(p).read_bytes()).hexdigest()}\n' for p in sys.argv[1:3]))
print('Verified unambiguous capitals',sum(bool(c['capital']) for c in facts.values()));print('Unmatched',[(r['iso'],by2[r['iso']]['capital']) for r in audit if not r['capitalIncluded'] and not r['excludedComplexCase']])
