import json

with open('src/lib/locales/en.json', encoding='utf-8') as f:
    en = json.load(f)

keys_to_check = [
    'brand.page.generating', 'brand.page.loading', 'brand.page.errorTitle',
    'brand.page.title', 'brand.page.subtitle', 'brand.page.noBusiness',
    'brand.display.background.audience', 'brand.display.background.differentiator',
    'brand.display.background.generatorInput', 'brand.display.background.ourStory',
    'brand.display.background.samplePosts', 'brand.display.background.story',
    'brand.display.background.title', 'brand.display.background.unverified',
    'brand.display.businessType', 'brand.display.group1Badge',
    'brand.display.hideDetails', 'brand.display.limits.avoid',
    'brand.display.limits.badge', 'brand.display.limits.copy',
    'brand.display.limits.empty', 'brand.display.limits.principle',
    'brand.display.limits.signature', 'brand.display.limits.title',
    'brand.display.pillars.badge', 'brand.display.pillars.empty',
    'brand.display.pillars.title', 'brand.display.regenerate',
    'brand.display.showPositioning',
    'brand.display.strategy.badge', 'brand.display.strategy.goalBlend',
    'brand.display.strategy.goals.build_brand', 'brand.display.strategy.goals.drive_footfall',
    'brand.display.strategy.goals.retain_loyalty', 'brand.display.strategy.primaryGoal',
    'brand.display.strategy.rationaleTitle', 'brand.display.strategy.signalsTitle',
    'brand.display.strategy.tips.brand', 'brand.display.strategy.tips.footfall',
    'brand.display.strategy.tips.loyalty', 'brand.display.strategy.title',
    'brand.display.voice.badge', 'brand.display.voice.humorLabel',
    'brand.display.voice.legacyWarning', 'brand.display.voice.rationale',
    'brand.display.voice.title', 'brand.display.voice.typicalOpening',
    'brand.generator.button', 'brand.generator.description', 'brand.generator.error',
    'brand.generator.generating', 'brand.generator.includes',
    'brand.generator.item.audience', 'brand.generator.item.banned',
    'brand.generator.item.essence', 'brand.generator.item.hooks',
    'brand.generator.item.positioning', 'brand.generator.item.tone',
    'brand.generator.timeEstimate', 'brand.generator.title',
    'brand.progress.defaultMessage', 'brand.progress.step1',
    'brand.progress.step2', 'brand.progress.step3', 'brand.progress.subtitle',
]

def get_val(d, path):
    for part in path.split('.'):
        if not isinstance(d, dict):
            return None
        d = d.get(part)
    return d if not isinstance(d, dict) else None

missing = []
found = []
for k in keys_to_check:
    val = get_val(en, k)
    if val:
        found.append(k)
    else:
        missing.append(k)

print(f"FOUND: {len(found)}")
print(f"MISSING: {len(missing)}")
for k in missing:
    print(f"  MISS: {k}")
