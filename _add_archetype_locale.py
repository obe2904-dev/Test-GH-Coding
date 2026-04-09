import json

for lang, data in [
    ('en', {
        'archetype': {
            'voiceOptions': 'Voice options',
            'recommended': 'recommended',
            'activeVoice': 'Active voice',
            'inactiveVoice': 'Not active',
            'writingRules': 'Writing rules',
            'examplePosts': 'Example posts',
            'currentVoice': 'Current voice',
            'useThisVoice': 'Use this voice',
            'switching': 'Switching\u2026',
            'fallbackTitle': 'VOICE',
            'error': 'Something went wrong \u2014 please try again.',
            'sources': {
                'website': {
                    'title': 'YOUR WEBSITE',
                    'subtitle': 'What your website actually communicates today',
                },
                'ai_enriched': {
                    'title': 'AI RECOMMENDATION',
                    'subtitle': 'What works better on social media',
                },
            },
        },
    }),
    ('da', {
        'archetype': {
            'voiceOptions': 'Stemmemuligheder',
            'recommended': 'anbefalet',
            'activeVoice': 'Aktiv stemme',
            'inactiveVoice': 'Ikke aktiv',
            'writingRules': 'Skriveregler',
            'examplePosts': 'Eksempel-opslag',
            'currentVoice': 'Nuv\u00e6rende stemme',
            'useThisVoice': 'Brug denne stemme',
            'switching': 'Skifter\u2026',
            'fallbackTitle': 'STEMME',
            'error': 'Noget gik galt \u2014 pr\u00f8v igen.',
            'sources': {
                'website': {
                    'title': 'DIN HJEMMESIDE',
                    'subtitle': 'Hvad hjemmesiden faktisk kommunikerer i dag',
                },
                'ai_enriched': {
                    'title': 'AI ANBEFALING',
                    'subtitle': 'Hvad der virker bedre p\u00e5 sociale medier',
                },
            },
        },
    }),
]:
    path = f'src/lib/locales/{lang}.json'
    with open(path, encoding='utf-8') as f:
        locale = json.load(f)

    brand = locale.setdefault('brand', {})
    additions = data

    def deep_merge_add(target, src):
        for k, v in src.items():
            if k not in target:
                target[k] = v
            elif isinstance(v, dict) and isinstance(target[k], dict):
                deep_merge_add(target[k], v)

    deep_merge_add(brand, additions)

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(locale, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f'{lang}: brand.archetype.voiceOptions = {locale["brand"]["archetype"]["voiceOptions"]}')
    print(f'{lang}: brand.archetype.sources.website.title = {locale["brand"]["archetype"]["sources"]["website"]["title"]}')

print('Done')
