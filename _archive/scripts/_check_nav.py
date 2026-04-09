import json
with open('src/lib/locales/en.json') as f: en = json.load(f)
with open('src/lib/locales/da.json') as f: da = json.load(f)
nav_en = en.get('navigation', {})
nav_da = da.get('navigation', {})
for k in sorted(nav_en.keys()):
    print(f"  {k}: EN={str(nav_en.get(k))!r}  DA={str(nav_da.get(k))!r}")
