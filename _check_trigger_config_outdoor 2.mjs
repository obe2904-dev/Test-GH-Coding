#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('TRIGGER CONFIGURATION vs BUSINESS OPERATIONS')
console.log('═══════════════════════════════════════════════════════════════\n')

// 1. Get trigger_configuration
const { data: brandProfile, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('business_id, trigger_configuration, brand_profile_v5')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (profileError) {
  console.error('Profile Error:', profileError)
  process.exit(1)
}

// 2. Get business_operations
const { data: operations, error: opsError } = await supabase
  .from('business_operations')
  .select('has_outdoor_seating, operates_year_round')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (opsError) {
  console.error('Operations Error:', opsError)
}

// 3. Get businesses table for additional context
const { data: business, error: bizError } = await supabase
  .from('businesses')
  .select('name, about')
  .eq('id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (bizError) {
  console.error('Business Error:', bizError)
}

console.log('--- 🔧 TRIGGER_CONFIGURATION ---')
if (brandProfile.trigger_configuration) {
  console.log(JSON.stringify(brandProfile.trigger_configuration, null, 2))
  
  // Check for WEATHER_BREAK
  const triggers = brandProfile.trigger_configuration
  if (triggers.WEATHER_BREAK !== undefined) {
    console.log('\n🌤️  WEATHER_BREAK Status:', triggers.WEATHER_BREAK ? '✅ ENABLED' : '❌ DISABLED')
    
    if (triggers.WEATHER_BREAK === false && triggers.reasoning) {
      const weatherReasoning = triggers.reasoning.find(r => r.trigger === 'WEATHER_BREAK')
      if (weatherReasoning) {
        console.log('📝 Reasoning:', weatherReasoning.reason)
        console.log('⚠️  Decision:', weatherReasoning.decision)
      }
    }
  }
} else {
  console.log('⚠️  trigger_configuration is NULL or empty')
}

console.log('\n--- 🏢 BUSINESS_OPERATIONS (Source of Truth) ---')
if (operations) {
  console.log('has_outdoor_seating:', operations.has_outdoor_seating ? '✅ YES' : '❌ NO')
  console.log('operates_year_round:', operations.operates_year_round ? '✅ YES' : '❌ NO')
} else {
  console.log('⚠️  business_operations record not found')
}

console.log('\n--- 🏪 BUSINESS INFO (Context) ---')
if (business) {
  console.log('Name:', business.name)
  console.log('About:', business.about?.substring(0, 200) || 'N/A')
  
  // Check for outdoor mentions in about text
  if (business.about) {
    const aboutLower = business.about.toLowerCase()
    const outdoorKeywords = ['outdoor', 'terrace', 'terrasse', 'udenfor', 'ude', 'åen', 'ved åen', 'waterfront']
    const foundKeywords = outdoorKeywords.filter(kw => aboutLower.includes(kw))
    if (foundKeywords.length > 0) {
      console.log('🌳 Outdoor mentions in about:', foundKeywords.join(', '))
    }
  }
} else {
  console.log('⚠️  business record not found')
}

// Check V5 profile for outdoor seating data
console.log('\n--- 🔍 BRAND_PROFILE_V5 (Nested Data) ---')
if (brandProfile.brand_profile_v5) {
  const v5 = brandProfile.brand_profile_v5
  
  // Check operations section
  if (v5.operations) {
    console.log('V5 Operations:', JSON.stringify(v5.operations, null, 2))
  }
  
  // Check programmes for outdoor context
  if (v5.programmes && Array.isArray(v5.programmes)) {
    const outdoorMentions = v5.programmes.filter(p => {
      const text = JSON.stringify(p).toLowerCase()
      return text.includes('outdoor') || text.includes('terrace') || text.includes('terrasse') || text.includes('udenfor')
    })
    if (outdoorMentions.length > 0) {
      console.log('\n🌳 Outdoor mentions in programmes:')
      outdoorMentions.forEach(p => {
        console.log(`  - ${p.programme_name}`)
        if (p.programme_description) {
          console.log(`    → ${p.programme_description.substring(0, 100)}...`)
        }
      })
    }
  }
}

console.log('\n--- ⚔️  CONFLICT DETECTION ---')
const triggerSaysNo = brandProfile.trigger_configuration?.WEATHER_BREAK === false
const operationsSaysYes = operations?.has_outdoor_seating === true

if (triggerSaysNo && operationsSaysYes) {
  console.log('\n❌❌❌ CONFLICT DETECTED ❌❌❌')
  console.log('trigger_configuration says: NO outdoor seating (WEATHER_BREAK disabled)')
  console.log('business_operations says: YES outdoor seating')
  console.log('\n🚨 Impact: Valid weather-triggered suggestions will be suppressed!')
} else if (!triggerSaysNo && operationsSaysYes) {
  console.log('\n✅ No conflict - both agree outdoor seating exists')
} else if (triggerSaysNo && !operationsSaysYes) {
  console.log('\n✅ No conflict - both agree no outdoor seating')
} else {
  console.log('\n⚠️  Cannot determine - missing data')
}

console.log('\n--- 💡 RECOMMENDATION ---')
if (triggerSaysNo && operationsSaysYes) {
  console.log('\n1. Update trigger_configuration.WEATHER_BREAK = true')
  console.log('2. Remove or update reasoning to reflect outdoor seating presence')
  console.log('3. Source of truth: business_operations.has_outdoor_seating')
  console.log('4. Priority: MEDIUM (dormant now, but will break weather triggers when wired)')
}

console.log('\n═══════════════════════════════════════════════════════════════\n')
