"""Modernize forward capital questions while retaining the inverse and historic IDs."""
import hashlib
import json
import random
import unicodedata
from pathlib import Path

# These familiar subjects span all three difficulty tiers.
MULTI_LEVEL = set('AU BR CA CN DE EG ES FR GB JP KZ MA TR US'.split())
SPELLING = {'US': 'Washington, D.C.'}
GENITIVE = {
    'BS': 'der Bahamas', 'DO': 'der Dominikanischen Republik', 'GB': 'des Vereinigten Königreichs',
    'IQ': 'des Irak', 'LB': 'des Libanon', 'MH': 'der Marshallinseln', 'MV': 'der Malediven',
    'NE': 'des Niger', 'PH': 'der Philippinen', 'SB': 'der Salomonen', 'SC': 'der Seychellen',
    'SK': 'der Slowakei', 'SN': 'des Senegal', 'SS': 'des Südsudan', 'TD': 'des Tschad',
    'TR': 'der Türkei', 'UA': 'der Ukraine', 'US': 'der Vereinigten Staaten',
}
CAPITAL_STATUS_SOURCES = {'TZ': ['https://oagmis.oag.go.tz/portal/acts/52']}
PREFERRED_REGIONAL = {
    'AU': ['NZ', 'FJ', 'PG'],
    'BR': ['AR', 'UY', 'PE'],
    'CA': ['US', 'CU', 'BS'],
    'TR': ['GE', 'BG', 'AM'],
    'US': ['CA', 'BS', 'JM'],
}

def normalized(name):
    return ''.join(c for c in unicodedata.normalize('NFKD', name).casefold() if c.isalnum())

def replace_capital_questions(originals, facts, flags, nearby):
    pool = Path('data/question-pool')
    catalog = json.loads(Path('data/learning/capital-cities.json').read_text())
    historical = json.loads((pool / 'retired.json').read_text())
    retired = {q['id']: q for q in historical}
    capitals = {iso: SPELLING.get(iso, fact['capital']) for iso, fact in facts.items() if fact['capital']}
    modernized = []
    for original in originals:
        if not original['prompt'].startswith('Was ist die Hauptstadt von '):
            modernized.append(original)
            continue
        iso = original['provenance']['iso']
        domestic = catalog['countries'].get(iso, [])
        if not domestic:
            modernized.append(original)
            continue
        for level in ([1, 2, 3] if iso in MULTI_LEVEL else [original['difficulty']]):
            # The last large city is the easiest choice. More tempting choices enter higher tiers.
            local = (domestic[-1:] if level == 1 else domestic[:level])
            choices = [{'name': c['name'], 'iso': iso, 'kind': 'domesticCity', 'cityId': c['id']} for c in local]
            used = {normalized(capitals[iso]), *(normalized(c['name']) for c in choices)}
            preferred = PREFERRED_REGIONAL.get(iso, original['provenance']['confusions'])
            for neighbor in dict.fromkeys([*preferred, *nearby(iso, list(capitals))]):
                if len(choices) == 3:
                    break
                if neighbor in capitals and normalized(capitals[neighbor]) not in used:
                    choices.append({'name': capitals[neighbor], 'iso': neighbor, 'kind': 'regionalCapital'})
                    used.add(normalized(capitals[neighbor]))
            assert len(choices) == 3, (iso, level)
            assert len(used) == 4, (iso, choices)
            country = GENITIVE.get(iso, 'von ' + flags[iso]['name'])
            correct = {'name': capitals[iso], 'iso': iso, 'kind': 'capital'}
            options = [correct, *choices]
            key = f'{iso}:{level}:' + json.dumps(options, ensure_ascii=False, sort_keys=True)
            digest = hashlib.sha256(key.encode()).hexdigest()
            random.Random(digest).shuffle(options)
            history = [city['historicalRole'] for city in local if 'historicalRole' in city]
            detail = ' ' + ' '.join(history) if history else ''
            explanation = f'{capitals[iso]} ist die heutige Hauptstadt {country}.' + detail
            provenance = dict(
                original['provenance'], edition='capital-cities-2026-11', replaces=original['id'],
                sources=list(dict.fromkeys([*original['provenance']['sources'], catalog['source'],
                    *CAPITAL_STATUS_SOURCES.get(iso, []),
                    *(city['historicalSource'] for city in local if 'historicalSource' in city)])),
                confusions=[c['iso'] for c in choices if c['kind'] == 'regionalCapital'],
                capitalOptions=options,
            )
            modernized.append(dict(original, id=f'capital-cities-v1-{digest[:20]}', difficulty=level,
                prompt=f'Was ist die heutige Hauptstadt {country}?', options=[c['name'] for c in options],
                correct=options.index(correct), explanation=explanation, provenance=provenance))
        retired[original['id']] = dict(original, enabled=False)
    (pool / 'retired.json').write_text(json.dumps(list(retired.values()), ensure_ascii=False, indent=2) + '\n')
    return modernized
