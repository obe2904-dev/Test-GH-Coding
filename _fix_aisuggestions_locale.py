#!/usr/bin/env python3
"""Add missing dashboard.* keys used by AiSuggestionsCard."""
import json

EN_PATH = '/Users/olebaek/Test P2G 1/src/lib/locales/en.json'
DA_PATH = '/Users/olebaek/Test P2G 1/src/lib/locales/da.json'

KEYS = [
    # Headline / subtext when suggestions are ready
    ('suggestionsReady',    "Today's AI Ideas",             'Dine AI-ideer til i dag'),
    ('suggestionsSubtext',  'Tap an idea to write the post.', 'Tryk på en idé for at skrive opslaget.'),
    # Empty state
    ('headlinePromptFallback', 'Get AI post ideas',
                                'Få AI-ideer til dit næste opslag'),
    ('aiIdeasDescription',
     'Let AI suggest 3 ideas for today\'s post based on your menu and the weather 🌤️',
     'Lad AI foreslå 3 ideer til dagens opslag baseret på dit menukort og vejret 🌤️'),
    ('generateIdeas',       'Generate ideas',   'Generér ideer'),
    # Upgrade nudge
    ('upgradeNudge',        'Want more AI ideas per day?',  'Vil du have flere AI-ideer per dag?'),
    ('upgradeNudgeSubtext', 'Upgrade to Smart or Pro for unlimited daily ideas.',
                             'Opgrader til Smart eller Pro for ubegrænsede daglige ideer.'),
    # Footer actions
    ('writeOwnIdea',        'Write your own idea instead',  'Skriv din egen idé i stedet'),
    ('regenerateIdeas',     '🔄 Generate new ideas',        '🔄 Generér nye ideer'),
    # Generate button tooltip
    ('generatePostWithAI',  'Generate post with AI',        'Generér opslag med AI'),
    # Why this post
    ('whyThisPost',         '💡 Why this post?',            '💡 Hvorfor dette opslag?'),
    # Photo label
    ('cameraOrPhone',       '📷 Camera or phone',           '📷 Kamera eller telefon'),
    # Weather labels
    ('weatherIn',           'Weather in',                   'Vejret i'),
    ('weatherValidUntil',   'Valid',                        'Gælder'),
    # Suggested time labels
    ('suggestedTimeToday',  'today',                        'i dag'),
    ('suggestedTimeTomorrow', 'tomorrow',                   'i morgen'),
    # Content type labels
    ('contentType.menu_item',     'Product',      'Produkt'),
    ('contentType.atmosphere',    'Atmosphere',   'Stemning'),
    ('contentType.behind_scenes', 'Behind the scenes', 'Bag kulisserne'),
    # Time reason labels
    ('timeReason.08:00', 'Morning customers arriving',  'Morgenkunder på vej'),
    ('timeReason.09:00', 'Before brunch starts',        'Før brunchen starter'),
    ('timeReason.10:00', 'Mid-morning break',           'Formiddagspause'),
    ('timeReason.11:00', 'Lunch decision time',         'Beslutning om frokost'),
    ('timeReason.12:00', 'Lunch break',                 'Frokostpause'),
    ('timeReason.13:00', 'Midday break',                'Middagspause'),
    ('timeReason.14:00', 'Afternoon break',             'Eftermiddagspause'),
    ('timeReason.16:00', 'End of work day',             'Fyraften'),
    ('timeReason.17:00', 'Dinner time begins',          'Aftensmål begynder'),
    ('timeReason.18:00', 'Evening inspiration',         'Afteninspiration'),
    ('timeReason.20:00', 'Evening atmosphere',          'Aftenstemning'),
]


def set_nested(d, dotted_key, value):
    parts = dotted_key.split('.')
    cur = d
    for part in parts[:-1]:
        if part not in cur or not isinstance(cur[part], dict):
            cur[part] = {}
        cur = cur[part]
    if parts[-1] not in cur:
        cur[parts[-1]] = value
        return True
    return False


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


en_data = load_json(EN_PATH)
da_data = load_json(DA_PATH)

added_en = added_da = 0

for dotted, en_val, da_val in KEYS:
    if set_nested(en_data['dashboard'], dotted, en_val):
        added_en += 1
    if set_nested(da_data['dashboard'], dotted, da_val):
        added_da += 1

save_json(EN_PATH, en_data)
save_json(DA_PATH, da_data)

print(f'EN: added {added_en}')
print(f'DA: added {added_da}')
print('Done.')
