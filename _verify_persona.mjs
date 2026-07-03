#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, business_identity_persona')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

const persona = data.business_identity_persona || ''

console.log('\n=== Verification Results ===\n')
console.log('Business ID:', data.business_id)
console.log('\n--- Checks ---')
console.log('❌ Has OLD students generic:', persona.includes('Studerende'))
console.log('❌ Has OLD score format:', persona.includes('score'))
console.log('✅ Has strategic header:', persona.includes('Strategiske målgrupper'))
console.log('✅ Has primary segment example:', persona.includes('Aftensmad ved åen'))
console.log('✅ Has "primær" label:', persona.includes('primær'))
console.log('✅ Has "sekundær" label:', persona.includes('sekundær'))

// Extract audience section
const match = persona.match(/Strategiske målgrupper:(.*?)(?:###|Kommunikationsstrategi|$)/s)
if (match) {
  console.log('\n--- Audience Section ---')
  console.log(match[1].trim())
} else {
  console.log('\n⚠️ No strategic segments section found')
}

console.log('\n--- Full Persona ---')
console.log(persona)
