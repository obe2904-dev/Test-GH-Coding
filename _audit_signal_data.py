import json
import urllib.request
import subprocess

key_result = subprocess.run(
    ['supabase', 'projects', 'api-keys', '--project-ref', 'kvqdkohdpvmdylqgujpn', '-o', 'json'],
    capture_output=True, text=True, cwd='/Users/olebaek/Test P2G 1'
)
service_key = next(k['api_key'] for k in json.loads(key_result.stdout) if k['name'] == 'service_role')
BASE = 'https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1'
H = {'apikey': service_key, 'Authorization': 'Bearer ' + service_key}
BID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

def get(url): 
    with urllib.request.urlopen(urllib.request.Request(url, headers=H)) as r:
        return json.loads(r.read())

# 1. business_brand_profile — voice-relevant fields
bp = get(f'{BASE}/business_brand_profile?business_id=eq.{BID}&select=business_character,tone_of_voice,tone_model,sample_posts,typical_openings')[0]
print('=== business_character ===')
print(bp['business_character'])
print('\n=== sample_posts count ===')
print(len(bp['sample_posts'] or []))
print('\n=== typical_openings ===')
print(bp['typical_openings'])
print('\n=== tone_of_voice ===')
print(json.dumps(bp['tone_of_voice'], indent=2, ensure_ascii=False) if bp['tone_of_voice'] else 'null')

# 2. business_locations count
locs = get(f'{BASE}/business_locations?business_id=eq.{BID}&select=id')
print(f'\n=== locations count ===\n{len(locs)}')

# 3. business_profile — menu_signal, category_scores, location_intelligence
prof = get(f'{BASE}/business_profile?business_id=eq.{BID}&select=menu_signal,category_scores,location_intelligence,operations')[0]
print('\n=== category_scores ===')
print(json.dumps(prof.get('category_scores'), indent=2, ensure_ascii=False))
print('\n=== menu_signal (programmes) ===')
ms = prof.get('menu_signal') or {}
print('programmes:', json.dumps(ms.get('programmes'), indent=2, ensure_ascii=False))
print('\n=== operations (relevant fields) ===')
ops = prof.get('operations') or {}
print('has_outdoor_seating:', ops.get('has_outdoor_seating'))
print('has_takeaway:', ops.get('has_takeaway'))
print('has_table_service:', ops.get('has_table_service'))
print('has_english_menu:', ops.get('has_english_menu'))
print('\n=== location_intelligence (concept_fit_by_category) ===')
li = prof.get('location_intelligence') or {}
print(json.dumps(li.get('concept_fit_by_category'), indent=2, ensure_ascii=False))

# 4. menu_summaries
sums = get(f'{BASE}/menu_summaries?business_id=eq.{BID}&select=title,summary&limit=5')
print(f'\n=== menu_summaries count: {len(sums)} ===')
for s in sums:
    print(f"  [{s['title']}]: {(s['summary'] or '')[:120]}...")
