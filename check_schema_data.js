// Check menu_sources and menu_results_v2 schema
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env', 'utf-8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) env[key.trim()] = value.trim()
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function checkSchema() {
  console.log('\n🔍 Checking menu_sources...')
  const { data: sources, error: sourcesError } = await supabase
    .from('menu_sources')
    .select('*')
    .eq('source_url', 'https://cafefaust.dk/menukort/')
    .limit(1)

  if (sourcesError) {
    console.error('❌ Error fetching menu_sources:', sourcesError)
  } else if (sources && sources.length > 0) {
    console.log('✅ Found menu_source:')
    console.log(`   ID: ${sources[0].id}`)
    console.log(`   URL: ${sources[0].source_url}`)
    console.log(`   Business ID: ${sources[0].business_id}`)
  } else {
    console.log('❌ No menu_source found for Menukort')
  }

  console.log('\n🔍 Checking menu_results_v2...')
  const { data: results, error: resultsError } = await supabase
    .from('menu_results_v2')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (resultsError) {
    console.error('❌ Error fetching menu_results_v2:', resultsError)
  } else {
    console.log(`Found ${results.length} total results in menu_results_v2`)
    if (results.length > 0) {
      console.log('\nMost recent:')
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.source_url} (${r.status})`)
        console.log(`     Created: ${new Date(r.created_at).toLocaleString()}`)
        console.log(`     Source ID: ${r.source_id || 'NULL'}`)
      })
    }
  }
}

checkSchema()
