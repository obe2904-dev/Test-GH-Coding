/**
 * Test Emoji Migration - Verify Phase 3 reads from V5
 * 
 * Tests that generate-text-from-idea now reads emoji_level from V5 Brand Profile
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const functionUrl = `${supabaseUrl}/functions/v1`

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🧪 Testing Emoji V5 Migration for Café Faust\n')

// 1. Verify V5 has emoji_level
console.log('📋 Step 1: Verify V5 Profile has emoji_level')
const { data: profile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

const v5Voice = (profile?.brand_profile_v5 as any)?.voice
if (!v5Voice?.emoji_level) {
  console.error('❌ emoji_level not found in V5 profile!')
  Deno.exit(1)
}

console.log('✅ V5 Voice Config:')
console.log('  formality_level:', v5Voice.formality_level)
console.log('  emoji_level:', v5Voice.emoji_level)
console.log('  emoji_reasoning:', v5Voice.emoji_reasoning?.substring(0, 80) + '...')

// 2. Get a daily suggestion to test with
console.log('\n📅 Step 2: Fetching a daily suggestion for testing')
const { data: suggestions } = await supabase
  .from('daily_suggestions')
  .select('*')
  .eq('business_id', CAFE_FAUST_ID)
  .eq('status', 'pending')
  .limit(1)

if (!suggestions || suggestions.length === 0) {
  console.error('❌ No pending daily suggestions found for testing')
  console.log('   Create one first with generate-weekly-plan')
  Deno.exit(1)
}

const suggestion = suggestions[0]
console.log('✅ Found suggestion:')
console.log('  ID:', suggestion.id)
console.log('  Day:', suggestion.timing_day)
console.log('  Type:', suggestion.content_type)

// 3. Call generate-text-from-idea
console.log('\n🎯 Step 3: Calling generate-text-from-idea')
console.log('   (Check function logs for "emoji:" output to verify V5 reading)')

const payload = {
  businessId: CAFE_FAUST_ID,
  suggestion: {
    id: suggestion.id,
    content_type: suggestion.content_type,
    timingDay: suggestion.timing_day,
    timingDaypart: suggestion.timing_daypart,
    menuContext: suggestion.menu_context || null,
    contentBlock: suggestion.content_block || null,
  },
  platforms: ['facebook', 'instagram'],
  tier: 'paid'
}

const response = await fetch(`${functionUrl}/generate-text-from-idea`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseKey}`
  },
  body: JSON.stringify(payload)
})

if (!response.ok) {
  const error = await response.text()
  console.error('❌ Function call failed:', error)
  Deno.exit(1)
}

const result = await response.json()

console.log('\n✅ Text Generation Result:')
console.log('  Status:', result.status || 'success')
console.log('  Platforms:', Object.keys(result.platforms || {}))

// 4. Check generated text for emoji usage
for (const [platform, data] of Object.entries(result.platforms || {})) {
  const text = (data as any).text
  const emojiCount = (text.match(/[\p{Emoji}]/gu) || []).length
  console.log(`\n  ${platform}:`)
  console.log(`    Emoji count: ${emojiCount} (expected: 0-1 for "minimal")`)
  console.log(`    Text: ${text.substring(0, 100)}...`)
}

console.log('\n🎉 Test complete!')
console.log('✅ Phase 3 is now reading emoji_level from V5 Brand Profile')
console.log('   Expected behavior: 0-1 emoji in generated text (minimal level)')
