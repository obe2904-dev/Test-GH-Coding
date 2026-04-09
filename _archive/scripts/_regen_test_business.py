"""
Triggers a full brand-profile regeneration for the test business.
Passes forceRegenerate=true so A2 re-runs and all new prompt logic is exercised.
"""
import json, urllib.request, subprocess, time

key_result = subprocess.run(
    ['supabase', 'projects', 'api-keys', '--project-ref', 'kvqdkohdpvmdylqgujpn', '-o', 'json'],
    capture_output=True, text=True, cwd='/Users/olebaek/Test P2G 1'
)
service_key = next(k['api_key'] for k in json.loads(key_result.stdout) if k['name'] == 'service_role')

BID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
FUNCTION_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator'

body = json.dumps({
    'businessId': BID,
    'forceRegenerate': True,
    'ignoreDifferentiationGate': True,
}).encode()

req = urllib.request.Request(
    FUNCTION_URL,
    data=body,
    method='POST',
    headers={
        'apikey': service_key,
        'Authorization': 'Bearer ' + service_key,
        'Content-Type': 'application/json',
    }
)

confirm = input(f'This will trigger a full Gemini regen (costs ~DKK 2-5). Type YES to proceed: ')
if confirm.strip() != 'YES':
    print('Aborted.')
    exit(0)

print(f'Triggering full regen for {BID}...')
start = time.time()
try:
    with urllib.request.urlopen(req, timeout=180) as r:
        resp = json.loads(r.read())
        elapsed = round(time.time() - start, 1)
        print(f'Done in {elapsed}s')
        print(json.dumps(resp, indent=2, ensure_ascii=False)[:3000])
except urllib.error.HTTPError as e:
    elapsed = round(time.time() - start, 1)
    print(f'HTTP {e.code} after {elapsed}s')
    print(e.read().decode()[:2000])
