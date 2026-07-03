// Test if source_id column exists by trying to insert
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env', 'utf-8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) env[key.trim()] = value.trim()
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function testSourceIdColumn() {
  console.log('\n🔍 Testing if source_id column exists...\n')
  
  // Try a simple query that uses source_id
  const { data, error } = await supabase
    .from('menu_results_v2')
    .select('id, source_id')
    .limit(1)

  if (error) {
    console.error('❌ Error querying source_id:', error)
    console.log('\n⚠️  The source_id column likely doesn\'t exist in production!')
    console.log('💡 Need to apply migration: 20250121_add_source_id_to_menu_results_v2.sql')
  } else {
    console.log('✅ source_id column exists')
    console.log(`   Query returned ${data.length} rows`)
  }
}

testSourceIdColumn()
