import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Café Faust

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, brand_profile_v5')
  .eq('business_id', businessId)
  .single()

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

const persona = data?.brand_profile_v5?.layer_0_intelligence?.business_identity?.system_persona
const metadata = data?.brand_profile_v5?.layer_0_intelligence?.business_identity?.metadata

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎭 CAFÉ FAUST - BUSINESS IDENTITY PERSONA')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

if (persona) {
  console.log(persona)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 METADATA')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log(JSON.stringify(metadata, null, 2))
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  // Count words
  const wordCount = persona.split(/\s+/).length
  console.log(`📏 Word count: ${wordCount}`)
  console.log(`📝 Character count: ${persona.length}`)
} else {
  console.log('❌ No persona found')
}
