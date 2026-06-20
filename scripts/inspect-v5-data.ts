import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY')!
const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('╔════════════════════════════════════════════════════════════════╗')
console.log('║  V5 DATA FLOW INSPECTION - Café Faust                          ║')
console.log('╚════════════════════════════════════════════════════════════════╝\n')

// ===== INPUT DATA =====
console.log('═══════════════════════════════════════════════════════════════════')
console.log('📥 INPUT DATA (Available to V5 Generator)')
console.log('═══════════════════════════════════════════════════════════════════\n')

const { data: business } = await supabase
  .from('businesses')
  .select('name, about_description, opening_hours, business_locations(address, city, neighborhood)')
  .eq('id', BUSINESS_ID)
  .single()

console.log('Business Profile:')
console.log('─────────────────────────────────────────────────────────────────')
console.log('Name:', business?.name)
console.log('Description:', business?.about_description)
console.log('Opening Hours:', JSON.stringify(business?.opening_hours, null, 2))
console.log('Location:', JSON.stringify(business?.business_locations, null, 2))
console.log()

const { data: menuItems } = await supabase
  .from('menu_items')
  .select('name, category, price, description, availability_schedule')
  .eq('business_id', BUSINESS_ID)
  .limit(10)

console.log('Menu Items (sample):')
console.log('─────────────────────────────────────────────────────────────────')
menuItems?.forEach(item => {
  console.log(`• ${item.name} (${item.category}) - ${item.price} kr`)
  if (item.description) console.log(`  "${item.description}"`)
  if (item.availability_schedule) console.log(`  Schedule: ${JSON.stringify(item.availability_schedule)}`)
})
console.log()

// ===== LAYER 1 OUTPUT =====
console.log('\n═══════════════════════════════════════════════════════════════════')
console.log('🔍 LAYER 1 OUTPUT - Programme Detection')
console.log('═══════════════════════════════════════════════════════════════════\n')

const { data: programmes } = await supabase
  .from('business_programme_profiles')
  .select('*')
  .eq('business_id', BUSINESS_ID)

if (programmes && programmes.length > 0) {
  programmes.forEach(prog => {
    console.log(`Programme: ${prog.programme_name} (${prog.programme_type})`)
    console.log('─────────────────────────────────────────────────────────────────')
    console.log('Time Windows:', JSON.stringify(prog.time_windows, null, 2))
    console.log('Menu Evidence:', JSON.stringify(prog.menu_evidence, null, 2))
    console.log('Confidence:', prog.confidence)
    console.log()
  })
} else {
  console.log('❌ No programmes detected')
}

// ===== LAYER 2 OUTPUT =====
console.log('\n═══════════════════════════════════════════════════════════════════')
console.log('💼 LAYER 2 OUTPUT - Commercial Orientation (per programme)')
console.log('═══════════════════════════════════════════════════════════════════\n')

if (programmes && programmes.length > 0) {
  programmes.forEach(prog => {
    console.log(`Programme: ${prog.programme_name}`)
    console.log('─────────────────────────────────────────────────────────────────')
    console.log('Baseline Goal Split:', JSON.stringify(prog.baseline_goal_split, null, 2))
    console.log('Decision Timing:', prog.decision_timing)
    console.log('Content Type Affinity:', JSON.stringify(prog.content_type_affinity, null, 2))
    console.log()
  })
} else {
  console.log('❌ No commercial orientation data')
}

// ===== LAYER 3 OUTPUT =====
console.log('\n═══════════════════════════════════════════════════════════════════')
console.log('🎯 LAYER 3 OUTPUT - Identity Profile (business-level)')
console.log('═══════════════════════════════════════════════════════════════════\n')

const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_essence, positioning, core_values, what_makes_us_different, identity_confidence, identity_reasoning')
  .eq('business_id', BUSINESS_ID)
  .single()

if (brandProfile) {
  console.log('Brand Essence:')
  console.log(brandProfile.brand_essence || '❌ Missing')
  console.log()
  
  console.log('Positioning:')
  console.log(brandProfile.positioning || '❌ Missing')
  console.log()
  
  console.log('Core Values:')
  console.log(JSON.stringify(brandProfile.core_values, null, 2) || '❌ Missing')
  console.log()
  
  console.log('What Makes Us Different:')
  console.log(brandProfile.what_makes_us_different || '❌ Missing')
  console.log()
  
  console.log('Identity Confidence:')
  console.log(brandProfile.identity_confidence || '❌ Missing')
  console.log()
  
  console.log('Identity Reasoning:')
  console.log(brandProfile.identity_reasoning || '❌ Missing')
  console.log()
} else {
  console.log('❌ No identity profile found')
}

// ===== LAYER 4 OUTPUT =====
console.log('\n═══════════════════════════════════════════════════════════════════')
console.log('👥 LAYER 4 OUTPUT - Audience Segments (per programme)')
console.log('═══════════════════════════════════════════════════════════════════\n')

if (programmes && programmes.length > 0) {
  programmes.forEach(prog => {
    console.log(`Programme: ${prog.programme_name}`)
    console.log('─────────────────────────────────────────────────────────────────')
    console.log('Audience Segments:', JSON.stringify(prog.audience_segments, null, 2))
    console.log()
  })
} else {
  console.log('❌ No audience segments')
}

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log('✅ Inspection Complete')
console.log('═══════════════════════════════════════════════════════════════════')
