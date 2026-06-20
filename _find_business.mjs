import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')

const supabase = createClient(supabaseUrl, supabaseKey)

// First, list all businesses to find the right ID
const { data: allBusinesses, error: listError } = await supabase
  .from('business_brand_profile')
  .select('business_id')
  .limit(10)

if (listError) {
  console.error('List Error:', listError)
  Deno.exit(1)
}

console.log('\nAvailable business_ids:')
console.log(allBusinesses)

// Now try to get the businesses table to find Café Faust
const { data: businesses, error: bizError } = await supabase
  .from('businesses')
  .select('id, business_name')
  .ilike('business_name', '%faust%')

if (bizError) {
  console.error('Business search error:', bizError)
} else {
  console.log('\nCafé Faust in businesses table:')
  console.log(businesses)
}
