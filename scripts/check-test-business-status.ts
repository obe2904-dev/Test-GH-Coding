// Check status of all test businesses
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321'
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY not found')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Test business IDs (from setup)
const testBusinessIds = [
  { name: 'Café Solskin', id: 'a42c1b92-38bf-44eb-bd31-1a242fb5c76d' },
  { name: 'Vinbar Nordlys', id: '00bbc61e-5031-4521-bcb5-29dd54c1e5df' },
  { name: 'Coffee House Ø', id: '550c5d13-1732-4150-b3fd-6e6393fe711a' },
  { name: 'Restaurant Havfruen', id: '459962e7-8966-41fe-bcf1-3c427b392386' },
  { name: 'Burger Street', id: '42696ca2-2345-476b-80cd-fbd9fedc1d69' },
  { name: 'Sushi Maru', id: '43df2b64-8ffe-4f3a-b020-a1687d02b3fe' },
  { name: 'Cocktailbar Hemingway', id: 'eb0129bd-6216-4d2d-a496-74327a45dcea' },
  { name: 'Pizzeria Bella', id: 'b262c18d-d485-40d7-abaa-b9ebf96bb110' },
  { name: 'Food Truck Grill Master', id: 'd38fb08f-fb9d-419d-af82-f23557accb8a' },
  { name: 'Restaurant Brasserie 1901', id: 'bc2549e9-88e9-4a35-84f7-75c4c07373cb' }
]

console.log('📊 Checking status of 10 test businesses...\n')

const results = []

for (const business of testBusinessIds) {
  try {
    // Get business data
    const { data: businessData } = await supabase
      .from('businesses')
      .select('name, vertical, created_at')
      .eq('id', business.id)
      .single()

    // Check for business profile
    const { data: profile } = await supabase
      .from('business_profile')
      .select('id')
      .eq('business_id', business.id)
      .single()

    // Check for brand profile
    const { data: brand } = await supabase
      .from('business_brand_profile')
      .select('id, never_say')
      .eq('business_id', business.id)
      .single()

    // Check for strategies
    const { data: strategies, count: strategyCount } = await supabase
      .from('weekly_strategies')
      .select('id', { count: 'exact' })
      .eq('business_id', business.id)

    // Check for generated captions
    const { data: captions, count: captionCount } = await supabase
      .from('social_posts')
      .select('id', { count: 'exact' })
      .eq('business_id', business.id)

    results.push({
      name: businessData?.name || business.name,
      vertical: businessData?.vertical || 'Unknown',
      hasProfile: !!profile,
      hasBrand: !!brand,
      bannedWordsCount: brand?.never_say?.length || 0,
      strategyCount: strategyCount || 0,
      captionCount: captionCount || 0,
      created: businessData?.created_at ? new Date(businessData.created_at).toLocaleDateString() : 'Unknown'
    })

  } catch (error) {
    results.push({
      name: business.name,
      error: error.message
    })
  }
}

// Display results table
console.log('┌──────────────────────────┬──────────┬─────────┬───────┬────────┬───────────┬──────────┐')
console.log('│ Business                 │ Type     │ Profile │ Brand │ Banned │ Strategies│ Captions │')
console.log('├──────────────────────────┼──────────┼─────────┼───────┼────────┼───────────┼──────────┤')

for (const result of results) {
  if (result.error) {
    console.log(`│ ${result.name.padEnd(24)} │ ERROR: ${result.error.padEnd(45)}│`)
  } else {
    const name = result.name.padEnd(24)
    const vertical = result.vertical.padEnd(8)
    const profile = result.hasProfile ? '✅' : '❌'
    const brand = result.hasBrand ? '✅' : '❌'
    const banned = result.bannedWordsCount.toString().padStart(6)
    const strategies = result.strategyCount.toString().padStart(9)
    const captions = result.captionCount.toString().padStart(8)
    
    console.log(`│ ${name} │ ${vertical} │   ${profile}    │  ${brand}   │ ${banned} │ ${strategies} │ ${captions} │`)
  }
}

console.log('└──────────────────────────┴──────────┴─────────┴───────┴────────┴───────────┴──────────┘\n')

// Summary statistics
const completed = results.filter(r => r.hasProfile && r.hasBrand && !r.error)
const withStrategies = results.filter(r => (r.strategyCount || 0) > 0)
const withCaptions = results.filter(r => (r.captionCount || 0) > 0)

console.log('📈 Summary:')
console.log(`   • Businesses created: ${results.length}`)
console.log(`   • Profile completed: ${completed.length}/10 (${Math.round(completed.length/10*100)}%)`)
console.log(`   • Has strategies: ${withStrategies.length}/10 (${Math.round(withStrategies.length/10*100)}%)`)
console.log(`   • Has captions: ${withCaptions.length}/10 (${Math.round(withCaptions.length/10*100)}%)`)

// Onboarding progress
const notStarted = results.filter(r => !r.hasProfile && !r.hasBrand && !r.error)
const inProgress = results.filter(r => (r.hasProfile || r.hasBrand) && (!r.hasProfile || !r.hasBrand))

console.log('\n🎯 Testing Progress:')
if (notStarted.length > 0) {
  console.log(`   ⏸️  Not started: ${notStarted.map(r => r.name).join(', ')}`)
}
if (inProgress.length > 0) {
  console.log(`   🔄 In progress: ${inProgress.map(r => r.name).join(', ')}`)
}
if (completed.length > 0) {
  console.log(`   ✅ Onboarding complete: ${completed.map(r => r.name).join(', ')}`)
}

// Next steps
console.log('\n💡 Next steps:')
if (notStarted.length > 0) {
  console.log('   1. Use magic links from TEST_10_BUSINESSES_GUIDE.md to start onboarding')
}
if (completed.length > 0 && withStrategies.length < completed.length) {
  console.log('   2. Generate weekly strategies for completed businesses')
}
if (withStrategies.length > 0 && withCaptions.length < withStrategies.length) {
  console.log('   3. Generate captions to test V17 banned words enforcement')
}
if (completed.length === 10) {
  console.log('   🎉 All businesses ready! Start full testing workflow.')
}

console.log('')
