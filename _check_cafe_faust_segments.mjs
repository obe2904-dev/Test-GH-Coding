import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Café Faust

console.log('🔍 Checking Café Faust programme profiles...\n')

// Check business_programme_profiles table
const { data: programmes, error: progError } = await supabase
  .from('business_programme_profiles')
  .select('*')
  .eq('business_id', businessId)

if (progError) {
  console.error('❌ Error fetching programmes:', progError)
  Deno.exit(1)
}

const { data: businessProfile, error: businessError } = await supabase
  .from('business_profile')
  .select('menu_signal')
  .eq('business_id', businessId)
  .single()

if (businessError) {
  console.error('❌ Error fetching business profile:', businessError)
  Deno.exit(1)
}

console.log('📊 Programme Profiles:')
if (programmes && programmes.length > 0) {
  console.log(`✅ Found ${programmes.length} programme(s)`)
  
  programmes.forEach((prog, idx) => {
    console.log(`\n   ${idx + 1}. Programme ${prog.id || 'Unknown'}`)
    console.log(`      Columns: ${Object.keys(prog).join(', ')}`)
    
    if (prog.audience_segments && Array.isArray(prog.audience_segments)) {
      console.log(`\n      👥 Audience Segments (${prog.audience_segments.length}):`)
      console.log(`\n      Full first segment:`)
      console.log(JSON.stringify(prog.audience_segments[0], null, 2))
      
      prog.audience_segments.forEach((seg, sidx) => {
        console.log(`\n         ${sidx + 1}. ${seg.name || seg.label || 'Unnamed'}`)
        console.log(`            All keys: ${Object.keys(seg).join(', ')}`)
      })
    } else {
      console.log(`      ⚠️ No audience_segments in this programme`)
    }
  })
} else {
  console.log('❌ No programmes found')
}

if (businessProfile?.menu_signal) {
  console.log('\n🍽️ Menu Signal:')
  console.log(`   Signature Items: ${businessProfile.menu_signal.signatureItems?.length || 0}`)
  if (businessProfile.menu_signal.signatureItems) {
    console.log('   Items:', businessProfile.menu_signal.signatureItems.slice(0, 5).join(', '), '...')
  }
} else {
  console.log('\n❌ No menu_signal found')
}
