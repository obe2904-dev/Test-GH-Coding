import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('🔍 Checking recent strategies for Café Faust...\n')

const { data: strategies } = await supabase
  .from('weekly_strategies')
  .select('id, status, week_start, created_at, error_message, post_ideas, narrative')
  .eq('business_id', CAFE_FAUST_ID)
  .order('created_at', { ascending: false })
  .limit(5)

if (!strategies || strategies.length === 0) {
  console.log('❌ No strategies found')
  Deno.exit(1)
}

console.log(`Found ${strategies.length} recent strategies:\n`)

for (const strategy of strategies) {
  console.log(`📅 Week ${strategy.week_start}`)
  console.log(`   ID: ${strategy.id}`)
  console.log(`   Status: ${strategy.status}`)
  console.log(`   Created: ${strategy.created_at}`)
  
  if (strategy.error_message) {
    console.log(`   Error: ${strategy.error_message}`)
  }
  
  if (strategy.status === 'completed' && strategy.narrative) {
    const narrative = strategy.narrative
    
    // Check for booking terms (should be ZERO for impulse_friendly)
    const bookingTerms = ['book', 'reserv', 'bestil', 'sikr dig et bord']
    const casualTerms = ['kom forbi', 'svip forbi', 'vi ses']
    
    const foundBooking = bookingTerms.filter(term => narrative.toLowerCase().includes(term))
    const foundCasual = casualTerms.filter(term => narrative.toLowerCase().includes(term))
    
    console.log(`   Narrative: ${narrative.length} chars`)
    console.log(`   Posts: ${strategy.post_ideas?.length || 0}`)
    console.log(`   Booking terms: ${foundBooking.length > 0 ? '❌ ' + foundBooking.join(', ') : '✅ None'}`)
    console.log(`   Casual terms: ${foundCasual.length > 0 ? '✅ ' + foundCasual.join(', ') : '⚠️ None'}`)
    
    if (foundBooking.length > 0) {
      console.log('\n   ⚠️ ISSUE: Impulse-friendly business has booking language!')
      console.log('   Sample:', narrative.substring(0, 300))
    }
  }
  
  console.log()
}

