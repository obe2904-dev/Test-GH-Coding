import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

const { data: business } = await supabase
  .from('businesses')
  .select('name, outdoor_seating')
  .eq('id', businessId)
  .single()

console.log(`Business: ${business.name}`)
console.log(`Has outdoor seating: ${business.outdoor_seating ? 'YES' : 'NO'}`)
