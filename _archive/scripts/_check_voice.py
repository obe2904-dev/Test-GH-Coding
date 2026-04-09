import json, urllib.request, subprocess
key_result = subprocess.run(['supabase','projects','api-keys','--project-ref','kvqdkohdpvmdylqgujpn','-o','json'], capture_output=True, text=True)
service_key = next(k['api_key'] for k in json.loads(key_result.stdout) if k['name']=='service_role')
req = urllib.request.Request(
  'https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.2037d63c-a138-4247-89c5-5b6b8cef9f3f&select=brand_essence,brand_essence_elaboration,tone_of_voice,typical_openings,never_say,voice_constraints,humor_level,tone_model',
  headers={'apikey':service_key,'Authorization':'Bearer '+service_key}
)
with urllib.request.urlopen(req) as r:
  d = json.loads(r.read())[0]
  print('brand_essence:', repr(d.get('brand_essence')))
  print('brand_essence_elaboration:', repr(d.get('brand_essence_elaboration')))
  print('typical_openings:', d.get('typical_openings'))
  print('never_say:', d.get('never_say'))
  print('voice_constraints:', repr(d.get('voice_constraints')))
  print('humor_level:', d.get('humor_level'))
  tov = d.get('tone_of_voice')
  if isinstance(tov, str):
    tov = json.loads(tov)
  print('tone_of_voice.attributes:', tov.get('attributes') if isinstance(tov, dict) else tov)
  tm = d.get('tone_model')
  if isinstance(tm, str):
    tm = json.loads(tm)
  print('tone_model.primary_keywords:', tm.get('primary_keywords') if isinstance(tm, dict) else tm)
