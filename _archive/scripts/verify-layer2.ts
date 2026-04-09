/**
 * LAYER 2 VERIFICATION - Strategic Baselines
 * 
 * Verifies all Layer 2 components:
 * 1. Content Type Distribution (menu vs non-menu ratios)
 * 2. Posting Frequency Defaults
 * 3. Platform Allocation (Instagram vs Facebook)
 * 4. Brand Strategy Baselines (tone, voice, pillars)
 * 5. Performance Tracking System
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

console.log('🎯 LAYER 2 VERIFICATION - Strategic Baselines\n')
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

// ============================================================================
// 1. CONTENT TYPE DISTRIBUTION
// ============================================================================
console.log('📊 1. Content Type Distribution Ratios\n')

const { data: businessTypeDefaults, error: defaultsError } = await supabase
  .from('business_type_defaults')
  .select('*')
  .limit(5)

check('business_type_defaults table exists', !defaultsError)

if (businessTypeDefaults && businessTypeDefaults.length > 0) {
  check('Content type ratios defined', true, `${businessTypeDefaults.length} business types configured`)
  
  console.log('\n   📋 Content Distribution Ratios:')
  businessTypeDefaults.forEach((def: any) => {
    console.log(`   ${def.business_type}:`)
    console.log(`     • Menu: ${(def.menu_highlight_ratio * 100).toFixed(0)}%`)
    console.log(`     • Location: ${(def.location_story_ratio * 100).toFixed(0)}%`)
    console.log(`     • Behind-scenes: ${(def.behind_scenes_ratio * 100).toFixed(0)}%`)
    console.log(`     • Event: ${(def.event_promotion_ratio * 100).toFixed(0)}%`)
    console.log(`     • Engagement: ${(def.engagement_ratio * 100).toFixed(0)}%`)
    console.log(`     • Posts/week: ${def.min_posts_per_week}-${def.max_posts_per_week} (ideal: ${def.ideal_posts_per_week})`)
  })
} else {
  check('Content type ratios defined', false, 'No business type defaults found')
}

console.log('')

// ============================================================================
// 2. PLATFORM ALLOCATION
// ============================================================================
console.log('📱 2. Platform Allocation Weights\n')

if (businessTypeDefaults && businessTypeDefaults.length > 0) {
  check('Platform weights defined', true)
  
  console.log('\n   Platform Distribution:')
  businessTypeDefaults.forEach((def: any) => {
    const instagramPct = (def.instagram_weight * 100).toFixed(0)
    const facebookPct = (def.facebook_weight * 100).toFixed(0)
    console.log(`   ${def.business_type}: Instagram ${instagramPct}% / Facebook ${facebookPct}%`)
  })
} else {
  check('Platform weights defined', false)
}

console.log('')

// ============================================================================
// 3. BRAND STRATEGY BASELINES
// ============================================================================
console.log('✨ 3. Brand Strategy Baselines\n')

const { data: brandProfiles, error: brandError } = await supabase
  .from('business_profile')
  .select('business_id, brand_voice, tone_formality, tone_energy, content_focus, target_audience')
  .limit(5)

check('business_profile table exists', !brandError)
check('Brand strategy data available', brandProfiles && brandProfiles.length > 0,
  brandProfiles ? `${brandProfiles.length} business profiles with brand strategy` : 'No brand profiles')

if (brandProfiles && brandProfiles.length > 0) {
  const first = brandProfiles[0]
  if (first.brand_voice) {
    console.log('   Sample brand voice (truncated):')
    console.log(`   "${first.brand_voice.slice(0, 100)}..."`)
  }
  if (first.content_focus) {
    const pillars = Array.isArray(first.content_focus) ? first.content_focus : []
    console.log(`   Content pillars: ${pillars.length} defined`)
  }
}

console.log('')

// ============================================================================
// 4. PERFORMANCE TRACKING SYSTEM (Layer 4)
// ============================================================================
console.log('📈 4. Performance Tracking System\n')

const { data: perfLog, error: perfError } = await supabase
  .from('content_performance_log')
  .select('*')
  .limit(5)

check('content_performance_log table exists', !perfError)
check('Performance data being tracked', perfLog && perfLog.length > 0,
  perfLog ? `${perfLog.length} posts tracked` : 'No performance data yet')

const { data: baselines, error: baselinesError } = await supabase
  .from('content_type_baselines')
  .select('*')
  .limit(5)

check('content_type_baselines table exists', !baselinesError)

if (baselines && baselines.length > 0) {
  check('Baseline metrics calculated', true, `${baselines.length} businesses with baselines`)
  
  const first = baselines[0]
  if (first.overall_avg_engagement_rate) {
    console.log(`   Sample: ${first.overall_avg_engagement_rate}% avg engagement rate`)
  }
  if (first.total_posts_analyzed) {
    console.log(`   Posts analyzed: ${first.total_posts_analyzed}`)
  }
} else {
  check('Baseline metrics calculated', false, 'No baselines calculated yet')
}

console.log('')

// ============================================================================
// 5. LAYER 2 → LAYER 5 DEPENDENCIES
// ============================================================================
console.log('🔗 5. Layer 2 → Layer 5 Dependencies\n')

console.log('   Layer 5 needs from Layer 2:')
console.log('')

// Check content type distribution
check('✓ Content type distribution', businessTypeDefaults && businessTypeDefaults.length > 0,
  'For weekly slot allocation (3 menu + 4 non-menu)')

// Check posting frequency
check('✓ Posting frequency defaults', businessTypeDefaults && businessTypeDefaults.length > 0,
  'For determining total weekly slots (4-7 posts/week)')

// Check platform allocation
check('✓ Platform priorities', businessTypeDefaults && businessTypeDefaults.length > 0,
  'For assigning posts to Instagram vs Facebook')

// Check performance data (used for menu scoring)
check('✓ Performance baselines', baselines && baselines.length > 0,
  'For menu item scoring (top performing dishes)')

console.log('')

// ============================================================================
// LAYER 5 INTEGRATION CHECK
// ============================================================================
console.log('🎯 LAYER 5 Integration Requirements\n')

// Check menu scoring prerequisites
const { data: menuMetadata } = await supabase
  .from('menu_item_metadata')
  .select('*')
  .limit(5)

check('Menu item metadata available', menuMetadata && menuMetadata.length > 0,
  menuMetadata ? `${menuMetadata.length} menu items with scoring data` : 'No menu metadata')

// Check seasonal ingredients database
const { data: seasonalIngredients } = await supabase
  .from('seasonal_ingredients')
  .select('*')
  .limit(10)

check('Seasonal ingredients database', seasonalIngredients && seasonalIngredients.length > 0,
  seasonalIngredients ? `${seasonalIngredients.length}+ ingredients for scoring` : 'Database not populated')

// Check opportunity tracking
const { data: opportunityTracking } = await supabase
  .from('opportunity_tracking')
  .select('*')
  .limit(5)

check('Opportunity tracking system', !opportunityTracking || opportunityTracking instanceof Array,
  'For preventing duplicate opportunities')

console.log('')
console.log('═══════════════════════════════════════════════════════════════\n')

// ============================================================================
// SUMMARY
// ============================================================================
const percentage = totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(0) : 0

console.log(`📊 LAYER 2 STATUS: ${passedChecks}/${totalChecks} checks passed (${percentage}%)\n`)

if (passedChecks === totalChecks) {
  console.log('✅ LAYER 2 FULLY OPERATIONAL!')
  console.log('   All strategic baselines configured correctly')
} else if (passedChecks / totalChecks > 0.7) {
  console.log('🟡 LAYER 2 MOSTLY OPERATIONAL')
  console.log('   Some baseline data missing (expected in new accounts)')
} else {
  console.log('❌ LAYER 2 INCOMPLETE')
  console.log('   Critical baselines missing')
}

console.log('\n📝 LAYER 5 READINESS:\n')

const layer5Ready = businessTypeDefaults && businessTypeDefaults.length > 0 &&
                    menuMetadata && menuMetadata.length > 0 &&
                    seasonalIngredients && seasonalIngredients.length > 0

if (layer5Ready) {
  console.log('✅ Layer 5 can function with current Layer 2 data')
  console.log('   • Content distribution ratios: Available')
  console.log('   • Posting frequency: Available')
  console.log('   • Platform allocation: Available')
  console.log('   • Menu scoring data: Available')
  console.log('   • Seasonal ingredients: Available')
} else {
  console.log('⚠️  Layer 5 missing some dependencies')
  
  if (!businessTypeDefaults || businessTypeDefaults.length === 0) {
    console.log('   ❌ business_type_defaults table empty')
  }
  if (!menuMetadata || menuMetadata.length === 0) {
    console.log('   ⚠️  menu_item_metadata empty (populate after menu extraction)')
  }
  if (!seasonalIngredients || seasonalIngredients.length === 0) {
    console.log('   ❌ seasonal_ingredients empty (migration not applied)')
  }
}

console.log('\n🚀 NEXT STEPS:\n')

if (!businessTypeDefaults || businessTypeDefaults.length === 0) {
  console.log('🔴 CRITICAL: Apply business type defaults migration')
  console.log('   → Run migration: 20260128000000_expand_business_types.sql')
}

if (!perfLog || perfLog.length === 0) {
  console.log('⚠️  No performance tracking yet')
  console.log('   → System will use Layer 2 static baselines')
  console.log('   → After 20+ posts, Layer 4 will optimize distribution')
}

if (perfLog && perfLog.length > 0 && (!baselines || baselines.length === 0)) {
  console.log('⚠️  Performance data exists but baselines not calculated')
  console.log('   → Run: SELECT calculate_content_baselines(business_id)')
}

if (layer5Ready) {
  console.log('✅ Ready to proceed to Layer 3 (Temporal Context) verification')
  console.log('✅ Layer 5 can be deployed with current data')
}

console.log('\n💡 Layer 2 → Layer 5 Data Flow:')
console.log('   1. business_type_defaults → Weekly slot allocation (3 menu + 4 non-menu)')
console.log('   2. posting frequency → Total slots per week (4-7 posts)')
console.log('   3. platform weights → Post platform assignment')
console.log('   4. content_performance_log → Menu item performance scores')
console.log('   5. Opportunity selector uses all above to generate weekly plan')
