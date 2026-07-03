import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')

const supabase = createClient(supabaseUrl, supabaseKey)

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5, business_id')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

if (!data || data.length === 0) {
  console.error('No data found for business_id: f4679fa9-3120-4a59-9506-d059b010c34a')
  process.exit(1)
}

const businessData = data[0]

const voice = businessData.brand_profile_v5?.voice
const examples = voice?.menu_description_examples || []
const toneRules = voice?.tone_rules || []
const personalityTraits = voice?.personality_traits || []

console.log('\n═══════════════════════════════════════════════════════')
console.log('CAFÉ FAUST - MENU EXAMPLES (NEW PRINCIPLE-BASED PROMPT)')
console.log('═══════════════════════════════════════════════════════\n')

console.log('VOICE PROFILE:')
console.log('─────────────────────────────────────────────────────────')
console.log(`Personality: ${personalityTraits.join(', ')}`)
console.log(`Formality: ${voice?.formality_level || 'N/A'}`)
console.log(`Humor: ${voice?.humor_style || 'N/A'}`)
console.log('\nTONE RULES:')
toneRules.forEach((rule, i) => {
  console.log(`  ${i + 1}. ${rule}`)
})

console.log('\n\nMENU DESCRIPTION EXAMPLES:')
console.log('─────────────────────────────────────────────────────────')
examples.forEach((example, i) => {
  const isVariationB = i % 2 === 1
  const wordCount = example.split(' ').length
  const hasDash = example.includes(' - ')
  const startsWithServed = example.toLowerCase().includes('serveret med')
  
  console.log(`\n${isVariationB ? 'B' : 'A'}${Math.floor(i/2) + 1}. ${example}`)
  console.log(`    (${wordCount} ord${hasDash ? ' ⚠️ DASH' : ''}${startsWithServed ? ' ⚠️ SERVERET' : ''})`)
})

console.log('\n\n═══════════════════════════════════════════════════════')
console.log('QUALITY ASSESSMENT:')
console.log('═══════════════════════════════════════════════════════\n')

// Check for personality demonstration
const examplesText = examples.join(' ').toLowerCase()
const showsPride = examples.some(e => 
  e.includes('saftig') || e.includes('sprød') || e.includes('cremet') || 
  e.includes('fra grillen') || e.includes('fra ovnen') || e.includes('langsom')
)
const showsModern = examples.some(e => 
  e.includes('cremet') || !e.includes('serveret')
)
const showsLocal = examples.some(e => 
  e.toLowerCase().includes('lokal') || e.toLowerCase().includes('dansk')
)

console.log(`✓ Shows pride in craft (texture/technique): ${showsPride ? '✅ YES' : '❌ NO'}`)
console.log(`✓ Shows "moderne" personality: ${showsModern ? '✅ YES' : '❌ NO'}`)
console.log(`✓ Shows "lokal" personality: ${showsLocal ? '✅ YES' : '⚠️  MAYBE'}`)
console.log(`✓ Count: ${examples.length === 6 ? '✅ 6' : `❌ ${examples.length}`}`)
console.log(`✓ No dash separators: ${examples.every(e => !e.includes(' - ')) ? '✅ YES' : '❌ NO'}`)
console.log('\n')
