#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
/**
 * Sync Trigger Configuration with Outdoor Seating Data
 * 
 * Automatically updates trigger_configuration based on business_operations.has_outdoor_seating
 * Fixes AI hallucinations where triggers were disabled due to incorrect outdoor seating assumptions
 * 
 * Usage:
 *   deno run --allow-net --allow-read --allow-env --no-lock _sync_trigger_config_outdoor_seating.mjs
 * 
 * Options:
 *   - Defaults to Café Faust
 *   - Change businessId variable to run for other businesses
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const envContent = await Deno.readTextFile('.env')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/)
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
})

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

// ============================================================================
// CONFIGURATION
// ============================================================================

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Café Faust

console.log('🔄 Syncing Trigger Configuration with Outdoor Seating Data\n')
console.log(`Business ID: ${businessId}\n`)

// ============================================================================
// STEP 1: Fetch Source of Truth
// ============================================================================

console.log('📊 Step 1: Fetching outdoor seating data...')

const { data: operations, error: opsError } = await supabase
  .from('business_operations')
  .select('business_id, has_outdoor_seating, has_kids_menu')
  .eq('business_id', businessId)
  .single()

if (opsError) {
  console.error('❌ Error fetching operations:', opsError)
  Deno.exit(1)
}

const hasOutdoorSeating = operations?.has_outdoor_seating ?? false
const hasKidsMenu = operations?.has_kids_menu ?? false

console.log(`   Outdoor seating: ${hasOutdoorSeating ? '✅ YES' : '❌ NO'}`)
console.log(`   Kids menu:       ${hasKidsMenu ? '✅ YES' : '❌ NO'}`)

// Fetch location context for better reasoning
const { data: location, error: locError } = await supabase
  .from('location_intelligence')
  .select('local_location_reference, category_scores')
  .eq('business_id', businessId)
  .single()

const isWaterfront = location?.category_scores?.waterfront > 0.5
const locationRef = location?.local_location_reference || 'location'

console.log(`   Waterfront:      ${isWaterfront ? '✅ YES' : '❌ NO'}`)
console.log(`   Location:        ${locationRef}`)

// ============================================================================
// STEP 2: Fetch Current Trigger Configuration
// ============================================================================

console.log('\n📋 Step 2: Fetching current trigger configuration...')

const { data: profile, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('business_id, trigger_configuration, trigger_updated_by, trigger_updated_at')
  .eq('business_id', businessId)
  .single()

if (profileError) {
  console.error('❌ Error fetching profile:', profileError)
  Deno.exit(1)
}

const currentConfig = profile?.trigger_configuration || {}

console.log(`   Current WEATHER_BREAK:`)
console.log(`     • enabled: ${currentConfig.WEATHER_BREAK?.enabled ?? 'undefined'}`)
console.log(`     • reasoning: "${currentConfig.WEATHER_BREAK?.reasoning || 'undefined'}"`)

console.log(`   Current FD_WEEK:`)
console.log(`     • enabled: ${currentConfig.FD_WEEK?.enabled ?? 'undefined'}`)
console.log(`     • reasoning: "${currentConfig.FD_WEEK?.reasoning || 'undefined'}"`)

// ============================================================================
// STEP 3: Generate Updated Configuration
// ============================================================================

console.log('\n🔧 Step 3: Generating updated configuration...')

const updatedConfig = { ...currentConfig }
let changesMade = false

// ============================================================================
// WEATHER_BREAK Trigger
// ============================================================================

const weatherShouldBeEnabled = hasOutdoorSeating

if (currentConfig.WEATHER_BREAK) {
  const currentEnabled = currentConfig.WEATHER_BREAK.enabled
  const currentReasoning = currentConfig.WEATHER_BREAK.reasoning || ''
  
  // Check if reasoning mentions "no outdoor seating" (hallucination)
  const hasIncorrectReasoning = currentReasoning.toLowerCase().includes('does not have outdoor seating') ||
                                 currentReasoning.toLowerCase().includes('without outdoor seating') ||
                                 currentReasoning.toLowerCase().includes('no outdoor seating')
  
  if (currentEnabled !== weatherShouldBeEnabled || hasIncorrectReasoning) {
    console.log(`   ⚠️  WEATHER_BREAK needs update:`)
    console.log(`      Current: enabled=${currentEnabled}, needs outdoor seating check`)
    console.log(`      Should be: enabled=${weatherShouldBeEnabled}`)
    
    let newReasoning
    if (hasOutdoorSeating) {
      if (isWaterfront) {
        newReasoning = `Relevant for outdoor seating by ${locationRef} - weather drives foot traffic to waterfront location`
      } else {
        newReasoning = `Relevant for outdoor seating - warm weather increases spontaneous visits and outdoor dining appeal`
      }
    } else {
      newReasoning = `Not applicable as the venue does not have outdoor seating`
    }
    
    updatedConfig.WEATHER_BREAK = {
      ...currentConfig.WEATHER_BREAK,
      enabled: weatherShouldBeEnabled,
      reasoning: newReasoning
    }
    
    changesMade = true
    console.log(`      ✅ Updated reasoning: "${newReasoning}"`)
  } else {
    console.log(`   ✅ WEATHER_BREAK already correct`)
  }
}

// ============================================================================
// FD_WEEK (Father's Day) Trigger
// ============================================================================

if (currentConfig.FD_WEEK) {
  const currentReasoning = currentConfig.FD_WEEK.reasoning || ''
  
  // Check if reasoning mentions incorrect outdoor seating claim
  const hasIncorrectFDReasoning = currentReasoning.toLowerCase().includes('without outdoor seating') ||
                                   currentReasoning.toLowerCase().includes('no outdoor seating') ||
                                   (hasOutdoorSeating && currentReasoning.toLowerCase().includes('not relevant'))
  
  if (hasIncorrectFDReasoning) {
    console.log(`   ⚠️  FD_WEEK has incorrect reasoning mentioning outdoor seating`)
    
    let newReasoning
    if (hasKidsMenu || hasOutdoorSeating) {
      newReasoning = `Relevant for Father's Day celebrations - ${hasKidsMenu ? 'family-friendly menu' : 'outdoor seating'} supports family gatherings`
    } else {
      newReasoning = `Lower priority - venue is more suited for couples and friends rather than family celebrations`
    }
    
    updatedConfig.FD_WEEK = {
      ...currentConfig.FD_WEEK,
      reasoning: newReasoning
    }
    
    changesMade = true
    console.log(`      ✅ Updated reasoning: "${newReasoning}"`)
  } else {
    console.log(`   ✅ FD_WEEK reasoning already correct`)
  }
}

// ============================================================================
// STEP 4: Save Updated Configuration
// ============================================================================

if (!changesMade) {
  console.log('\n✅ No changes needed - trigger configuration already correct!')
  Deno.exit(0)
}

console.log('\n💾 Step 4: Saving updated configuration...')

const { error: updateError } = await supabase
  .from('business_brand_profile')
  .update({
    trigger_configuration: updatedConfig,
    trigger_updated_by: 'auto_sync_outdoor_seating',
    trigger_updated_at: new Date().toISOString()
  })
  .eq('business_id', businessId)

if (updateError) {
  console.error('❌ Error saving configuration:', updateError)
  Deno.exit(1)
}

console.log('✅ Configuration saved successfully!')

// ============================================================================
// STEP 5: Verify Update
// ============================================================================

console.log('\n🔍 Step 5: Verifying update...')

const { data: verifyProfile, error: verifyError } = await supabase
  .from('business_brand_profile')
  .select('trigger_configuration, trigger_updated_by, trigger_updated_at')
  .eq('business_id', businessId)
  .single()

if (verifyError) {
  console.error('❌ Error verifying update:', verifyError)
  Deno.exit(1)
}

console.log(`   Updated by: ${verifyProfile.trigger_updated_by}`)
console.log(`   Updated at: ${verifyProfile.trigger_updated_at}`)
console.log(`   WEATHER_BREAK enabled: ${verifyProfile.trigger_configuration.WEATHER_BREAK?.enabled}`)
console.log(`   WEATHER_BREAK reasoning: "${verifyProfile.trigger_configuration.WEATHER_BREAK?.reasoning}"`)

console.log('\n✅ Sync complete!')
