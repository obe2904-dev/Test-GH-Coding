#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('TRIGGER CONFIGURATION UPDATE HISTORY')
console.log('═══════════════════════════════════════════════════════════════\n')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, trigger_updated_at, trigger_updated_by, updated_at, commercial_baseline_mode, commercial_strategy_reasoning')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

console.log('--- TIMESTAMPS ---')
console.log('Profile updated_at:', data.updated_at)
console.log('Trigger updated_at:', data.trigger_updated_at || 'NOT SET')
console.log('Trigger updated_by:', data.trigger_updated_by || 'NOT SET')

console.log('\n--- COMMERCIAL STRATEGY ---')
console.log('Baseline Mode:', data.commercial_baseline_mode || 'NOT SET')
console.log('Reasoning:', data.commercial_strategy_reasoning?.substring(0, 200) || 'NOT SET')

const now = new Date()
const profileUpdated = new Date(data.updated_at)
const triggerUpdated = data.trigger_updated_at ? new Date(data.trigger_updated_at) : null

console.log('\n--- TIME ANALYSIS ---')
console.log('Current time:', now.toISOString())
console.log('Profile age:', Math.round((now - profileUpdated) / 1000 / 60), 'minutes')
if (triggerUpdated) {
  console.log('Trigger age:', Math.round((now - triggerUpdated) / 1000 / 60), 'minutes')
  
  if (Math.abs(profileUpdated - triggerUpdated) < 60000) {
    console.log('\n✅ Trigger was updated with profile (within 1 minute)')
  } else {
    console.log('\n⚠️  Trigger was NOT updated with profile')
    console.log('    Profile updated:', profileUpdated.toISOString())
    console.log('    Trigger updated:', triggerUpdated.toISOString())
  }
} else {
  console.log('\n❌ Trigger has NEVER been updated')
  console.log('   Stage CS (Commercial Strategy) may have failed during regeneration')
}

console.log('\n═══════════════════════════════════════════════════════════════\n')
