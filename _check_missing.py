import json, subprocess

# Load the committed version
result = subprocess.run(
    ['git', 'show', '35f4b0a:src/lib/locales/en.json'],
    capture_output=True, text=True, cwd='/Users/olebaek/Test P2G 1'
)
git_en = json.loads(result.stdout)

# Load current en.json
with open('src/lib/locales/en.json', encoding='utf-8') as f:
    cur_en = json.load(f)

print("=== git businessProfile.feature ===")
print(json.dumps(git_en.get('businessProfile', {}).get('feature', 'MISSING'), indent=2, ensure_ascii=False))

print("\n=== cur businessProfile.feature ===")
print(json.dumps(cur_en.get('businessProfile', {}).get('feature', 'MISSING'), indent=2, ensure_ascii=False))

print("\n=== git businessProfile.frame1 ===")
print(json.dumps(git_en.get('businessProfile', {}).get('frame1', 'MISSING'), indent=2, ensure_ascii=False))

print("\n=== git businessProfile.days (if exists) ===")
print(json.dumps(git_en.get('businessProfile', {}).get('days', 'MISSING'), indent=2, ensure_ascii=False))

print("\n=== git menu (FULL) ===")
print(json.dumps(git_en.get('menu', {}), indent=2, ensure_ascii=False))

print("\n=== git navigation ===")
print(json.dumps(git_en.get('navigation', {}), indent=2, ensure_ascii=False))

# Also check which t() calls in the pages reference keys that DON'T exist in current
def flatten(d, prefix=''):
    result = {}
    for k, v in d.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            result.update(flatten(v, full))
        else:
            result[full] = v
    return result

cur_flat = flatten(cur_en)

# Read all t() keys from key source files
import subprocess
import re
for fname in ['src/pages/dashboard/BusinessProfilePage.tsx',
              'src/pages/dashboard/LocationIntelligencePage.tsx',
              'src/pages/dashboard/MenuPage.tsx',
              'src/components/layout/Sidebar.tsx']:
    with open(fname, encoding='utf-8') as f:
        content = f.read()
    keys = re.findall(r"t\('([^']+)'\)", content)
    missing = [k for k in set(keys) if k not in cur_flat and k.startswith(('businessProfile.', 'location.', 'menu.', 'navigation.'))]
    if missing:
        print(f"\n=== MISSING from {fname.split('/')[-1]} ===")
        for k in sorted(missing):
            print(f"  {k}")
