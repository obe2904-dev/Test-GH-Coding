// Quick fix: Update Café Faust location to Aarhus
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixCity() {
  console.log('🔍 Checking what businesses exist...')
  
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .limit(10)
  
  if (bizError) {
    console.error('❌ Error fetching businesses:', bizError)
    return
  }
  
  console.log('\n📋 Available businesses:')
  businesses.forEach(b => {
    console.log(`   - ${b.name} (${b.id.substring(0, 8)}...)`)
  })
  
  // Find Café Faust or use first one
  const cafeFaust = businesses.find(b => b.name?.toLowerCase().includes('faust'))
  const targetBusiness = cafeFaust || businesses[0]
  
  if (!targetBusiness) {
    console.error('❌ No businesses found in database!')
    return
  }
  
  console.log(`\n🎯 Using business: ${targetBusiness.name} (${targetBusiness.id})`)
  
  // Check location
  const { data: locations } = await supabase
    .from('business_locations')
    .select('city, country, is_primary')
    .eq('business_id', targetBusiness.id)
  
  console.log('📍 Current locations:', JSON.stringify(locations, null, 2))
  
  if (!locations || locations.length === 0) {
    console.log('\n🆕 Creating location record...')
    
    const { data: inserted, error: insertError } = await supabase
      .from('business_locations')
      .insert({
        business_id: targetBusiness.id,
        city: 'Aarhus',
        country: 'DK',
        is_primary: true
      })
      .select()
    
    if (insertError) {
      console.error('❌ Error inserting:', insertError)
      return
    }
    
    console.log('✅ Location created:', inserted[0])
  } else {
    console.log('\n🔧 Updating city to Aarhus...')
    
    const { data: updated, error: updateError } = await supabase
      .from('business_locations')
      .update({ city: 'Aarhus' })
      .eq('business_id', targetBusiness.id)
      .select()
    
    if (updateError) {
      console.error('❌ Error updating:', updateError)
      return
    }
    
    console.log('✅ Updated:', updated[0])
  }
  
  console.log('\n✅ Done! Use this business_id for testing:', targetBusiness.id)
}

fixCity().catch(console.error)
