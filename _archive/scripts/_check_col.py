import json, urllib.request, subprocess

key_result = subprocess.run(['supabase','projects','api-keys','--project-ref','kvqdkohdpvmdylqgujpn','-o','json'], capture_output=True, text=True)
service_key = next(k for k in json.loads(key_result.stdout) if k['name']=='service_role')['api_key']

req = urllib.request.Request(
    'https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/weekly_strategies?limit=1&select=strategy_rationale',
    headers={'apikey': service_key, 'Authorization': 'Bearer ' + service_key}
)
try:
    with urllib.request.urlopen(req) as r:
        print('strategy_rationale column EXISTS:', r.read().decode()[:100])
except urllib.error.HTTPError as e:
    print('strategy_rationale MISSING:', e.code, e.read().decode()[:200])
