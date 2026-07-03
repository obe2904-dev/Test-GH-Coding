import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('🧪 Testing CTA selection for Café Faust (impulse_friendly)\n')

// Create a test suggestion for a menu post (should trigger "visit" intent)
const testSuggestion = {
  business_id: CAFE_FAUST_ID,
  title: "Brunch med pandekager",
  content_type: "menu_item",
  menu_item_name: "Pandekager",
  menu_item_description: "Luftige pandekager med bær og ahornsirup",
  cta_intent: "visit",  // This should trigger booking pattern logic
  why_explanation: "Det er weekendbrunch - gæsterne søger afslappet morgenmad",
  source: "ai_ideas",
  id: 999999
}

console.log('📝 Test suggestion:')
console.log('  Content:', testSuggestion.title)
console.log('  Type:', testSuggestion.content_type)
console.log('  CTA intent:', testSuggestion.cta_intent)
console.log()

console.log('⏳ Calling generate-text-from-idea...\n')

const { data, error } = await supabase.functions.invoke('generate-text-from-idea', {
  body: {
    business_id: CAFE_FAUST_ID,
    suggestion: testSuggestion
  }
})

if (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}

if (!data || !data.success) {
  console.error('❌ Function failed')
  console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500))
  Deno.exit(1)
}

console.log('✅ Caption generated successfully!\n')
console.log('📊 Results:\n')

// Show the generated caption
if (data.caption) {
  console.log('Generated caption:')
  console.log('─'.repeat(60))
  console.log(data.caption)
  console.log('─'.repeat(60))
  console.log()
}

// Analyze CTA
console.log('🎯 CTA Analysis:')
if (data.selectedCta) {
  console.log('  Selected CTA:', data.selectedCta)
  
  // Check if it's a booking CTA (should NOT be for impulse_friendly)
  const bookingKeywords = ['book', 'reserv', 'bestil', 'bord']
  const hasBookingLanguage = bookingKeywords.some(kw => 
    data.selectedCta.toLowerCase().includes(kw)
  )
  
  if (hasBookingLanguage) {
    console.log('  ❌ FAIL: Contains booking language (should be casual for impulse_friendly)')
  } else {
    console.log('  ✅ PASS: No booking language (correct for impulse_friendly)')
  }
  
  // Check if it's casual
  const casualKeywords = ['kom forbi', 'svip forbi', 'vi ses', 'besøg']
  const hasCasualLanguage = casualKeywords.some(kw => 
    data.selectedCta.toLowerCase().includes(kw)
  )
  
  if (hasCasualLanguage) {
    console.log('  ✅ PASS: Uses casual invitation language')
  }
} else {
  console.log('  ℹ️ No explicit CTA returned (may be integrated into caption)')
}

console.log('\n✅ Test complete!')
