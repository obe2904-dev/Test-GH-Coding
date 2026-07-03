import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'
const today = '2026-05-27'

const { data, error } = await supabase
  .from('daily_suggestions')
  .select('id, position, title, content_type, menu_item_name, is_active, generation_batch_id, created_at')
  .eq('business_id', businessId)
  .eq('date', today)
  .order('created_at', { ascending: false })

if (error) {
  console.error('❌ Error:', error)
  Deno.exit(1)
}

console.log(`📋 All suggestions for ${today} (${data.length} total):\n`)

data.forEach((s, idx) => {
  console.log(`${s.is_active ? '✅' : '❌'} Pos ${s.position} | ${s.title}`)
  console.log(`   Type: ${s.content_type} | Menu: ${s.menu_item_name || 'n/a'}`)
  console.log(`   Batch: ${s.generation_batch_id}`)
  console.log(`   Created: ${s.created_at}`)
  console.log()
})
