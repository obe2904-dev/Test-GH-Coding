#!/usr/bin/env python3
import os, re, json

base = '/Users/olebaek/Test P2G 1/src'
search_dirs = [
    'components/post-creation',
    'pages/dashboard/CreatePostPage.tsx',
]

files = []
for d in search_dirs:
    full = os.path.join(base, d)
    if os.path.isfile(full):
        files.append(full)
    elif os.path.isdir(full):
        for root, dirs, fnames in os.walk(full):
            for f in fnames:
                if f.endswith(('.tsx', '.ts')):
                    files.append(os.path.join(root, f))

# Match t('key', ...) patterns
pat = re.compile(r"\bt(?:Publish|Create)?\s*\(\s*['\`]([^'\`\n]+)['\`]")
prefix_pat = re.compile(r"keyPrefix:\s*['\`]([^'\`]+)['\`]")

results = {}  # full_key -> set of relative file paths

for f in sorted(files):
    with open(f) as fh:
        content = fh.read()
    
    prefixes = prefix_pat.findall(content)
    
    for m in pat.finditer(content):
        raw_key = m.group(1)
        for prefix in (prefixes or ['']):
            if prefix:
                full_key = f'{prefix}.{raw_key}'
            else:
                full_key = raw_key
            if full_key not in results:
                results[full_key] = set()
            results[full_key].add(os.path.relpath(f, base))

with open('/Users/olebaek/Test P2G 1/src/lib/locales/en.json') as fh:
    en = json.load(fh)
with open('/Users/olebaek/Test P2G 1/src/lib/locales/da.json') as fh:
    da = json.load(fh)

def get_val(data, dotted_key):
    parts = dotted_key.split('.')
    cur = data
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur if not isinstance(cur, dict) else '__OBJECT__'

print(f'Files scanned: {len(files)}')
print(f'Total keys found in code: {len(results)}')

print('\n=== MISSING FROM EN (used in code, no EN value) ===')
count = 0
for key in sorted(results.keys()):
    if not key.startswith('createPost.'):
        continue
    short = key[len('createPost.'):]
    en_val = get_val(en.get('createPost', {}), short)
    if en_val is None:
        da_val = get_val(da.get('createPost', {}), short)
        files_str = ', '.join(sorted(results[key]))
        print(f'  {key}')
        print(f'    DA: {repr(da_val)}')
        print(f'    In: {files_str}')
        count += 1
print(f'Total: {count}')

print('\n=== MISSING FROM DA (used in code, no DA value) ===')
count = 0
for key in sorted(results.keys()):
    if not key.startswith('createPost.'):
        continue
    short = key[len('createPost.'):]
    da_val = get_val(da.get('createPost', {}), short)
    if da_val is None:
        en_val = get_val(en.get('createPost', {}), short)
        files_str = ', '.join(sorted(results[key]))
        print(f'  {key}')
        print(f'    EN: {repr(en_val)}')
        print(f'    In: {files_str}')
        count += 1
print(f'Total: {count}')

print('\n=== DA ORPHAN KEYS not found in EN ===')
def flatten(d, prefix=''):
    out = {}
    for k, v in d.items():
        key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out

cp_en = flatten(en.get('createPost', {}))
cp_da = flatten(da.get('createPost', {}))
only_da = set(cp_da) - set(cp_en)
for k in sorted(only_da):
    print(f'  createPost.{k}: DA={repr(cp_da[k])}')
