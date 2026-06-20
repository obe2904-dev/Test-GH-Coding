#!/usr/bin/env node
/**
 * Trigger brand profile regeneration for Cafe Faust
 * Tests the new menu_sources.label-based drinks filter
 */

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00'
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('🔄 Triggering brand profile regeneration for Cafe Faust...\n')

try {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/brand-profile-generator`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: CAFE_FAUST_ID,
        language: 'da',
        regenerate: true
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ HTTP ${response.status}: ${errorText}`)
    process.exit(1)
  }

  const result = await response.json()
  console.log('✅ Success!\n')
  console.log('Result:')
  console.log(JSON.stringify(result, null, 2))
  
  // Check programmes
  if (result.menuSignal?.programmes) {
    console.log('\n📋 Programmes found:')
    result.menuSignal.programmes.forEach((prog, i) => {
      console.log(`  ${i + 1}. ${prog.role} (${prog.timeContext || 'no time'})`)
    })
    console.log(`\nTotal: ${result.menuSignal.programmes.length} programmes`)
    console.log('Expected: 3 (MENUKORT, FROKOST, Brunch) - AFTEN should be filtered')
  }
  
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
