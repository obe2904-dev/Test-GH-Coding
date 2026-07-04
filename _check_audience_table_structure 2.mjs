import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Café Faust

console.log('🔍 Checking business_audience_profile table...\n')

// Check if table exists and get one row to see structure
const { data, error } = await supabase
  .from('business_audience_profile')
  .select('*')
  .eq('business_id', businessId)
  .limit(1)
  .single()

if (error) {
  console.log('❌ Error or no data:', error)
  
  // Try to get ANY row to see structure
  const { data: anyRow, error: anyError } = await supabase
    .from('business_audience_profile')
    .select('*')
    .limit(1)
    .maybeSingle()
  
  if (anyError) {
    console.error('❌ Cannot access table:', anyError)
  } else if (anyRow) {
    console.log('\n📊 Table structure (from other business):')
    console.log(JSON.stringify(anyRow, null, 2))
  } else {
    console.log('ℹ️ Table exists but is empty')
  }
} else {
  console.log('✅ Found existing data for Café Faust:')
  console.log(JSON.stringify(data, null, 2))
}
