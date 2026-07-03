#!/usr/bin/env node
/**
 * PHASE 1: DATA AUDIT & MAPPING
 * 
 * Comprehensive audit of business intelligence data for Cafe Faust
 * Verifies database structure and retrieves all relevant context for strategy generation
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// Load .env.local file
function parseDotEnv(contents) {
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const eq = normalized.indexOf('=')
    if (eq === -1) continue
    const key = normalized.slice(0, eq).trim()
    let value = normalized.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

function loadEnvFromFiles() {
  const cwd = process.cwd()
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(cwd, filename)
    if (!fs.existsSync(fullPath)) continue
    try {
      const parsed = parseDotEnv(fs.readFileSync(fullPath, 'utf8'))
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] == null) process.env[k] = v
      }
    } catch {
      // ignore
    }
  }
}

loadEnvFromFiles()

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  serviceRoleKey
)

const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Café Faust (production)

// ============================================================================
// 1. PROGRAMME PROFILES AUDIT
// ============================================================================

async function auditProgrammeProfiles() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 PROGRAMME PROFILES AUDIT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  // First, check if table has any data
  const { data: sampleData, error: sampleError } = await supabase
    .from('business_programme_profiles')
    .select('business_id')
    .limit(5)
  
  if (sampleError) {
    console.error('❌ Table access error:', sampleError.message)
    return null
  }
  
  console.log(`📊 Sample data check: ${sampleData?.length || 0} rows in table`)
  if (sampleData && sampleData.length > 0) {
    const uniqueBusinessIds = [...new Set(sampleData.map(d => d.business_id))]
    console.log(`   Found business_ids: ${uniqueBusinessIds.map(id => id.substring(0, 8)).join(', ')}...\n`)
  }
  
  const { data, error } = await supabase
    .from('business_programme_profiles')
    .select('*')
    .eq('business_id', CAFE_FAUST_ID)
    .order('programme_name')
  
  if (error) {
    console.error('❌ Error:', error.message)
    return null
  }
  
  if (!data || data.length === 0) {
    console.log('❌ No programme profiles found\n')
    return null
  }
  
  console.log(`✅ Found ${data.length} service periods\n`)
  
  for (const prog of data) {
    console.log(`━━━ ${prog.programme_name.toUpperCase()} ━━━`)
    console.log(`Type: ${prog.programme_type}`)
    console.log(`Hours: ${prog.start_time} - ${prog.end_time}`)
    console.log(`\nCommercial Goals:`)
    if (prog.baseline_goal_split) {
      console.log(`  • Drive Footfall: ${prog.baseline_goal_split.drive_footfall}%`)
      console.log(`  • Strengthen Brand: ${prog.baseline_goal_split.strengthen_brand}%`)
      console.log(`  • Retain Loyalty: ${prog.baseline_goal_split.retain_regulars || prog.baseline_goal_split.retain_loyalty || 0}%`)
    }
    console.log(`\nDecision Timing: ${prog.decision_timing_mode || 'not set'}`)
    
    if (prog.audience_segments) {
      console.log(`\nAudience Segments: ${prog.audience_segments.length}`)
      prog.audience_segments.forEach((seg, idx) => {
        console.log(`  ${idx + 1}. [${seg.segment_type}] ${seg.segment_name}`)
        console.log(`     Goal: ${seg.goal} | Decision: ${seg.decision_type}`)
        if (seg.content_angles && seg.content_angles.length > 0) {
          console.log(`     Content angles: ${seg.content_angles.slice(0, 2).join(', ')}${seg.content_angles.length > 2 ? '...' : ''}`)
        }
      })
    }
    
    if (prog.commercial_reasoning) {
      console.log(`\n💡 AI Reasoning: ${prog.commercial_reasoning.substring(0, 150)}...`)
    }
    
    console.log('')
  }
  
  return data
}

// ============================================================================
// 2. LOCATION INTELLIGENCE AUDIT  
// ============================================================================

async function auditLocationIntelligence() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📍 LOCATION INTELLIGENCE AUDIT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  // Check if table has any data
  const { data: sampleData, error: sampleError } = await supabase
    .from('business_location_intelligence')
    .select('business_id')
    .limit(5)
  
  if (sampleError) {
    console.error('❌ Table access error:', sampleError.message)
    return null
  }
  
  console.log(`📊 Sample data check: ${sampleData?.length || 0} rows in table`)
  if (sampleData && sampleData.length > 0) {
    const uniqueBusinessIds = [...new Set(sampleData.map(d => d.business_id))]
    console.log(`   Found business_ids: ${uniqueBusinessIds.map(id => id.substring(0, 8)).join(', ')}...\n`)
  }
  
  const { data, error } = await supabase
    .from('business_location_intelligence')
    .select('*')
    .eq('business_id', CAFE_FAUST_ID)
    .maybeSingle()
  
  if (error) {
    console.error('❌ Error:', error.message)
    return null
  }
  
  if (!data) {
    console.log('❌ No location intelligence found\n')
    return null
  }
  
  console.log('✅ Location Data Found\n')
  console.log(`Area Type: ${data.area_type}`)
  console.log(`\nLocation Scores:`)
  console.log(`  • Waterfront: ${data.waterfront_score || 'N/A'}/100`)
  console.log(`  • City Center: ${data.city_center_score || 'N/A'}/100`)
  console.log(`  • Historic: ${data.historic_score || 'N/A'}/100`)
  console.log(`  • Residential: ${data.residential_score || 'N/A'}/100`)
  console.log(`  • Suburban: ${data.suburban_score || 'N/A'}/100`)
  
  if (data.location_marketing_hooks && data.location_marketing_hooks.length > 0) {
    console.log(`\nMarketing Hooks:`)
    data.location_marketing_hooks.forEach(hook => console.log(`  • ${hook}`))
  }
  
  console.log(`\nCompetition: ${data.competition_count || 'unknown'} venues`)
  
  if (data.category_scores) {
    console.log(`\nCategory Scores:`)
    Object.entries(data.category_scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([cat, score]) => {
        console.log(`  • ${cat}: ${score}`)
      })
  }
  
  console.log('')
  return data
}

// ============================================================================
// 3. BRAND PROFILE AUDIT
// ============================================================================

async function auditBrandProfile() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎨 BRAND PROFILE AUDIT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  // Check if table has any data
  const { data: sampleData, error: sampleError } = await supabase
    .from('business_brand_profile')
    .select('business_id')
    .limit(5)
  
  if (sampleError) {
    console.error('❌ Table access error:', sampleError.message)
    return null
  }
  
  console.log(`📊 Sample data check: ${sampleData?.length || 0} rows in table`)
  if (sampleData && sampleData.length > 0) {
    const uniqueBusinessIds = [...new Set(sampleData.map(d => d.business_id))]
    console.log(`   Found business_ids: ${uniqueBusinessIds.map(id => id.substring(0, 8)).join(', ')}...\n`)
  }
  
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('*, brand_profile_v5')
    .eq('business_id', CAFE_FAUST_ID)
    .maybeSingle()
  
  if (error) {
    console.error('❌ Error:', error.message)
    return null
  }
  
  if (!data) {
    console.log('❌ No brand profile found\n')
    return null
  }
  
  console.log('✅ Brand Profile Found\n')
  
  const v5 = data.brand_profile_v5
  
  if (!v5) {
    console.log('⚠️  No V5 data structure found')
    return data
  }
  
  if (v5.voice?.personality) {
    console.log(`Personality: ${v5.voice.personality.join(', ')}`)
  }
  console.log(`Tone: ${v5.voice?.formality || 'not set'}`)
  console.log(`Humor: ${v5.voice?.humor || 'not set'}`)
  console.log(`Emoji: ${v5.voice?.emoji_frequency || 'not set'}`)
  
  if (v5.themes?.signature_themes && v5.themes.signature_themes.length > 0) {
    console.log(`\nSignature Themes:`)
    v5.themes.signature_themes.forEach(theme => console.log(`  • ${theme}`))
  }
  
  if (v5.voice?.voice_rules && v5.voice.voice_rules.length > 0) {
    console.log(`\nVoice Rules: ${v5.voice.voice_rules.length} rules defined`)
    console.log(`  Example: ${v5.voice.voice_rules[0]}`)
  }
  
  if (v5.themes?.gastronomic_profile) {
    console.log(`\nGastronomic Profile:`)
    console.log(`  ${v5.themes.gastronomic_profile.substring(0, 200)}...`)
  }
  
  if (v5.programmes && v5.programmes.length > 0) {
    console.log(`\nProgrammes in V5: ${v5.programmes.length}`)
  }
  
  console.log('')
  return data
}

// ============================================================================
// 4. MENU ITEMS ANALYSIS
// ============================================================================

async function auditMenuItems() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🍽️  MENU ITEMS AUDIT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  // Get count by service period
  const { data: periodCounts, error: periodError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          service_period_name,
          COUNT(*) as count,
          COUNT(DISTINCT category_name) as categories
        FROM menu_items_normalized
        WHERE business_id = '${CAFE_FAUST_ID}'
        GROUP BY service_period_name
        ORDER BY service_period_name
      `
    })
  
  if (!periodError && periodCounts) {
    console.log('Menu Items by Service Period:')
    periodCounts.forEach(p => {
      console.log(`  • ${p.service_period_name}: ${p.count} items, ${p.categories} categories`)
    })
  }
  
  // Get signature dishes
  const { data: signatures, error: sigError } = await supabase
    .from('menu_items_normalized')
    .select('item_name, service_period_name, item_description')
    .eq('business_id', CAFE_FAUST_ID)
    .eq('is_signature', true)
    .limit(10)
  
  if (!sigError && signatures && signatures.length > 0) {
    console.log(`\nSignature Dishes (${signatures.length}):`)
    signatures.forEach(dish => {
      console.log(`  • [${dish.service_period_name}] ${dish.item_name}`)
    })
  }
  
  console.log('')
}

// ============================================================================
// 5. DATA GAPS ANALYSIS
// ============================================================================

function analyzeDataGaps(programmes, location, brand) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  DATA GAPS & ISSUES')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  const gaps = []
  
  // Check programmes
  if (programmes) {
    programmes.forEach(prog => {
      if (!prog.commercial_reasoning) {
        gaps.push(`${prog.programme_name}: Missing commercial reasoning`)
      }
      if (!prog.audience_segments || prog.audience_segments.length === 0) {
        gaps.push(`${prog.programme_name}: No audience segments`)
      }
      if (!prog.baseline_goal_split) {
        gaps.push(`${prog.programme_name}: No commercial goals defined`)
      }
    })
  }
  
  // Check location
  if (location) {
    if (!location.waterfront_score) gaps.push('Location: Missing waterfront score')
    if (!location.city_center_score) gaps.push('Location: Missing city center score')
    if (!location.location_marketing_hooks || location.location_marketing_hooks.length === 0) {
      gaps.push('Location: No marketing hooks defined')
    }
  } else {
    gaps.push('Location: No location intelligence data')
  }
  
  // Check brand
  if (brand && brand.brand_profile_v5) {
    const v5 = brand.brand_profile_v5
    if (!v5.voice?.voice_rules || v5.voice.voice_rules.length === 0) {
      gaps.push('Brand: No voice rules defined')
    }
    if (!v5.themes?.signature_themes || v5.themes.signature_themes.length === 0) {
      gaps.push('Brand: No signature themes')
    }
    if (!v5.programmes || v5.programmes.length === 0) {
      gaps.push('Brand: No programmes in V5 structure')
    }
  } else {
    gaps.push('Brand: No brand profile data')
  }
  
  if (gaps.length === 0) {
    console.log('✅ No critical data gaps found!\n')
  } else {
    console.log(`Found ${gaps.length} issues:\n`)
    gaps.forEach(gap => console.log(`  ⚠️  ${gap}`))
    console.log('')
  }
  
  return gaps
}

// ============================================================================
// 6. GENERATE PROMPT CONTEXT
// ============================================================================

function generatePromptContext(programmes, location, brand) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📝 PROMPT CONTEXT FOR PHASE 2B')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  const context = {
    locationPositioning: {},
    servicePeriodStrategies: {},
    brandThemes: []
  }
  
  // Location context
  if (location) {
    const scores = {
      waterfront: location.waterfront_score || 0,
      city_center: location.city_center_score || 0,
      historic: location.historic_score || 0
    }
    
    const primary = Object.entries(scores).sort(([,a], [,b]) => b - a)[0]
    
    context.locationPositioning = {
      primary: primary[0],
      primaryScore: primary[1],
      scores: scores,
      marketingHooks: location.location_marketing_hooks || [],
      competition: `${location.competition_count || 'unknown'} venues nearby`
    }
  }
  
  // Service period strategies
  if (programmes) {
    programmes.forEach(prog => {
      const segments = prog.audience_segments || []
      const primarySegments = segments
        .filter(s => s.segment_type === 'primær')
        .map(s => s.segment_name)
      
      const allAngles = segments
        .flatMap(s => s.content_angles || [])
        .filter((v, i, a) => a.indexOf(v) === i) // unique
      
      context.servicePeriodStrategies[prog.programme_name] = {
        hours: `${prog.start_time}-${prog.end_time}`,
        commercialGoals: prog.baseline_goal_split || {},
        decisionTiming: prog.decision_timing_mode,
        primaryAudiences: primarySegments,
        contentAngles: allAngles,
        aiReasoning: prog.commercial_reasoning
      }
    })
  }
  
  // Brand themes
  if (brand && brand.brand_profile_v5?.themes?.signature_themes) {
    context.brandThemes = brand.brand_profile_v5.themes.signature_themes
  }
  
  // Add programmes from V5 if available
  if (brand && brand.brand_profile_v5?.programmes) {
    const v5Programmes = brand.brand_profile_v5.programmes
    v5Programmes.forEach(prog => {
      // Merge V5 programme data if not already from business_programme_profiles
      if (!context.servicePeriodStrategies[prog.programme_name]) {
        const segments = prog.audience_segments || []
        const primarySegments = segments
          .filter(s => s.segment_type === 'primær')
          .map(s => s.segment_name)
        
        const allAngles = segments
          .flatMap(s => s.content_angles || [])
          .filter((v, i, a) => a.indexOf(v) === i)
        
        context.servicePeriodStrategies[prog.programme_name] = {
          hours: `${prog.start_time || 'N/A'}-${prog.end_time || 'N/A'}`,
          commercialGoals: prog.baseline_goal_split || {},
          decisionTiming: prog.decision_timing_mode || 'unknown',
          primaryAudiences: primarySegments,
          contentAngles: allAngles,
          aiReasoning: prog.commercial_reasoning || null
        }
      }
    })
  }
  
  console.log(JSON.stringify(context, null, 2))
  console.log('')
  
  return context
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║     PHASE 1: DATA AUDIT & MAPPING FOR CAFE FAUST      ║')
  console.log('╚════════════════════════════════════════════════════════╝')
  console.log('\n')
  
  try {
    const programmes = await auditProgrammeProfiles()
    const location = await auditLocationIntelligence()
    const brand = await auditBrandProfile()
    await auditMenuItems()
    
    const gaps = analyzeDataGaps(programmes, location, brand)
    
    const promptContext = generatePromptContext(programmes, location, brand)
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ AUDIT COMPLETE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    console.log(`📊 Summary:`)
    console.log(`   • Service Periods: ${programmes?.length || 0}`)
    console.log(`   • Location Data: ${location ? '✅' : '❌'}`)
    console.log(`   • Brand Profile: ${brand ? '✅' : '❌'}`)
    console.log(`   • Data Gaps: ${gaps.length}`)
    console.log('')
    
    if (gaps.length > 0) {
      console.log('⚠️  Action Required: Fix data gaps before proceeding to Phase 2')
    } else {
      console.log('✅ Ready for Phase 2: Update Strategy Generator Prompt')
    }
    
    console.log('')
    
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
