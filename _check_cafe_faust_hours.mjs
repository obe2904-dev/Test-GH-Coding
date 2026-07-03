const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'
const response = await fetch('https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-quick-suggestions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    businessId,
    tier: 'standardplus',
    regenerate: true
  })
})

const data = await response.json()
console.log('Current time:', new Date().toISOString())
console.log('Suggestions count:', data.suggestions?.length || 0)
console.log('\nFirst suggestion:', JSON.stringify(data.suggestions?.[0], null, 2))
