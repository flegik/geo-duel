"""Extract all 195 registered states from official WPP2024 medium country projections.
Requires original official downloads in this directory; writes no project files.
"""
import csv,gzip,json,hashlib,zipfile,io,sys
from decimal import Decimal
from pathlib import Path
root=Path(sys.argv[1]);outfile=Path(sys.argv[2]);year=int(sys.argv[3]) if len(sys.argv)>3 else 2025
registry=json.loads(Path('data/flags/registry.json').read_text());byiso={r['iso']:r for r in registry}
main_url='https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz'
update_url='https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/WPP2024_CSV_files_update.zip'
rows={}
with gzip.open(root/'medium.csv.gz','rt',encoding='utf-8-sig') as f:
 for r in csv.DictReader(f):
  if r['Time']==str(year) and r['Variant']=='Medium' and r['ISO2_code'] in byiso:rows[r['ISO2_code']]=r
with zipfile.ZipFile(root/'update.zip') as z:
 names=z.namelist();name=next(n for n in names if n.endswith('WPP2024_Demographic_Indicators_Medium_Update.csv'))
 for r in csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig')):
  if r['Time']==str(year) and r['Variant']=='Medium' and r['ISO2_code'] in byiso:
   r['_interimUpdate']='2026-01-19';rows[r['ISO2_code']]=r
assert set(rows)==set(byiso),(set(byiso)-set(rows))
exact={}
for iso,r in sorted(rows.items()):
 value=Decimal(r['TPopulation1July'])*1000
 assert value==int(value),(iso,value)
 exact[iso]={'population':int(value),'unLocationCode':int(r['LocID'])}
 if '_interimUpdate' in r:exact[iso]['interimUpdate']=r['_interimUpdate']
selected='DE FR GB IT ES PL NL BE CH AT SE NO DK FI IE PT GR CZ CN IN JP KR ID PK BD VN TH MY PH SG SA IR TR US CA MX BR AR CL CO PE CU DO EG ZA NG MA DZ TN KE ET TZ GH SN CD AU NZ PG FJ WS'.split()
assert len(selected)==60 and len(set(selected))==60
meta={
 'dataset':'UN World Population Prospects 2024','revision':'2024, including 19 January 2026 Togo interim update','referenceYear':2025,'referenceDate':'2025-07-01',
 'indicator':'TPopulation1July','variant':'Medium','status':'projection','definition':'Total population, both sexes combined, all ages, at 1 July 2025; UN WPP2024 medium projection for the country or area as defined by the UN dataset. This is not a municipal/urban population and not an observed 2025 census count.',
 'definitionDe':'Gesamtbevölkerung beider Geschlechter und aller Altersgruppen am 1. Juli 2025; mittlere UN-Projektion der WPP-Ausgabe 2024 für das Land/Gebiet gemäß UN-Abgrenzung. Keine amtliche Volkszählung für 2025.',
 'unit':'persons','originalUnit':'thousands of persons','conversion':'Exact decimal TPopulation1July multiplied by 1000; no binary float rounding.',
 'citation':'United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition.',
 'sourceUrl':'https://population.un.org/wpp/','catalogueUrl':'https://population.un.org/wpp/assets/downloads.json','downloadUrl':main_url,'interimUpdateUrl':update_url,
 'retrievedAt':'2026-11-10','sourceSha256':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['medium.csv.gz','update.zip','downloads.json','notes.csv']},
 'countries':exact,'suggestedQuestionSubjects':selected
}
meta['referenceYear']=year;meta['referenceDate']=f'{year}-07-01'
for k in ['definition','definitionDe']:meta[k]=meta[k].replace('2025',str(year))
outfile.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
(root/'country-audit.csv').write_text('iso,nameDe,UNLocation,populationPersons,rawThousands,variant,referenceYear,interimUpdate\n'+''.join(','.join([iso,byiso[iso]['name'],rows[iso]['Location'],str(exact[iso]['population']),rows[iso]['TPopulation1July'],'Medium','2025',rows[iso].get('_interimUpdate','')])+'\n' for iso in selected))
print('195 population records; 60 suggested familiar subjects; all fields extracted from official UN sources')
for iso in ['DE','CA','IN','CN','NG','TG','VA','PS']:print(iso,exact[iso])
