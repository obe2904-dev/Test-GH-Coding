// Find which business this is
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env', 'utf-8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) env[key.trim()] = value.trim()
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function findData() {
  // Look for Cafe Faust business
  console.log('\n🔍 Looking for Cafe Faust business...')
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .ilike('name', '%faust%')

  if (bizError) {
    console.error('❌ Error:', bizError)
    return
  }

  console.log(`Found ${businesses.length} businesses matching "faust":`)
  businesses.forEach(b => console.log(`  - ${b.name} (${b.id})`))

  if (businesses.length > 0) {
    const bizId = businesses[0].id
    console.log(`\n🔍 Checking menu_sources for business ${bizId}...`)
    
    const { data: sources } = await supabase
      .from('menu_sources')
      .select('*')
      .eq('business_id', bizId)

    console.log(`Found ${sources.length} menu sources`)
    if (sources.length > 0) {
      sources.forEach(s => {
        console.log(`  - ${s.source_url}`)
      })
    }

    console.log(`\n🔍 Checking menu_results_v2 for business ${bizId}...`)
    const { data: results } = await supabase
      .from('menu_results_v2')
      .select('id, source_url, source_id, status, structured_data')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })

    console.log(`Found ${results.length} menu results`)
    if (results.length > 0) {
      results.slice(0, 3).forEach((r, i) => {
        console.log(`\n  ${i + 1}. ${r.source_url}`)
        console.log(`     ID: ${r.id}`)
        console.log(`     Source ID: ${r.source_id}`)
        console.log(`     Status: ${r.status}`)
        console.log(`     Has menuPeriods: ${r.structured_data?.menuPeriods ? 'YES' : 'NO'}`)
        console.log(`     Has availabilityTime: ${r.structured_data?.availabilityTime ? `YES ("${r.structured_data.availabilityTime}")` : 'NO'}`)
      })
    }
  }
}

findData()
