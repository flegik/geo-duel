"""Extract documented city distractors from the official UN WUP 2025 F21 workbook."""
import hashlib
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook

WORKBOOK_URL = 'https://population.un.org/wup/assets/Download/Cities/WUP2025-F21-DEGURBA-Cities_Pop.xlsx'
WORKBOOK_SHA256 = '3a96030d87aec6c1c50f658d5321067d6345e1ab936c5d2854524f972caa75c0'

# Priority order for these familiar countries. The first three form the hard question.
PREFERRED = {
    'AU': [2139, 1634, 2591, 330],
    'BR': [7935, 7303, 8374, 7802],
    'CA': [2925, 3645, 341, 1126],
    'TR': [2626, 1069, 3124, 4508],
    'US': [8354, 1725, 7747, 6237],
    'DE': [4278, 5337, 1477, 1160],
    'EG': [275, 7397, 7111, 6909],
    'MA': [2076, 4424, 1742, 3888],
    'KZ': [2965, 2354, 1880, 735],
}

# Sources describe the historical polity or function, where it differs from the modern capital.
HISTORY = {
    1634: ('Das australische Bundesparlament tagte bis 1927 in Melbourne.', 'https://www.aph.gov.au/Visit_Parliament/About_the_Building/History_of_Parliament_House'),
    7935: ('Rio de Janeiro war bis 1960 Brasiliens Hauptstadt.', 'https://www.britannica.com/place/Rio-de-Janeiro-Brazil'),
    8374: ('Salvador war Hauptstadt des portugiesischen Kolonialgebiets Brasilien.', 'https://bndigital.bn.gov.br/artigos/bicentenario-da-independencia-1763-transferencia-da-capital-do-vice-reino-do-brasil-para-o-rio-de-janeiro/'),
    2925: ('Toronto war zeitweise Regierungssitz der damaligen Provinz Kanada.', 'https://parks.canada.ca/culture/designation/lieu-site/capitale-capital'),
    3645: ('Montréal war zeitweise Regierungssitz der damaligen Provinz Kanada.', 'https://parks.canada.ca/culture/designation/lieu-site/capitale-capital'),
    3124: ('Bursa war eine frühe Hauptstadt des Osmanischen Reichs.', 'https://bursa.ktb.gov.tr/EN-91280/the-first-capital-city-of-the-ottoman-empire.html'),
    2626: ('Istanbul war als Konstantinopel Hauptstadt des Osmanischen Reichs.', 'https://www.britannica.com/place/Istanbul'),
    8354: ('New York City war von 1789 bis 1790 Hauptstadt der USA.', 'https://www.senate.gov/about/historic-buildings-spaces/meeting-places.htm'),
    1477: ('Bonn war Regierungssitz der Bundesrepublik Deutschland vor dem Umzug nach Berlin.', 'https://www.bpb.de/kurz-knapp/hintergrund-aktuell/548225/10-mai-1949-parlamentarischer-rat-stimmt-fuer-bonn-als-provisorische-hauptstadt/'),
    2965: ('Almaty war bis 1997 Hauptstadt Kasachstans.', 'https://www.britannica.com/place/Almaty'),
}
# An additional national capital flag on Dar es Salaam and a future government district
# in Egypt illustrate why this quiz excludes competing capital functions.
EXCLUDED = {'TZ': {3566}}
# Review overrides for country aggregates, city-states, disputed regions and suburbs.
REVIEWED_ONLY = {
    'BN': set(), 'SG': set(), 'GY': set(),
    'DJ': {'Ali Sabieh', 'Tadjoura', 'Dikhil'},
    'GE': {'Batumi', 'Kutaisi', 'Rustavi', 'Gori'},
    'IE': {'Cork', 'Galway', 'Limerick', 'Waterford'},
    'MD': {'Bălți', 'Cahul', 'Ungheni', 'Orhei'},
    'MG': {'Toamasina', 'Mahajanga', 'Fianarantsoa', 'Toliara', 'Antsirabe'},
    'NZ': {'Auckland', 'Christchurch', 'Hamilton', 'Dunedin'},
    'OM': {'Salalah', 'Sohar', 'Nizwa', 'Sur'},
    'PE': {'Arequipa', 'Trujillo', 'Chiclayo', 'Piura'},
    'QA': {'Al Wakrah', 'Al Khor'}, 'SE': {'Gothenburg', 'Malmo', 'Uppsala', 'Linkoping'},
    'UA': {'Kharkiv', 'Odesa', 'Dnipro', 'Lviv'},
}

def normalized(name):
    return ''.join(c for c in unicodedata.normalize('NFKD', name).casefold() if c.isalnum())

source = Path(sys.argv[1])
assert hashlib.sha256(source.read_bytes()).hexdigest() == WORKBOOK_SHA256
root = Path('data/learning')
facts = json.loads((root / 'countries.json').read_text())
known_names = {c['cityCode']: c['name'] for c in json.loads((root / 'population-cities.json').read_text())['cities']}
known_names.update({3645: 'Montréal', 2626: 'Istanbul', 1069: 'Izmir', 275: 'Alexandria', 8123: 'Washington, D.C.'})
capital_labels = {normalized(v['capital']) for v in facts.values() if v['capital']}
rows = load_workbook(source, read_only=True, data_only=True)['Data'].values
columns = {str(value): index for index, value in enumerate(next(rows))}
groups = defaultdict(list)
for source_row, row in enumerate(rows, 2):
    iso = row[columns['ISO2_Code']]
    if not facts.get(iso, {}).get('capital') or row[columns['Capital']] != 0:
        continue
    code = int(row[columns['City_Code']])
    source_name = row[columns['City_Name']]
    name = known_names.get(code, source_name)
    population = round((row[columns['2025']] or 0) * 1000)
    if (code in EXCLUDED.get(iso, ()) or population < 50000 or normalized(name) in capital_labels
            or (iso in REVIEWED_ONLY and source_name not in REVIEWED_ONLY[iso])
            or re.search(r'[/(),\[\]]|\s[-–]\s|New Administrative Capital|New Cairo', name, re.I)):
        continue
    city = {'id': code, 'name': name, 'sourceName': source_name, 'sourceRow': source_row,
            'population2025': population, 'nationalCapital': False}
    if code in HISTORY:
        city['historicalRole'], city['historicalSource'] = HISTORY[code]
    groups[iso].append(city)
for iso, cities in groups.items():
    preference = PREFERRED.get(iso, [])
    by_id = {city['id']: city for city in cities}
    assert all(code in by_id for code in preference), (iso, preference, set(by_id))
    ranked = [by_id[code] for code in preference] + sorted(cities, key=lambda city: (-city['population2025'], city['id']))
    distinct = {}
    for city in ranked:
        distinct.setdefault(normalized(city['name']), city)
    groups[iso] = list(distinct.values())[:4]

data = {'source': WORKBOOK_URL, 'sha256': WORKBOOK_SHA256, 'year': 2025,
        'license': 'CC BY 3.0 IGO', 'licenseUrl': 'https://creativecommons.org/licenses/by/3.0/igo/',
        'countries': dict(sorted(groups.items()))}
(root / 'capital-cities.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
