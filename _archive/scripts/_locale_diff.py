import json, subprocess, sys

# Load the committed version
result = subprocess.run(
    ['git', 'show', '35f4b0a:src/lib/locales/en.json'],
    capture_output=True, text=True, cwd='/Users/olebaek/Test P2G 1'
)
git_en = json.loads(result.stdout)

# Load current en.json
with open('src/lib/locales/en.json', encoding='utf-8') as f:
    cur_en = json.load(f)

def flatten(d, prefix=''):
    result = {}
    for k, v in d.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            result.update(flatten(v, full))
        else:
            result[full] = v
    return result

git_flat = flatten(git_en)
cur_flat = flatten(cur_en)

# Keys in git but missing from current
in_git_not_cur = {k: v for k, v in git_flat.items() if k not in cur_flat}
# Keys in current but missing from git
in_cur_not_git = {k: v for k, v in cur_flat.items() if k not in git_flat}

print("=== In git but MISSING from current (lost keys) ===")
for k in sorted(in_git_not_cur.keys()):
    print(f"  {k}: {repr(git_flat[k])[:60]}")

print()
print("=== In current but NOT in git (newly added) ===")
for k in sorted(in_cur_not_git.keys()):
    print(f"  {k}: {repr(cur_flat[k])[:60]}")
