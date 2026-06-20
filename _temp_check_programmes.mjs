import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const { data, error } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, programme_name, baseline_goal_split')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .order('programme_type')

if (error) {
  console.error('Error:', error)
} else {
  console.log('Programmes:')
  data.forEach(p => {
    console.log(`  ${p.programme_type} (${p.programme_name}):`, JSON.stringify(p.baseline_goal_split))
  })
}
