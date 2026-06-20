#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('OUTDOOR SEATING DATA INVESTIGATION')
console.log('═══════════════════════════════════════════════════════════════\n')

// 1. Get trigger_configuration
const { data: brandProfile, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('business_id, trigger_configuration')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (profileError) {
  console.error('Profile Error:', profileError)
  process.exit(1)
}

console.log('--- 🔧 TRIGGER_CONFIGURATION.WEATHER_BREAK ---')
const weatherBreak = brandProfile.trigger_configuration?.WEATHER_BREAK
if (weatherBreak) {
  console.log('Enabled:', weatherBreak.enabled ? '✅ YES' : '❌ NO')
  console.log('Reasoning:', weatherBreak.reasoning)
  console.log('Mode:', weatherBreak.mode)
}

// 2. Try to get Profile data
const { data: profile, error: profileDataError } = await supabase
  .from('businesses')
  .select('*')
  .eq('id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

console.log('\n--- 🏪 BUSINESSES TABLE (Profile Data) ---')
if (profileDataError) {
  console.error('Error:', profileDataError.message)
} else if (profile) {
  console.log('Available columns:', Object.keys(profile).join(', '))
  console.log('\nName:', profile.name)
  console.log('Description:', profile.description?.substring(0, 150))
  console.log('Location:', profile.location_name)
  console.log('Outdoor seating:', profile.outdoor_seating ?? 'NOT SET')
  
  // Check for outdoor mentions
  const searchText = `${profile.description || ''} ${profile.location_name || ''}`.toLowerCase()
  const outdoorKeywords = ['terrasse', 'terrace', 'outdoor', 'udenfor', 'ude', 'ved åen', 'åen']
  const found = outdoorKeywords.filter(kw => searchText.includes(kw))
  if (found.length > 0) {
    console.log('\n🌳 Outdoor keywords found:', found.join(', '))
  }
}

// 3. Try business_operations
const { data: ops, error: opsError } = await supabase
  .from('business_operations')
  .select('*')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

console.log('\n--- 🏢 BUSINESS_OPERATIONS TABLE ---')
if (opsError) {
  console.error('Error:', opsError.message)
} else if (ops) {
  console.log('Available columns:', Object.keys(ops).join(', '))
  if ('has_outdoor_seating' in ops) {
    console.log('has_outdoor_seating:', ops.has_outdoor_seating ? '✅ YES' : '❌ NO')
  }
}

// 4. Check menu assets for outdoor mentions
const { data: assets, error: assetsError } = await supabase
  .from('menu_assets')
  .select('asset_url, category_tags, is_exterior')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .limit(10)

console.log('\n--- 📸 MENU_ASSETS (Photo Evidence) ---')
if (!assetsError && assets && assets.length > 0) {
  const exteriorAssets = assets.filter(a => a.is_exterior === true)
  const outdoorTags = assets.filter(a => a.category_tags && (
    a.category_tags.includes('outdoor') || 
    a.category_tags.includes('terrace') ||
    a.category_tags.includes('patio')
  ))
  
  console.log(`Total assets: ${assets.length}`)
  console.log(`Exterior assets: ${exteriorAssets.length}`)
  console.log(`With outdoor tags: ${outdoorTags.length}`)
  
  if (exteriorAssets.length > 0 || outdoorTags.length > 0) {
    console.log('\n✅ Photo evidence suggests outdoor seating exists')
  }
}

console.log('\n--- ⚔️  CONFLICT ANALYSIS ---')

const triggerSaysNo = weatherBreak?.enabled === false && 
                      weatherBreak?.reasoning?.toLowerCase().includes('outdoor')

const profileSaysYes = profile?.outdoor_seating === true
const opsSaysYes = ops?.has_outdoor_seating === true
const photoEvidence = assets?.some(a => a.is_exterior || a.category_tags?.some(t => ['outdoor', 'terrace', 'patio'].includes(t)))

console.log('\nData sources:')
console.log('  trigger_configuration: WEATHER_BREAK disabled (reason: no outdoor seating)')
console.log('  businesses.outdoor_seating:', profile?.outdoor_seating ?? 'NOT SET')
console.log('  business_operations.has_outdoor_seating:', ops?.has_outdoor_seating ?? 'NOT FOUND')
console.log('  menu_assets (photo evidence):', photoEvidence ? '✅ Exterior photos exist' : '❌ No exterior photos')

if (triggerSaysNo && (profileSaysYes || opsSaysYes || photoEvidence)) {
  console.log('\n❌❌❌ CONFLICT DETECTED ❌❌❌')
  console.log('\nThe trigger_configuration incorrectly states "no outdoor seating"')
  console.log('while other data sources suggest outdoor seating exists.')
} else if (!triggerSaysNo) {
  console.log('\n✅ WEATHER_BREAK is enabled - no conflict')
} else {
  console.log('\n⚠️  Cannot verify conflict - need more data')
}

console.log('\n═══════════════════════════════════════════════════════════════\n')
