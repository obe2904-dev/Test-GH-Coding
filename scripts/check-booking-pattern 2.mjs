import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('🔍 Checking Café Faust booking pattern...\n')

// Get business_operations data
const { data: opsData, error: opsError } = await supabase
  .from('business_operations')
  .select('reservation_required, accepts_walk_ins, has_table_service, has_takeaway')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

if (opsError) {
  console.error('❌ Error fetching business_operations:', opsError.message)
  Deno.exit(1)
}

console.log('📊 business_operations data:')
console.log('  reservation_required:', opsData?.reservation_required ?? 'NULL')
console.log('  accepts_walk_ins:', opsData?.accepts_walk_ins ?? 'NULL')
console.log('  has_table_service:', opsData?.has_table_service ?? 'NULL')
console.log('  has_takeaway:', opsData?.has_takeaway ?? 'NULL')

// Derive booking pattern using same logic as context-interpreters.ts
let bookingPattern = 'impulse_friendly'
if (opsData?.reservation_required === true) {
  bookingPattern = 'advance_planning'
} else if (opsData?.has_table_service === true && opsData?.accepts_walk_ins !== true) {
  bookingPattern = 'mixed'
}

console.log('\n🎯 Derived booking pattern:', bookingPattern)

// Explain what this means for CTAs
console.log('\n📝 CTA behavior:')
if (bookingPattern === 'advance_planning') {
  console.log('  ✅ ALWAYS emphasizes booking')
  console.log('  ✅ Weekend posts get urgency CTAs')
  console.log('  ❌ Never uses casual "kom forbi" language')
} else if (bookingPattern === 'impulse_friendly') {
  console.log('  ✅ ALWAYS uses casual "kom forbi" language')
  console.log('  ❌ Never uses booking/reservation terms')
} else {
  console.log('  ✅ Economic modulation (weekend → booking, weekday → casual)')
  console.log('  ✅ Uses brand typical_closings or FREE_CTAS')
}

console.log('\n✅ Done')
