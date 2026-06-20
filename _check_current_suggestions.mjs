import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'
const today = '2026-05-27'

console.log(`📋 Checking suggestions for ${businessId} on ${today}\n`)

const { data, error } = await supabase
  .from('daily_suggestions')
  .select('*')
  .eq('business_id', businessId)
  .eq('date', today)
  .eq('is_active', true)
  .order('position')

if (error) {
  console.error('❌ Error:', error)
  Deno.exit(1)
}

console.log(`Found ${data.length} active suggestions:\n`)

data.forEach((s, idx) => {
  console.log(`═══ SUGGESTION ${idx + 1} ═══`)
  console.log(`ID: ${s.id}`)
  console.log(`Position: ${s.position}`)
  console.log(`Title: ${s.title}`)
  console.log(`Content Type: ${s.content_type}`)
  console.log(`Menu Item: ${s.menu_item_name || '(none)'}`)
  console.log(`Batch ID: ${s.generation_batch_id}`)
  console.log(`Created: ${s.created_at}`)
  console.log()
})
