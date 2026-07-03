/**
 * LAYER 1 VERIFICATION
 * 
 * Verifies all Layer 1 components are deployed and working:
 * 1. Business Identity Profile
 * 2. Location Intelligence
 * 3. Menu Database
 * 4. Brand Voice & Messaging
 * 5. Visual Assets
 * 6. Operating Hours & Service Periods
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Load .env
const envFile = await Deno.readTextFile('.env');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...values] = trimmed.split('=');
    if (key && values.length) {
      env[key] = values.join('=');
    }
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log('🔍 LAYER 1 VERIFICATION - Information Foundation\n')
console.log('═══════════════════════════════════════════════════════════════\n')

let totalChecks = 0
let passedChecks = 0

function check(name: string, passed: boolean, details?: string) {
  totalChecks++
  if (passed) passedChecks++
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}`)
  if (details) console.log(`   ${details}`)
}

// Component 1: Business Identity Profile
console.log('📋 Component 1: Business Identity Profile\n')

const { data: businesses, error: bizError } = await supabase
  .from('businesses')
  .select('id, name, vertical')
  .limit(5)

check('businesses table exists', !bizError)
check('businesses table has data', businesses && businesses.length > 0, 
  businesses ? `${businesses.length} businesses found` : '0 businesses')

// Check business_operations table
const { data: bizOps, error: opsError } = await supabase
  .from('business_operations')
  .select('*')
  .limit(5)

check('business_operations table exists', !opsError)
check('business_operations has establishment_type', bizOps && bizOps.length > 0 && 'establishment_type' in bizOps[0])
check('business_operations has has_outdoor_seating', bizOps && bizOps.length > 0 && 'has_outdoor_seating' in bizOps[0])

console.log('')

// Component 2: Location Intelligence
console.log('🗺️  Component 2: Location Intelligence\n')

const { data: locationIntel, error: locError } = await supabase
  .from('business_location_intelligence')
  .select('*')
  .limit(5)

check('business_location_intelligence table exists', !locError)
check('has category_scores column', locationIntel && locationIntel.length > 0 && 'category_scores' in locationIntel[0])
check('has area_type column', locationIntel && locationIntel.length > 0 && 'area_type' in locationIntel[0])

if (locationIntel && locationIntel.length > 0) {
  const first = locationIntel[0]
  console.log(`   📍 Sample: ${first.area_type}`)
  if (first.category_scores) {
    const scores = first.category_scores as any
    const categories = Object.keys(scores).filter(k => scores[k] > 0)
    console.log(`   📊 Location types detected: ${categories.join(', ')}`)
  }
}

console.log('')

// Component 3: Menu Database
console.log('🍽️  Component 3: Menu Database\n')

const { data: menuSources, error: menuSourceError } = await supabase
  .from('menu_sources')
  .select('*')
  .limit(5)

check('menu_sources table exists', !menuSourceError)

const { data: menuExtractions, error: menuExtError } = await supabase
  .from('menu_extractions')
  .select('id, business_id, menu_name, extracted_data')
  .limit(5)

check('menu_extractions table exists', !menuExtError)
check('menu_extractions has data', menuExtractions && menuExtractions.length > 0,
  menuExtractions ? `${menuExtractions.length} menu extractions found` : '0 extractions')

if (menuExtractions && menuExtractions.length > 0) {
  const first = menuExtractions[0]
  const data = first.extracted_data as any
  const totalItems = data?.categories?.reduce((sum: number, cat: any) => sum + (cat.items?.length || 0), 0) || 0
  console.log(`   📋 Sample menu: "${first.menu_name}" - ${data?.categories?.length || 0} categories, ${totalItems} items`)
}

const { data: menuResultsV2, error: menuV2Error } = await supabase
  .from('menu_results_v2')
  .select('*')
  .limit(5)

check('menu_results_v2 table exists (parsing queue)', !menuV2Error)

console.log('')

// Component 4: Brand Voice & Messaging
console.log('💬 Component 4: Brand Voice & Messaging\n')

const { data: brandProfile, error: brandError } = await supabase
  .from('business_profile')
  .select('business_id, brand_voice, tone_formality')
  .limit(5)

check('business_profile table exists', !brandError)
check('has brand_voice column', brandProfile && brandProfile.length > 0 && 'brand_voice' in brandProfile[0])
check('has tone_formality column', brandProfile && brandProfile.length > 0 && 'tone_formality' in brandProfile[0])

console.log('')

// Component 5: Visual Assets
console.log('🖼️  Component 5: Visual Assets\n')

const { data: mediaAssets, error: mediaError } = await supabase
  .from('media_assets')
  .select('*')
  .limit(5)

check('media_assets table exists', !mediaError)
check('media_assets has data', mediaAssets && mediaAssets.length > 0,
  mediaAssets ? `${mediaAssets.length} media assets found` : '0 assets')

console.log('')

// Component 6: Operating Hours & Service Periods
console.log('⏰ Component 6: Operating Hours & Service Periods\n')

const { data: operations, error: operError } = await supabase
  .from('business_operations')
  .select('business_id, opening_hours, service_periods')
  .limit(5)

check('has opening_hours column', operations && operations.length > 0 && 'opening_hours' in operations[0])
check('has service_periods column', operations && operations.length > 0 && 'service_periods' in operations[0])

if (operations && operations.length > 0) {
  const first = operations[0]
  if (first.service_periods) {
    const periods = first.service_periods as any
    console.log(`   🕐 Service periods detected: ${periods.length || 0}`)
  }
}

console.log('')

// Layer 5 Enhancement: Menu Item Metadata
console.log('🎯 Layer 5 Enhancement: Menu Scoring System\n')

const { data: menuMetadata, error: metadataError } = await supabase
  .from('menu_item_metadata')
  .select('*')
  .limit(5)

check('menu_item_metadata table exists', !metadataError)
check('menu_item_metadata populated', menuMetadata && menuMetadata.length > 0,
  menuMetadata ? `${menuMetadata.length} items with scoring metadata` : '0 items')

const { data: seasonalIngredients, error: seasonalError } = await supabase
  .from('seasonal_ingredients')
  .select('*')
  .limit(10)

check('seasonal_ingredients table exists', !seasonalError)
check('seasonal_ingredients populated', seasonalIngredients && seasonalIngredients.length > 0,
  seasonalIngredients ? `${seasonalIngredients.length} seasonal ingredients (Danish)` : '0 ingredients')

const { data: opportunityTracking, error: trackingError } = await supabase
  .from('opportunity_tracking')
  .select('*')
  .limit(5)

check('opportunity_tracking table exists', !trackingError)

console.log('')
console.log('═══════════════════════════════════════════════════════════════\n')

// Summary
const percentage = ((passedChecks / totalChecks) * 100).toFixed(0)
console.log(`📊 LAYER 1 STATUS: ${passedChecks}/${totalChecks} checks passed (${percentage}%)\n`)

if (passedChecks === totalChecks) {
  console.log('✅ LAYER 1 FULLY DEPLOYED AND OPERATIONAL!')
} else if (passedChecks / totalChecks > 0.7) {
  console.log('🟡 LAYER 1 MOSTLY DEPLOYED (some components missing data)')
} else {
  console.log('❌ LAYER 1 INCOMPLETE (critical components missing)')
}

console.log('\n📝 KEY FINDINGS:\n')

if (!businesses || businesses.length === 0) {
  console.log('⚠️  No businesses in database - this appears to be a test/empty environment')
  console.log('   For production verification, connect to production Supabase project')
}

if (!menuExtractions || menuExtractions.length === 0) {
  console.log('⚠️  No menu extractions found')
  console.log('   Users need to add menu URLs on "Menukort" page and extract them')
}

if (menuMetadata && menuMetadata.length > 0) {
  console.log('✅ Layer 5 menu scoring system is deployed and ready')
  console.log('   Menu items can be scored for weekly content planning')
}

console.log('\n🚀 NEXT STEPS:\n')
console.log('1. If this is test environment: Populate with sample business data')
console.log('2. If this is production: Verify with actual business credentials')
console.log('3. Proceed to Layer 2 verification (Strategic Baselines)')
