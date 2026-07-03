import json, urllib.request, subprocess
key_result = subprocess.run(['supabase','projects','api-keys','--project-ref','kvqdkohdpvmdylqgujpn','-o','json'], capture_output=True, text=True, cwd='/Users/olebaek/Test P2G 1')
service_key = next(k['api_key'] for k in json.loads(key_result.stdout) if k['name']=='service_role')
req = urllib.request.Request(
  'https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/businesses?id=eq.2037d63c-a138-4247-89c5-5b6b8cef9f3f&select=analysis',
  headers={'apikey':service_key,'Authorization':'Bearer '+service_key}
)
with urllib.request.urlopen(req) as r:
  d = json.loads(r.read())[0]
  a = d.get('analysis')
  if isinstance(a, str): a = json.loads(a)
  rituals = a.get('rituals_and_moments', [])
  print('=== rituals_and_moments ===')
  for i, r2 in enumerate(rituals):
    print(f'#{i+1}:', json.dumps(r2, ensure_ascii=False, indent=2))
  print('\n=== emotional_core in brand_profile ===')
req2 = urllib.request.Request(
  'https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.2037d63c-a138-4247-89c5-5b6b8cef9f3f&select=emotional_core',
  headers={'apikey':service_key,'Authorization':'Bearer '+service_key}
)
with urllib.request.urlopen(req2) as r3:
  print(json.loads(r3.read())[0].get('emotional_core'))
