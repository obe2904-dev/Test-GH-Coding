#!/usr/bin/env python3
"""Add missing step-indicator + preview i18n keys to both locale files."""
import json

EN_PATH = '/Users/olebaek/Test P2G 1/src/lib/locales/en.json'
DA_PATH = '/Users/olebaek/Test P2G 1/src/lib/locales/da.json'

KEYS = [
    # Step indicator - mode labels
    ('steps.writeSelf',   'Write yourself',   'Skriv Selv'),
    ('steps.aiIdeas',     'AI Ideas',         'AI Forslag'),
    ('steps.weeklyPlan',  'Weekly plan',      'Ugeplan'),
    # Step indicator - status labels
    ('steps.writeText',   'Write text',       'Skriv tekst'),
    ('steps.editText',    'Edit text',        'Tilret tekst'),
    ('steps.textReady',   'Text ready',       'Tekst klar'),
    ('steps.choosePhoto', 'Choose photo',     'Vælg billede'),
    ('steps.photoReady',  'Photo ready',      'Billede klar'),
    ('steps.pending',     'Pending',          'Afventer'),
    ('steps.schedule',    'Schedule',         'Planlæg'),
    # PlatformPreview
    ('preview.heading',         'How your post looks',     'Sådan ser dit opslag ud'),
    ('preview.noPlatformsTitle','Select your social media to see the right preview',
                                'Vælg dine sociale medier for at se den rigtige forhåndsvisning'),
    ('preview.noPlatformsDesc', "Once I know where you're posting, I can show you a preview that fits each platform — and automatically resize.",
                                "Når jeg ved, hvor du poster, kan jeg vise dig en forhåndsvisning, der passer til hver platform — og automatisk tilpasse størrelsen."),
    ('preview.selectSocialMedia', 'Select social media',  'Vælg sociale medier'),
    ('preview.uploadTitle',     'Click to upload',         'Klik for at uploade'),
    ('preview.uploadSubtitle',  'Photo or video',          'Foto eller video'),
    # PhotoUploadManager
    ('create.chooseYourPhoto',  'Choose your photo',       'Vælg dit billede'),
    ('create.uploadPreviewDesc','Upload your photo — I\'ll show you a realistic preview.', 'Upload dit foto — jeg viser dig et realistisk preview.'),
    ('create.uploadingProcessing', 'Uploading and processing image...', 'Uploader og behandler billede...'),
    ('create.pleaseWait',       'Please wait',             'Vent venligst'),
    ('create.clickToUploadMedia','Click to upload photo or video', 'Klik for at uploade foto eller video'),
    ('create.fileFormats',      'JPG, PNG, GIF or MP4/MOV (max 30 sec)', 'JPG, PNG, GIF eller MP4/MOV (maks 30 sek)'),
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
    if set_nested(en_data['createPost'], dotted, en_val):
        added_en += 1
    if set_nested(da_data['createPost'], dotted, da_val):
        added_da += 1

save_json(EN_PATH, en_data)
save_json(DA_PATH, da_data)

print(f'EN: added {added_en}')
print(f'DA: added {added_da}')
print('Done.')
