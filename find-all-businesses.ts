import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 SEARCHING ALL BUSINESSES IN DATABASE')
console.log('=' .repeat(60))

// Get all businesses
const { data: businesses, error: businessError } = await supabase
  .from('businesses')
  .select('*')
  .order('created_at', { ascending: false })

if (businessError) {
  console.log('❌ Error:', businessError.message)
  Deno.exit(1)
}

if (!businesses || businesses.length === 0) {
  console.log('⚠️  No businesses found in database')
  Deno.exit(0)
}

console.log(`\n✅ Found ${businesses.length} business(es):\n`)

for (const business of businesses) {
  const bizId = business.business_id || business.id
  console.log(`📍 ${business.short_description || business.business_name || 'Unnamed business'}`)
  console.log(`   ID: ${bizId}`)
  console.log(`   Type: ${business.target_audience}`)
  console.log(`   Created: ${business.created_at}`)
  console.log()
}

// For each business, check Layer 2 data
for (const business of businesses) {
  const bizId = business.business_id || business.id
  console.log('─'.repeat(60))
  console.log(`\n🔍 Checking Layer 2 data for: ${business.short_description || business.business_name || bizId}`)
  
  // Check profile
  const { data: profile } = await supabase
    .from('business_profile')
    .select('brand_voice, tone_formality, tone_energy')
    .eq('business_id', bizId)
    .maybeSingle()
  
  if (profile) {
    console.log('✅ Business profile exists')
    console.log(`   Brand voice: ${profile.brand_voice?.substring(0, 50) || 'Not set'}...`)
  } else {
    console.log('⚠️  No business profile')
  }
  
  // Check menu data
  const { data: menuResults } = await supabase
    .from('menu_results_v2')
    .select('menu_data')
    .eq('business_id', bizId)
  
  if (menuResults && menuResults.length > 0) {
    const menuData = menuResults[0].menu_data as any
    const categories = menuData?.categories || []
    let totalItems = 0
    categories.forEach((cat: any) => {
      totalItems += cat.items?.length || 0
    })
    console.log(`✅ Menu data: ${categories.length} categories, ${totalItems} items`)
  } else {
    console.log('⚠️  No menu data')
  }
  
  // Check Layer 2 defaults (if business has a type column)
  const businessType = business.target_audience || (business as any).business_type
  if (businessType) {
    const { data: defaults } = await supabase
      .from('business_type_defaults')
      .select('*')
      .eq('business_type', businessType)
      .maybeSingle()
    
    if (defaults) {
      console.log(`✅ Layer 2 defaults: ${defaults.menu_highlight_ratio * 100}% menu, ${defaults.ideal_posts_per_week} posts/week`)
    } else {
      console.log(`❌ No Layer 2 defaults for ${businessType}`)
    }
  } else {
    console.log('⚠️  Business type not set')
  }
  
  // Check menu metadata (Layer 5)
  const { data: metadata } = await supabase
    .from('menu_item_metadata')
    .select('id')
    .eq('business_id', bizId)
  
  if (metadata && metadata.length > 0) {
    console.log(`✅ Layer 5 metadata: ${metadata.length} menu items`)
  } else {
    console.log('⚠️  No Layer 5 metadata (needs population)')
  }
  
  console.log()
}

console.log('=' .repeat(60))
console.log('✅ = Data present')
console.log('⚠️  = Not populated yet')
console.log('❌ = Configuration missing')
