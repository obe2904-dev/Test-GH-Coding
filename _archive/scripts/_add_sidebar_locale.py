import json

additions_en = {
    'yourBusiness': 'Your Business',        # update: remove numbering from section header
    'setup': {
        'profile':  '1. Business Profile',
        'menu':     '2. What we offer',
        'location': '3. Location',
        'brand':    '4. Brand Profile (AI)',
    },
    'badgeNew': 'NEW',
    'sectionContent': 'Content',
    'writeSelf': 'Write yourself',
    'dailySuggestion': "Today's suggestion",
    'weeklyPlan': 'Weekly plan',
    'sectionPublishing': 'Publishing',
    'socialMedia': 'Social Media',
    'tier': {
        'free':     'Free Plan',
        'standard': 'Smart Plan',
        'premium':  'Pro Plan',
        'upgrade':  'Upgrade \u2192',
        'unlocked': 'All unlocked',
    },
}

additions_da = {
    'yourBusiness': 'Din Forretning',       # update: remove numbering from section header
    'setup': {
        'profile':  '1. Virksomhedsprofil',
        'menu':     '2. Det vi tilbyder',
        'location': '3. Lokation',
        'brand':    '4. Brand Profil (AI)',
    },
    'badgeNew': 'NY',
    'sectionContent': 'Indhold',
    'writeSelf': 'Skriv Selv',
    'dailySuggestion': 'Dagens forslag',
    'weeklyPlan': 'Ugentlig plan',
    'sectionPublishing': 'Publicering',
    'socialMedia': 'Social Medier',
    'tier': {
        'free':     'Gratis Plan',
        'standard': 'Smart Plan',
        'premium':  'Pro Plan',
        'upgrade':  'Opgrader \u2192',
        'unlocked': 'Alt l\u00e5st op',
    },
}

def deep_set(target, additions):
    for k, v in additions.items():
        if isinstance(v, dict):
            sub = target.setdefault(k, {})
            deep_set(sub, v)
        else:
            target[k] = v   # always overwrite (handles the yourBusiness update)

for lang, additions in [('en', additions_en), ('da', additions_da)]:
    path = f'src/lib/locales/{lang}.json'
    with open(path, encoding='utf-8') as f:
        locale = json.load(f)
    nav = locale.setdefault('navigation', {})
    deep_set(nav, additions)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(locale, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f"{lang}: yourBusiness={locale['navigation']['yourBusiness']!r}")
    print(f"      setup.profile={locale['navigation']['setup']['profile']!r}")
    print(f"      tier.upgrade={locale['navigation']['tier']['upgrade']!r}")

print('Done')
