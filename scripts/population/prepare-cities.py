"""Re-extract the curated city source from the official UN WUP 2025 workbook.
Usage: python prepare_city_source.py [workbook.xlsx] [output.json] [reference-year]
The curated ISO+City_Code keys remain stable; city population values are never manually typed.
"""
from pathlib import Path
from openpyxl import load_workbook
from decimal import Decimal
import json,hashlib,sys
base=Path(__file__).resolve().parent
source=Path(sys.argv[1]) if len(sys.argv)>1 else base/'WUP2025-F21-DEGURBA-Cities_Pop.xlsx'
outfile=Path(sys.argv[2]) if len(sys.argv)>2 else Path('data/learning/population-cities.json')
year=int(sys.argv[3]) if len(sys.argv)>3 else 2025
selection=[line.split('\t') for line in (base/'selected-cities.tsv').read_text().splitlines() if line]
w=load_workbook(source,read_only=True,data_only=True);sheet=w['Data'];rows=sheet.iter_rows(values_only=True);header=next(rows);ix={str(k):i for i,k in enumerate(header)}
assert str(year) in ix
keys={(iso,int(code)):name for iso,code,name in selection};found={}
for row_number,row in enumerate(rows,2):
 key=(row[ix['ISO2_Code']],row[ix['City_Code']])
 if key not in keys:continue
 assert key not in found,'duplicate city key'
 value=row[ix[str(year)]];assert value is not None and value>0,key
 population=Decimal(str(value))*1000;assert population==population.to_integral_value(),key
 found[key]={
  'id':f'un-wup2025-{int(key[1])}',
  'cityCode':int(key[1]),'iso':key[0],'name':keys[key],'sourceName':row[ix['City_Name']],
  'referenceYear':year,'population':int(population),'sourcePopulationThousands':str(value),
  'populationDefinition':'city-un-degurba','populationKind':'modelled-estimate' if year<=2025 else 'projection',
  'latitude':row[ix['PWCent_Latitude']],'longitude':row[ix['PWCent_Longitude']],
  'sourceSheet':'Data','sourceRow':row_number,'sourceYearColumn':ix[str(year)]+1
 }
assert len(found)==len(keys),(len(found),len(keys),keys.keys()-found.keys())
result={
 'source':{
  'id':'un-wup2025-city-degurba',
  'title':'United Nations, DESA, Population Division (2025). World Urbanization Prospects: The 2025 Revision, File 21, Online Edition.',
  'revision':2025,'referenceYear':year,'retrievedAt':'2026-11-10',
  'url':'https://population.un.org/wup/downloads?tab=Cities',
  'download':'https://population.un.org/wup/assets/Download/Cities/WUP2025-F21-DEGURBA-Cities_Pop.xlsx',
  'methodology':'https://population.un.org/wup/assets/Publications/undesa_pd_2025_wup2025_methodological_report.pdf',
  'definitions':'https://population.un.org/wup/assets/Publications/undesa_pd_2025_faq_wup25.pdf',
  'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'workbookId':'POP/DB/WUP/Rev.2025/F21','unit':'persons','sourceUnit':'thousands of persons','sourceUnitMultiplier':1000,
  'referenceDate':f'{year}-07-01','license':'CC BY 3.0 IGO','licenseUrl':'https://creativecommons.org/licenses/by/3.0/igo/'
 },
 'definition':{
  'id':'city-un-degurba',
  'nameDe':'Urbanes Zentrum nach UN-DEGURBA',
  'explanationDe':'Räumlich zusammenhängendes, dicht besiedeltes urbanes Zentrum nach der international einheitlichen UN-DEGURBA-Abgrenzung. Es basiert auf 1-km²-Rasterzellen mit mindestens 1.500 Einwohnern je km² und umfasst insgesamt mindestens 50.000 Einwohner.',
  'shortPromptDe':f'urbanes Zentrum nach UN-DEGURBA, Mitte {year}',
  'notMunicipalBoundary':True,'notMetropolitanRegion':True,
  'notesDe':[
   'Alle ausgewählten Städte stammen aus derselben Tabelle, demselben Bezugsjahr und derselben harmonisierten Abgrenzung.',
   f'Die Werte für {year} sind modellierte UN-'+('Schätzungen' if year<=2025 else 'Projektionen')+' und keine exakten Zensuszählungen; 2025 gehört in WUP 2025 zum Schätzzeitraum.',
   'Die Zahlen können von amtlichen Einwohnerzahlen innerhalb administrativer Stadtgrenzen oder von Metropolregionen erheblich abweichen.',
   'Zusammengewachsene Siedlungen können ein gemeinsames urbanes Zentrum bilden. Datenqualität und räumliche Abgrenzung hängen von den verfügbaren Zensus- und Rasterdaten ab.',
   'Für faire Quizvergleiche sind deutliche Abstände vorzusehen; 15–20 Prozent Mindestabstand ist eine Anwendungsregel, keine statistisch zertifizierte Unsicherheitsgrenze.'
  ]
 },
 'cities':[found[(iso,int(code))] for iso,code,name in selection]
}
outfile.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Cities:',len(result['cities']),'source SHA-256',result['source']['sha256'])
print('Population checks:',{c['name']:c['population'] for c in result['cities'] if c['name'] in ['Berlin','Tokio','Jakarta','London','Kairo']})
