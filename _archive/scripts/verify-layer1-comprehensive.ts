/**
 * LAYER 1 COMPREHENSIVE VERIFICATION
 * 
 * Verifies complete data flow from UI pages to database tables:
 * - Profile page → businesses, business_profile tables
 * - Menu page → menu_sources, menu_extractions tables
 * - Operation page → business_operations table
 * - Location page → business_location_intelligence table
 * - Concept Fit page → concept_fit_by_category
 * - Content Style page → business_profile (tone, voice)
 * - Social Media → profiles.selected_platforms
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

console.log('🔍 LAYER 1 COMPREHENSIVE VERIFICATION\n')
console.log('   Checking UI → Database data flow for all Setup pages\n')
console.log('═══════════════════════════════════════════════════════════════\n')

let totalComponents = 0
let workingComponents = 0

function logComponent(emoji: string, name: string, status: 'working' | 'empty' | 'missing', details?: string) {
  totalComponents++
  if (status === 'working') workingComponents++
  
  const icon = status === 'working' ? '✅' : status === 'empty' ? '⚠️' : '❌'
  console.log(`${emoji} ${icon} ${name}`)
  if (details) console.log(`      ${details}`)
}

// Get user and business
const { data: authData } = await supabase.auth.getUser()
const user = authData?.user

if (!user) {
  console.log('❌ No authenticated user - cannot verify data')
  console.log('   Please ensure you\'re logged in to production Supabase\n')
  Deno.exit(1)
}

const { data: businesses } = await supabase
  .from('businesses')
  .select('id, name, owner_id')
  .eq('owner_id', user.id)
  .limit(1)

const businessId = businesses?.[0]?.id
const businessName = businesses?.[0]?.name

console.log(`👤 User: ${user.email}`)
console.log(`🏢 Business: ${businessName || 'Not found'}`)
console.log(`🆔 Business ID: ${businessId || 'N/A'}`)
console.log('\n───────────────────────────────────────────────────────────────\n')

if (!businessId) {
  console.log('⚠️  No business found for this user')
  console.log('   This could be a test account or onboarding not completed\n')
}

// ============================================================================
// 1. PROFILE PAGE → businesses + business_profile
// ============================================================================
console.log('📋 1. PROFILE PAGE (Virksomhedsprofil)\n')

const { data: business } = await supabase
  .from('businesses')
  .select('*')
  .eq('owner_id', user.id)
  .single()

logComponent('   ', 'Business record', business ? 'working' : 'missing',
  business ? `Name: ${business.name}, Vertical: ${business.vertical || 'not set'}` : 'No business record')

const { data: profile } = await supabase
  .from('business_profile')
  .select('*')
  .eq('business_id', businessId)
  .maybeSingle()

logComponent('   ', 'Business profile', profile ? 'working' : 'empty',
  profile ? `Website: ${profile.website_url || 'none'}, Description: ${profile.short_description ? 'set' : 'none'}` : 'Profile not created yet')

const { data: location } = await supabase
  .from('business_locations')
  .select('*')
  .eq('business_id', businessId)
  .eq('is_primary', true)
  .maybeSingle()

logComponent('   ', 'Business location', location ? 'working' : 'empty',
  location ? `${location.city}, ${location.postal_code}` : 'Location not set')

console.log('')

// ============================================================================
// 2. MENU PAGE → menu_sources + menu_extractions
// ============================================================================
console.log('🍽️  2. MENU PAGE (Menukort)\n')

const { data: menuSources } = await supabase
  .from('menu_sources')
  .select('*')
  .eq('business_id', businessId)

logComponent('   ', 'Menu sources', menuSources && menuSources.length > 0 ? 'working' : 'empty',
  menuSources ? `${menuSources.length} menu URL(s) added` : 'No menus added')

const { data: menuExtractions } = await supabase
  .from('menu_extractions')
  .select('id, menu_name, extracted_data')
  .eq('business_id', businessId)

logComponent('   ', 'Menu extractions', menuExtractions && menuExtractions.length > 0 ? 'working' : 'empty',
  menuExtractions && menuExtractions.length > 0 
    ? `${menuExtractions.length} menus extracted`
    : 'No menus extracted yet')

if (menuExtractions && menuExtractions.length > 0) {
  const firstMenu = menuExtractions[0]
  const data = firstMenu.extracted_data as any
  const itemCount = data?.categories?.reduce((sum: number, cat: any) => sum + (cat.items?.length || 0), 0) || 0
  console.log(`      Sample: "${firstMenu.menu_name}" - ${itemCount} items`)
}

console.log('')

// ============================================================================
// 3. OPERATION PAGE → business_operations
// ============================================================================
console.log('⚙️  3. OPERATION PAGE (Drift)\n')

const { data: operations } = await supabase
  .from('business_operations')
  .select('*')
  .eq('business_id', businessId)
  .maybeSingle()

logComponent('   ', 'Business operations', operations ? 'working' : 'empty',
  operations 
    ? `Establishment: ${operations.establishment_type || 'not set'}, Outdoor seating: ${operations.has_outdoor_seating ? 'yes' : 'no'}`
    : 'Operations not configured')

if (operations?.opening_hours) {
  const hours = operations.opening_hours as any
  const daysSet = Object.keys(hours).filter(day => hours[day]?.open).length
  console.log(`      Opening hours: ${daysSet}/7 days configured`)
}

if (operations?.service_periods) {
  const periods = operations.service_periods as any
  console.log(`      Service periods: ${periods.length || 0} period(s)`)
}

console.log('')

// ============================================================================
// 4. LOCATION PAGE → business_location_intelligence
// ============================================================================
console.log('📍 4. LOCATION PAGE (Lokation)\n')

const { data: locationIntel } = await supabase
  .from('business_location_intelligence')
  .select('*')
  .eq('business_id', businessId)
  .maybeSingle()

logComponent('   ', 'Location intelligence', locationIntel ? 'working' : 'empty',
  locationIntel ? `Primary: ${locationIntel.area_type || 'not analyzed'}` : 'Location not analyzed')

if (locationIntel?.category_scores) {
  const scores = locationIntel.category_scores as any
  const detected = Object.entries(scores)
    .filter(([_, score]) => (score as number) >= 60)
    .map(([cat]) => cat)
  console.log(`      Detected types: ${detected.join(', ') || 'none'}`)
}

console.log('')

// ============================================================================
// 5. CONCEPT FIT PAGE → concept_fit_by_category
// ============================================================================
console.log('🎯 5. CONCEPT FIT PAGE (Koncept Fit)\n')

if (locationIntel?.concept_fit_by_category) {
  const fits = locationIntel.concept_fit_by_category as any
  const fitsCount = Object.keys(fits).length
  
  logComponent('   ', 'Concept fit analysis', fitsCount > 0 ? 'working' : 'empty',
    `${fitsCount} location type(s) analyzed`)
  
  if (fitsCount > 0) {
    Object.entries(fits).forEach(([cat, fit]: [string, any]) => {
      console.log(`      ${cat}: ${fit.fit_level} fit`)
    })
  }
} else {
  logComponent('   ', 'Concept fit analysis', 'empty', 'Not yet analyzed')
}

console.log('')

// ============================================================================
// 6. CONTENT STYLE PAGE → business_profile (brand voice, tone)
// ============================================================================
console.log('✨ 6. CONTENT STYLE PAGE (Indholdsstil)\n')

const { data: brandProfile } = await supabase
  .from('business_profile')
  .select('brand_voice, tone_formality, tone_energy, content_focus')
  .eq('business_id', businessId)
  .maybeSingle()

logComponent('   ', 'Brand voice', brandProfile?.brand_voice ? 'working' : 'empty',
  brandProfile?.brand_voice || 'Not generated')

logComponent('   ', 'Tone settings', brandProfile?.tone_formality ? 'working' : 'empty',
  brandProfile ? `Formality: ${brandProfile.tone_formality || 'not set'}, Energy: ${brandProfile.tone_energy || 'not set'}` : 'Not configured')

console.log('')

// ============================================================================
// 7. SOCIAL MEDIA → profiles.selected_platforms
// ============================================================================
console.log('📱 7. SOCIAL MEDIA CONNECTIONS\n')

const { data: userProfile } = await supabase
  .from('profiles')
  .select('selected_platforms')
  .eq('id', user.id)
  .single()

const platforms = userProfile?.selected_platforms as any
logComponent('   ', 'Platform selection', platforms && platforms.length > 0 ? 'working' : 'empty',
  platforms && platforms.length > 0 ? `Selected: ${platforms.join(', ')}` : 'No platforms selected')

console.log('')
console.log('═══════════════════════════════════════════════════════════════\n')

// ============================================================================
// LAYER 5 ENHANCEMENTS
// ============================================================================
console.log('🎯 LAYER 5 ENHANCEMENTS (Menu Scoring System)\n')

const { data: menuMetadata } = await supabase
  .from('menu_item_metadata')
  .select('*')
  .eq('business_id', businessId)

logComponent('   ', 'Menu item metadata', menuMetadata && menuMetadata.length > 0 ? 'working' : 'empty',
  menuMetadata ? `${menuMetadata.length} items with scoring metadata` : 'No metadata yet')

const { data: seasonalIngredients } = await supabase
  .from('seasonal_ingredients')
  .select('*')
  .eq('country', 'DK')
  .limit(10)

logComponent('   ', 'Seasonal ingredients DB', seasonalIngredients && seasonalIngredients.length > 0 ? 'working' : 'missing',
  seasonalIngredients ? `${seasonalIngredients.length}+ Danish ingredients` : 'Database not populated')

console.log('')
console.log('═══════════════════════════════════════════════════════════════\n')

// ============================================================================
// SUMMARY
// ============================================================================
const percentage = totalComponents > 0 ? ((workingComponents / totalComponents) * 100).toFixed(0) : 0

console.log(`📊 LAYER 1 STATUS: ${workingComponents}/${totalComponents} components working (${percentage}%)\n`)

if (workingComponents === totalComponents) {
  console.log('✅ LAYER 1 FULLY OPERATIONAL!')
  console.log('   All UI pages are connected to database correctly')
} else if (workingComponents / totalComponents > 0.5) {
  console.log('🟡 LAYER 1 PARTIALLY OPERATIONAL')
  console.log('   Some data missing - user may not have completed all setup pages')
} else {
  console.log('❌ LAYER 1 NOT OPERATIONAL')
  console.log('   Critical data missing - verify user has completed onboarding')
}

console.log('\n📝 RECOMMENDATIONS:\n')

if (!businessId) {
  console.log('🔴 CRITICAL: No business found for this user')
  console.log('   → User needs to complete onboarding')
}

if (!menuExtractions || menuExtractions.length === 0) {
  console.log('⚠️  No menu data extracted')
  console.log('   → User should add menu URLs on "Menukort" page')
}

if (!locationIntel || !locationIntel.area_type) {
  console.log('⚠️  Location intelligence not analyzed')
  console.log('   → User should complete "Lokation" page setup')
}

if (!brandProfile || !brandProfile.brand_voice) {
  console.log('⚠️  Brand voice not generated')
  console.log('   → User should generate brand profile')
}

if (workingComponents === totalComponents) {
  console.log('✅ System ready for Layer 2 (Strategic Baselines) verification')
}

console.log('\n💡 To fix empty components:')
console.log('   1. Log into production UI as this user')
console.log('   2. Complete all Setup pages in sidebar')
console.log('   3. Re-run this verification')
