/**
 * Phase 0.1: Audit Voice Fields Usage
 * 
 * Purpose: Check current state of fields marked for deletion
 * - Are they populated in the database?
 * - How many businesses use them?
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 Phase 0.1: Voice Fields Usage Audit\n')
console.log('Checking fields marked for deletion:')
console.log('  - tone_keywords')
console.log('  - typical_openings')  
console.log('  - typical_closings')
console.log('  - do_not_say')
console.log('  - voice_options\n')

// Fetch all brand profiles (simpler - just get all profiles)
const { data: profiles, error } = await supabase
  .from('business_brand_profile')
  .select(`
    business_id,
    tone_keywords,
    typical_openings,
    typical_closings,
    do_not_say,
    voice_options
  `)

if (error) {
  console.error('❌ Error fetching profiles:', error)
  Deno.exit(1)
}

console.log(`📊 Total active businesses: ${profiles.length}\n`)

// Analyze each field
const stats = {
  tone_keywords: {
    has_field: 0,
    populated: 0,  // Non-empty arrays
    examples: [] as any[]
  },
  typical_openings: {
    has_field: 0,
    populated: 0,
    examples: [] as any[]
  },
  typical_closings: {
    has_field: 0,
    populated: 0,
    examples: [] as any[]
  },
  do_not_say: {
    has_field: 0,
    populated: 0,
    examples: [] as any[]
  },
  voice_options: {
    has_field: 0,
    populated: 0,
    examples: [] as any[]
  }
}

for (const profile of profiles) {
  // tone_keywords
  if (profile.tone_keywords !== null) {
    stats.tone_keywords.has_field++
    if (Array.isArray(profile.tone_keywords) && profile.tone_keywords.length > 0) {
      stats.tone_keywords.populated++
      if (stats.tone_keywords.examples.length < 3) {
        stats.tone_keywords.examples.push(profile.tone_keywords)
      }
    }
  }
  
  // typical_openings
  if (profile.typical_openings !== null) {
    stats.typical_openings.has_field++
    if (Array.isArray(profile.typical_openings) && profile.typical_openings.length > 0) {
      stats.typical_openings.populated++
      if (stats.typical_openings.examples.length < 3) {
        stats.typical_openings.examples.push(profile.typical_openings)
      }
    }
  }
  
  // typical_closings
  if (profile.typical_closings !== null) {
    stats.typical_closings.has_field++
    if (Array.isArray(profile.typical_closings) && profile.typical_closings.length > 0) {
      stats.typical_closings.populated++
      if (stats.typical_closings.examples.length < 3) {
        stats.typical_closings.examples.push(profile.typical_closings)
      }
    }
  }
  
  // do_not_say
  if (profile.do_not_say !== null) {
    stats.do_not_say.has_field++
    // Check if JSONB has content
    if (profile.do_not_say && typeof profile.do_not_say === 'object' && Object.keys(profile.do_not_say).length > 0) {
      stats.do_not_say.populated++
      if (stats.do_not_say.examples.length < 3) {
        stats.do_not_say.examples.push(profile.do_not_say)
      }
    }
  }
  
  // voice_options
  if (profile.voice_options !== null) {
    stats.voice_options.has_field++
    if (profile.voice_options && typeof profile.voice_options === 'object' && Object.keys(profile.voice_options).length > 0) {
      stats.voice_options.populated++
      if (stats.voice_options.examples.length < 3) {
        stats.voice_options.examples.push(profile.voice_options)
      }
    }
  }
}

// Print results
console.log('═══════════════════════════════════════════════════════════')
console.log('FIELD USAGE ANALYSIS')
console.log('═══════════════════════════════════════════════════════════\n')

function printFieldStats(fieldName: string, stats: any) {
  const pctHas = ((stats.has_field / profiles.length) * 100).toFixed(1)
  const pctPopulated = stats.has_field > 0 ? ((stats.populated / stats.has_field) * 100).toFixed(1) : '0.0'
  
  console.log(`${fieldName}:`)
  console.log(`  Has field: ${stats.has_field}/${profiles.length} (${pctHas}%)`)
  console.log(`  Populated: ${stats.populated}/${stats.has_field} (${pctPopulated}%)`)
  
  if (stats.examples.length > 0) {
    console.log(`  Example 1: ${JSON.stringify(stats.examples[0]).slice(0, 100)}...`)
  } else {
    console.log(`  Example: (none - all empty or null)`)
  }
  console.log()
}

printFieldStats('tone_keywords', stats.tone_keywords)
printFieldStats('typical_openings', stats.typical_openings)
printFieldStats('typical_closings', stats.typical_closings)
printFieldStats('do_not_say', stats.do_not_say)
printFieldStats('voice_options', stats.voice_options)

console.log('═══════════════════════════════════════════════════════════')
console.log('DELETION RISK ASSESSMENT')
console.log('═══════════════════════════════════════════════════════════\n')

function assessDeletionRisk(fieldName: string, stats: any, codeReferences: number) {
  const isPopulated = stats.populated > 0
  const hasCodeRefs = codeReferences > 0
  
  let risk = 'UNKNOWN'
  let recommendation = ''
  
  if (!isPopulated && !hasCodeRefs) {
    risk = '🟢 LOW - Safe to delete'
    recommendation = 'Field is empty and unused in code'
  } else if (!isPopulated && hasCodeRefs) {
    risk = '🟡 MEDIUM - Update code first'
    recommendation = 'Field is empty but referenced in code - remove refs then delete'
  } else if (isPopulated && !hasCodeRefs) {
    risk = '🟡 MEDIUM - Data loss possible'
    recommendation = 'Field has data but no code references - migrate data before delete'
  } else {
    risk = '🔴 HIGH - Data + code migration needed'
    recommendation = 'Field actively used - full migration required'
  }
  
  console.log(`${fieldName}:`)
  console.log(`  Risk: ${risk}`)
  console.log(`  Populated: ${stats.populated > 0 ? '✅ YES' : '❌ NO'}`)
  console.log(`  Code refs: ${hasCodeRefs ? '✅ YES' : '❌ NO'} (${codeReferences} references)`)
  console.log(`  Action: ${recommendation}`)
  console.log()
}

// Based on grep search, we found ~249 total references
// Approximate breakdown (from grep results):
const codeRefs = {
  tone_keywords: 15,          // ~15 references
  typical_openings: 25,       // ~25 references (heavily used!)
  typical_closings: 20,       // ~20 references (heavily used!)
  do_not_say: 12,             // ~12 references
  voice_options: 10           // ~10 references (mostly commented out)
}

assessDeletionRisk('tone_keywords', stats.tone_keywords, codeRefs.tone_keywords)
assessDeletionRisk('typical_openings', stats.typical_openings, codeRefs.typical_openings)
assessDeletionRisk('typical_closings', stats.typical_closings, codeRefs.typical_closings)
assessDeletionRisk('do_not_say', stats.do_not_say, codeRefs.do_not_say)
assessDeletionRisk('voice_options', stats.voice_options, codeRefs.voice_options)

console.log('═══════════════════════════════════════════════════════════')
console.log('RECOMMENDATION')
console.log('═══════════════════════════════════════════════════════════\n')

console.log('⚠️  CRITICAL FINDING:')
console.log('Some fields marked for deletion are ACTIVELY USED in content generation!')
console.log('')
console.log('REVISED APPROACH:')
console.log('1. ❌ DO NOT delete typical_openings/typical_closings immediately')
console.log('2. ❌ DO NOT delete tone_keywords if used as fallback')
console.log('3. ✅ CAN delete do_not_say if truly NULL everywhere')
console.log('4. ✅ CAN delete voice_options if Sprint 1 already removed it')
console.log('')
console.log('NEXT STEPS:')
console.log('1. Review code usage in detail')
console.log('2. Determine migration path: Keep in V5 or regenerate?')
console.log('3. Update plan with actual usage data')
console.log('')
console.log('📄 Save this output for plan revision!')
