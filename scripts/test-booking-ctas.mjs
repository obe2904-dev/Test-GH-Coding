import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('🧪 Testing Café Faust booking pattern CTAs...\n')

// Calculate next Monday
const now = new Date()
const dayOfWeek = now.getDay()
const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
const nextMonday = new Date(now)
nextMonday.setDate(now.getDate() + daysUntilMonday)
nextMonday.setHours(0, 0, 0, 0)

const weekStart = nextMonday.toISOString().split('T')[0]

console.log('📅 Week start:', weekStart)
console.log('🏢 Business: Café Faust')
console.log('🎯 Expected pattern: impulse_friendly')
console.log('📝 Expected CTAs: Casual "kom forbi" language, NO booking terms\n')

console.log('⏳ Calling get-weekly-strategy...\n')

// Call the edge function
const { data, error } = await supabase.functions.invoke('get-weekly-strategy', {
  body: {
    business_id: CAFE_FAUST_ID,
    week_start: weekStart,
  }
})

if (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}

if (!data || !data.strategy) {
  // Strategy is processing asynchronously - poll for result
  if (data.status === 'pending' && data.strategy_id) {
    console.log('⏳ Strategy is processing asynchronously...')
    console.log('   Strategy ID:', data.strategy_id)
    
    // Poll for completion
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max
    let strategyData = null
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      attempts++
      
      console.log(`   Checking status (attempt ${attempts}/${maxAttempts})...`)
      
      const { data: pollData } = await supabase
        .from('weekly_strategies')
        .select('*')
        .eq('id', data.strategy_id)
        .single()
      
      if (pollData && pollData.status === 'completed') {
        strategyData = pollData
        break
      } else if (pollData && pollData.status === 'failed') {
        console.error('❌ Strategy generation failed:', pollData.error_message)
        Deno.exit(1)
      }
    }
    
    if (!strategyData) {
      console.error('❌ Strategy did not complete within 60 seconds')
      Deno.exit(1)
    }
    
    data = { strategy: strategyData }
    console.log('✅ Strategy completed!\n')
  } else {
    console.error('❌ No strategy data returned')
    console.log('Response:', JSON.stringify(data, null, 2))
    Deno.exit(1)
  }
} else {
  console.log('✅ Strategy generated successfully\n')
}

// Check the narrative for CTA language
const narrative = data.strategy.narrative || ''

console.log('📊 Narrative CTA Analysis:\n')
console.log('Narrative length:', narrative.length, 'characters')

// Check for booking language (should NOT appear for impulse_friendly)
const bookingTerms = [
  'book',
  'reserv',
  'bestil',
  'sikr dig et bord',
  'bordene fylder',
  'ring og book'
]

const casualTerms = [
  'kom forbi',
  'svip forbi',
  'vi ses',
  'besøg os',
  'stop forbi'
]

let foundBookingTerms = []
let foundCasualTerms = []

for (const term of bookingTerms) {
  if (narrative.toLowerCase().includes(term)) {
    foundBookingTerms.push(term)
  }
}

for (const term of casualTerms) {
  if (narrative.toLowerCase().includes(term)) {
    foundCasualTerms.push(term)
  }
}

console.log('\n🔍 Booking terms found (should be ZERO for impulse_friendly):')
if (foundBookingTerms.length === 0) {
  console.log('  ✅ None found - CORRECT!')
} else {
  console.log('  ❌ Found:', foundBookingTerms.join(', '))
}

console.log('\n💬 Casual terms found (should have at least one):')
if (foundCasualTerms.length > 0) {
  console.log('  ✅ Found:', foundCasualTerms.join(', '))
} else {
  console.log('  ⚠️ None found - check narrative')
}

// Show a sample of the narrative
console.log('\n📄 Narrative sample (first 400 chars):')
console.log(narrative.substring(0, 400) + '...')

// Check post_ideas for CTA details
if (data.strategy.post_ideas && Array.isArray(data.strategy.post_ideas)) {
  console.log(`\n📋 Generated ${data.strategy.post_ideas.length} post ideas`)
  
  // Show first 2 posts
  for (let i = 0; i < Math.min(2, data.strategy.post_ideas.length); i++) {
    const post = data.strategy.post_ideas[i]
    console.log(`\n  Post ${i + 1}:`)
    console.log(`    Title: ${post.title?.substring(0, 60)}`)
    console.log(`    Timing: ${post.timing_day} ${post.timing_time_of_day}`)
    if (post.caption_first_line) {
      console.log(`    Opening: ${post.caption_first_line.substring(0, 60)}`)
    }
  }
}

console.log('\n✅ Test complete!')
