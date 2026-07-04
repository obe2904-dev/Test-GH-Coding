import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 Querying table schema from information_schema...\n')

// Query information_schema to get columns
const { data, error } = await supabase.rpc('exec_sql', {
  query: `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'business_audience_profile'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `
})

if (error) {
  console.error('❌ Error querying schema:', error)
  console.log('\nℹ️ Trying alternative method with simple insert...')
  
  // Try inserting with just business_id to see what's required
  const { data: insertData, error: insertError } = await supabase
    .from('business_audience_profile')
    .insert({
      business_id: 'test-schema-check'
    })
    .select()
  
  if (insertError) {
    console.log('Error details:', insertError)
  }
} else {
  console.log('📊 Table columns:')
  console.log(data)
}
