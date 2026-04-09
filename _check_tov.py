import json, urllib.request, subprocess
key_result = subprocess.run(['supabase','projects','api-keys','--project-ref','kvqdkohdpvmdylqgujpn','-o','json'], capture_output=True, text=True, cwd='/Users/olebaek/Test P2G 1')
service_key = next(k['api_key'] for k in json.loads(key_result.stdout) if k['name']=='service_role')
req = urllib.request.Request(
  'https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.2037d63c-a138-4247-89c5-5b6b8cef9f3f&select=tone_of_voice,voice_rationale,typical_openings,emotional_core',
  headers={'apikey':service_key,'Authorization':'Bearer '+service_key}
)
with urllib.request.urlopen(req) as r:
  raw = r.read()
  d = json.loads(raw)[0]
  print('=== tone_of_voice (type, repr) ===')
  tov = d.get('tone_of_voice')
  print(f'type: {type(tov).__name__}, len: {len(str(tov))}')
  print(repr(tov)[:800])
  print('\n=== typical_openings ===')
  print(d.get('typical_openings'))
  print('\n=== emotional_core ===')
  print(repr(d.get('emotional_core'))[:400])
  print('\n=== voice_rationale ===')
  print(repr(d.get('voice_rationale'))[:400])
