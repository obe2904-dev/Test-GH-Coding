import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey)

// Test with Cafe Faust
const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'
const today = new Date().toISOString().split('T')[0]

console.log('🧪 Testing single suggestion mode for Cafe Faust...\n')
console.log(`Date: ${today}`)
console.log(`Business: ${businessId}\n`)

// Query the database to see today's suggestions
const { data: suggestions, error } = await supabase
  .from('daily_suggestions')
  .select('*')
  .eq('business_id', businessId)
  .eq('date', today)
  .eq('is_active', true)
  .order('position', { ascending: true })

if (error) {
  console.error('❌ Error:', error)
  Deno.exit(1)
}

console.log(`✅ Found ${suggestions?.length || 0} active suggestions for today\n`)

if (suggestions && suggestions.length > 0) {
  suggestions.forEach((s, idx) => {
    console.log(`═══ SUGGESTION ${idx + 1} ═══`)
    console.log(`Title: ${s.title}`)
    console.log(`Content Type: ${s.content_type}`)
    console.log(`Position: ${s.position}`)
    console.log(`Slot: ${s.cta_intent}`)
    if (s.menu_item_name) {
      console.log(`Menu Item: ${s.menu_item_name}`)
    }
    console.log(`Why: ${s.why_explanation || s.rationale || '(none)'}`)
    console.log(`Photo Idea: ${(s.photo_idea || '').slice(0, 120)}...`)
    console.log(`Batch ID: ${s.generation_batch_id}`)
    console.log()
  })
}

console.log('✅ Test complete!')
