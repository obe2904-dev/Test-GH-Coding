import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII'

const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = '840347de-9ba7-4275-8aa3-4553417fc2af'

console.log('🔍 VERIFYING CAFE FAUST & LAYER 2 DATA')
console.log('=' .repeat(60))

// Check 1: Business exists
console.log('\n1️⃣ Checking business record...')
const { data: businesses, error: businessError } = await supabase
  .from('businesses')
  .select('*')
  .eq('id', businessId)

if (businessError || !businesses || businesses.length === 0) {
  console.log('❌ Business not found:', businessError?.message || 'No results')
  Deno.exit(1)
}

const business = businesses[0]

console.log('✅ Business found:', business.short_description)
console.log(`   Target audience: ${business.target_audience}`)

// Check 2: Business profile (Layer 2 brand strategy)
console.log('\n2️⃣ Checking business profile (Layer 2 brand strategy)...')
const { data: profile, error: profileError } = await supabase
  .from('business_profile')
  .select('*')
  .eq('business_id', businessId)
  .single()

if (profileError) {
  console.log('❌ No business profile found')
} else {
  console.log('✅ Business profile exists')
  console.log(`   Brand voice: ${profile.brand_voice?.substring(0, 50)}...`)
  console.log(`   Tone formality: ${profile.tone_formality}`)
  console.log(`   Tone energy: ${profile.tone_energy}`)
}

// Check 3: Menu data
console.log('\n3️⃣ Checking menu data...')
const { data: menuSources, error: menuError } = await supabase
  .from('menu_sources')
  .select('*')
  .eq('business_id', businessId)

if (menuError || !menuSources || menuSources.length === 0) {
  console.log('❌ No menu sources found')
} else {
  console.log(`✅ Menu sources: ${menuSources.length}`)
  
  // Check menu extractions
  const { data: extractions, error: extractError } = await supabase
    .from('menu_extractions')
    .select('*')
    .eq('business_id', businessId)
  
  if (!extractError && extractions) {
    console.log(`✅ Menu extractions: ${extractions.length}`)
  }
  
  // Check menu results
  const { data: menuResults, error: resultsError } = await supabase
    .from('menu_results_v2')
    .select('*')
    .eq('business_id', businessId)
  
  if (!resultsError && menuResults && menuResults.length > 0) {
    console.log(`✅ Menu results: ${menuResults.length}`)
    const result = menuResults[0]
    if (result.menu_data) {
      const menuData = result.menu_data as any
      const categories = menuData.categories || []
      console.log(`   Categories: ${categories.length}`)
      
      let totalItems = 0
      categories.forEach((cat: any) => {
        totalItems += cat.items?.length || 0
      })
      console.log(`   Total menu items: ${totalItems}`)
    }
  }
}

// Check 4: Layer 2 business type defaults
console.log('\n4️⃣ Checking Layer 2 defaults for target audience...')
const { data: defaults, error: defaultsError } = await supabase
  .from('business_type_defaults')
  .select('*')
  .eq('business_type', business.target_audience)
  .single()

if (defaultsError) {
  console.log(`❌ No defaults for ${business.target_audience}`)
} else {
  console.log(`✅ Layer 2 defaults found for ${business.target_audience}`)
  console.log(`   Menu highlight ratio: ${defaults.menu_highlight_ratio * 100}%`)
  console.log(`   Ideal posts per week: ${defaults.ideal_posts_per_week}`)
  console.log(`   Instagram weight: ${defaults.instagram_weight * 100}%`)
  console.log(`   Facebook weight: ${defaults.facebook_weight * 100}%`)
}

// Check 5: Performance tracking
console.log('\n5️⃣ Checking performance tracking (Layer 4)...')
const { data: performance, error: perfError } = await supabase
  .from('content_performance_log')
  .select('*')
  .eq('business_id', businessId)

if (perfError || !performance || performance.length === 0) {
  console.log('⚠️  No performance data yet (expected for new business)')
} else {
  console.log(`✅ Performance records: ${performance.length}`)
}

// Check 6: Layer 5 menu metadata
console.log('\n6️⃣ Checking Layer 5 menu metadata...')
const { data: metadata, error: metaError } = await supabase
  .from('menu_item_metadata')
  .select('*')
  .eq('business_id', businessId)

if (metaError || !metadata || metadata.length === 0) {
  console.log('⚠️  No menu item metadata (needs to be populated from menu_results_v2)')
} else {
  console.log(`✅ Menu item metadata: ${metadata.length} items`)
}

// Check 7: Opportunity tracking
console.log('\n7️⃣ Checking opportunity tracking...')
const { data: opportunities, error: oppError } = await supabase
  .from('opportunity_tracking')
  .select('*')
  .eq('business_id', businessId)

if (oppError || !opportunities || opportunities.length === 0) {
  console.log('⚠️  No opportunities tracked yet')
} else {
  console.log(`✅ Opportunities tracked: ${opportunities.length}`)
}

// Summary
console.log('\n' + '='.repeat(60))
console.log('📊 LAYER 2 → LAYER 5 READINESS FOR CAFE FAUST')
console.log('='.repeat(60))

const checks = [
  { name: 'Business record', status: business ? '✅' : '❌' },
  { name: 'Business profile (Layer 2)', status: profile ? '✅' : '⚠️' },
  { name: 'Menu data', status: menuResults && menuResults.length > 0 ? '✅' : '❌' },
  { name: 'Layer 2 defaults', status: defaults ? '✅' : '❌' },
  { name: 'Performance tracking', status: performance && performance.length > 0 ? '✅' : '⚠️' },
  { name: 'Menu metadata (Layer 5)', status: metadata && metadata.length > 0 ? '✅' : '⚠️' },
  { name: 'Opportunity tracking', status: opportunities && opportunities.length > 0 ? '✅' : '⚠️' }
]

checks.forEach(check => {
  console.log(`${check.status} ${check.name}`)
})

console.log('\n✅ = Ready')
console.log('⚠️  = Not populated yet (can use defaults)')
console.log('❌ = Missing (needs attention)')
