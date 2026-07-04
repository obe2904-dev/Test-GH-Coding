/**
 * Fix Placeholder Never-Say Rules Migration
 * 
 * Cleans up placeholder-formatted never_say entries in brand_profile_v5 that contain
 * meta-instructions like "(vær specifik: sprød, cremet, etc.)" which leak into
 * generated text instead of being followed as instructions.
 * 
 * Problem:
 * - Brand profile generator used placeholder examples: "lækker → (vær specifik: sprød, cremet, etc.)"
 * - These got stored literally in the database
 * - Text generator treats them as literal replacements, outputting "(vær specifik...)" in posts
 * 
 * Solution:
 * - Parse all never_say entries with → format
 * - Replace placeholder instructions with actionable guidance
 * - "(vær specifik...)" → "(erstat med konkret beskrivelse)"
 * - "(fjern ordet)" → "(slet)"
 * - "(vær konkret)" → "(vær konkret om hvad)"
 * 
 * @usage: deno run --allow-net --allow-env scripts/fix-placeholder-never-say.ts
 * @version 1.0
 * @date June 10, 2026
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.com'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variable: SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * Parse and clean a never_say entry
 */
function cleanNeverSayEntry(entry: string): { cleaned: string; changed: boolean } {
  // Format: "word → replacement" or "word → (instruction)"
  const parts = entry.split('→').map(p => p.trim())
  
  if (parts.length < 2) {
    return { cleaned: entry, changed: false } // No arrow, keep as-is
  }
  
  const forbidden = parts[0]
  const replacement = parts[1]
  
  // Pattern 1: "(vær specifik: ...)" or "(be specific: ...)"
  if (replacement.includes('(vær specifik') || replacement.includes('(be specific')) {
    return {
      cleaned: `${forbidden} (erstat med konkret beskrivelse)`,
      changed: true
    }
  }
  
  // Pattern 2: "(fjern ordet)" or "(remove word)" or just "(fjern)"
  if (replacement.includes('(fjern ordet)') || 
      replacement.includes('(remove word)') || 
      replacement === '(fjern)') {
    return {
      cleaned: `${forbidden} (slet)`,
      changed: true
    }
  }
  
  // Pattern 3: "(vær konkret)" or "(be concrete)"
  if (replacement.includes('(vær konkret)') || replacement.includes('(be concrete)')) {
    return {
      cleaned: `${forbidden} (vær konkret om hvad)`,
      changed: true
    }
  }
  
  // No placeholder pattern found - keep original
  return { cleaned: entry, changed: false }
}

/**
 * Main migration function
 */
async function fixPlaceholderRules() {
  console.log('🔄 Starting Never-Say Placeholder Fix Migration...\n')
  
  // 1. Get all businesses with brand_profile_v5
  const { data: profiles, error } = await supabase
    .from('business_brand_profile')
    .select('business_id, business_name, brand_profile_v5')
    .not('brand_profile_v5', 'is', null)
  
  if (error) {
    console.error('❌ Failed to fetch profiles:', error)
    return
  }
  
  if (!profiles || profiles.length === 0) {
    console.log('✅ No profiles found to migrate')
    return
  }
  
  console.log(`📊 Found ${profiles.length} profiles to check\n`)
  
  let checked = 0
  let fixed = 0
  const fixedBusinesses: string[] = []
  
  for (const profile of profiles) {
    checked++
    const v5 = profile.brand_profile_v5
    const neverSay = v5?.guardrails?.never_say || []
    
    if (!Array.isArray(neverSay) || neverSay.length === 0) {
      continue
    }
    
    // Clean each entry and track changes
    let hasChanges = false
    const cleanedNeverSay = neverSay.map((entry: string) => {
      const { cleaned, changed } = cleanNeverSayEntry(entry)
      if (changed) {
        hasChanges = true
        console.log(`  🔧 [${profile.business_name}] Fixed: "${entry}" → "${cleaned}"`)
      }
      return cleaned
    })
    
    if (hasChanges) {
      // Update the profile
      v5.guardrails.never_say = cleanedNeverSay
      
      const { error: updateError } = await supabase
        .from('business_brand_profile')
        .update({ brand_profile_v5: v5 })
        .eq('business_id', profile.business_id)
      
      if (updateError) {
        console.error(`  ❌ Failed to update ${profile.business_name}:`, updateError)
      } else {
        fixed++
        fixedBusinesses.push(profile.business_name)
        console.log(`  ✅ Updated ${profile.business_name}\n`)
      }
    }
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('MIGRATION SUMMARY')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`Profiles checked: ${checked}`)
  console.log(`Profiles fixed: ${fixed}`)
  
  if (fixedBusinesses.length > 0) {
    console.log('\nFixed businesses:')
    fixedBusinesses.forEach(name => console.log(`  - ${name}`))
  }
  
  console.log('\n✅ Migration complete!')
}

// Run migration
if (import.meta.main) {
  await fixPlaceholderRules()
}
