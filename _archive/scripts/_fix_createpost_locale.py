#!/usr/bin/env python3
"""Add all missing createPost i18n keys to both en.json and da.json."""
import json

EN_PATH = '/Users/olebaek/Test P2G 1/src/lib/locales/en.json'
DA_PATH = '/Users/olebaek/Test P2G 1/src/lib/locales/da.json'

# Keys to add: (dotted sub-path under createPost, en_value, da_value)
KEYS = [
    # create.* – both missing
    ('create.applyGrading', 'Apply Color Grading', 'Anvend farvegradering'),
    ('create.crop', 'Crop', 'Beskær'),
    ('create.errorPrefix', 'Error: {{error}}', 'Fejl: {{error}}'),
    ('create.ideasInPlan', 'Ideas in plan', 'Ideer i plan'),
    ('create.mediaAngle', 'Angle', 'Vinkel'),
    ('create.mediaIdea', '📷 Media Idea', '📷 Medieidé'),
    ('create.mediaIdeaFromPlan', '📷 Media from plan', '📷 Medie fra plan'),
    ('create.mediaMotif', 'Motif', 'Motiv'),
    ('create.mediaSetting', 'Setting', 'Omgivelser'),
    ('create.photoEditFailed', 'Photo editing failed. Please try again.', 'Fotoredigering fejlede. Prøv igen.'),
    ('create.uploadFailed', 'Upload failed. Please try again.', 'Upload fejlede. Prøv igen.'),
    ('create.videoQuotaExceeded',
     "You've used all {{current}} of your {{limit}} weekly video analyses. Upgrade for more.",
     'Du har brugt alle {{current}} af dine {{limit}} ugentlige videoanalyser. Opgrader for mere.'),
    ('create.videoTooLong',
     'This video is {{duration}} seconds – only videos up to 30 seconds can be analyzed.',
     'Denne video er {{duration}} sekunder – kun videoer op til 30 sekunder kan analyseres.'),

    # editCaption – both missing (DA fallback in code was Danish)
    ('editCaption', 'Edit Caption', 'Rediger tekst'),

    # generate.hashtagInsight* – missing from EN and/or both
    ('generate.hashtagInsightSharedExtras',
     'Hashtags are split into {{sharedCount}} shared tags and {{instagramExtras}} extra for Instagram so you reach both platforms.',
     'Hashtags er fordelt i {{sharedCount}} delte tags og {{instagramExtras}} ekstra til Instagram, så du når begge platforme.'),
    ('generate.hashtagInsightSharedOnly',
     'Hashtags work on both Facebook and Instagram without extra platform-specific tags.',
     'Hashtags fungerer på både Facebook og Instagram uden ekstra platform-specifikke tags.'),
    ('generate.hashtagInsightInstagramOnly',
     'AI suggested {{count}} Instagram hashtags using your main keywords.',
     'AI foreslog {{count}} Instagram hashtags baseret på dine hoved-nøgleord.'),
    ('generate.hashtagInsightFacebookOnly',
     'Hashtags focus on your key Facebook keywords.',
     'Hashtags fokuserer på dine vigtigste Facebook-nøgleord.'),

    # DA orphan generate.* keys – add EN equivalents
    ('generate.customIdea', 'Custom', 'Brugerdefineret'),
    ('generate.generate', 'Generate', 'Generér'),
    ('generate.hashtagInsightBoth',
     'Hashtags work on both Facebook and Instagram without extra platform-specific tags.',
     'Hashtags fungerer på både Facebook og Instagram uden ekstra platform-specifikke tags.'),
    ('generate.noIdeasYet', 'Click below to generate AI ideas', 'Klik nedenfor for at generere AI-ideer'),

    # hashtagGroup* – both missing (top-level keys in createPost)
    ('hashtagGroupFacebook', 'For Facebook', 'Til Facebook'),
    ('hashtagGroupInstagram', 'For Instagram', 'Til Instagram'),
    ('hashtagGroupInstagramExtra', 'Extra for Instagram', 'Ekstra til Instagram'),
    ('hashtagGroupShared', 'Shared across platforms', 'Delt på tværs af platforme'),

    # photoAnalysis.reanalyzeButton – both missing
    ('photoAnalysis.reanalyzeButton', 'Re-analyze Photo', 'Analyser igen'),

    # publish.* – missing from both or EN only
    ('publish.manualPostingRequired', 'Manual post required', 'Manuel opslag påkrævet'),
    ('publish.prepareManualPost', 'Prepare manual post', 'Forbered manuel opslag'),
    ('publish.publishNowCta', 'Publish Post', 'Udgiv opslag'),

    # DA orphan publish.* weekday keys – add EN equivalents
    ('publish.friday', 'Friday', 'Fredag'),
    ('publish.monday', 'Monday', 'Mandag'),
    ('publish.saturday', 'Saturday', 'Lørdag'),
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
        return True  # added
    return False  # already existed


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


en_data = load_json(EN_PATH)
da_data = load_json(DA_PATH)

added_en = 0
added_da = 0
already_en = 0
already_da = 0

for dotted, en_val, da_val in KEYS:
    full_key = dotted
    # Work inside the createPost namespace
    if set_nested(en_data['createPost'], full_key, en_val):
        added_en += 1
    else:
        already_en += 1

    if set_nested(da_data['createPost'], full_key, da_val):
        added_da += 1
    else:
        already_da += 1

save_json(EN_PATH, en_data)
save_json(DA_PATH, da_data)

print(f'EN: added {added_en}, already had {already_en}')
print(f'DA: added {added_da}, already had {already_da}')
print('Done.')
