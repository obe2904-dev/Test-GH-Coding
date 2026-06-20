import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII'
)

async function checkAudienceSegments() {
  console.log('🔍 Checking audience_segments for Café Faust...\n')
  
  const businessId = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  
  try {
    // First check if any rows exist
    const { data: allData, error: allError } = await supabase
      .from('business_brand_profile')
      .select('business_id')
      .limit(5)
    
    console.log(`📋 Total brand profiles found: ${allData?.length || 0}`)
    if (allData && allData.length > 0) {
      console.log(`   Example IDs: ${allData.map(d => d.business_id.substring(0, 8)).join(', ')}...\n`)
    }
    
    const { data, error } = await supabase
      .from('business_brand_profile')
      .select('business_id, updated_at, audience_segments')
      .eq('business_id', businessId)
      .maybeSingle()
    
    if (error) {
      console.log(`❌ Error: ${error.message}`)
      process.exit(1)
    }
    
    if (!data) {
      console.log(`❌ No brand profile found for business_id: ${businessId}`)
      process.exit(1)
    }
    
    console.log(`✅ Business: ${data.business_id}`)
    console.log(`📅 Updated: ${data.updated_at}`)
    console.log(`\n📊 Audience Segments:`)
    
    if (!data.audience_segments) {
      console.log('   ❌ No audience_segments found')
      process.exit(1)
    }
    
    const segments = data.audience_segments
    
    console.log(`\n   Business Model: ${segments.business_model_type || 'N/A'}`)
    console.log(`   Primary Hook: ${segments.primary_copy_hook || 'N/A'}`)
    console.log(`   Audience Breadth: ${segments.audience_breadth || 'N/A'}`)
    console.log(`   Primary Mindset: ${segments.primary_mindset || 'N/A'}`)
    console.log(`   Tourist Factor: ${segments.tourist_factor || 'N/A'}`)
    console.log(`\n   Segments (${segments.segments?.length || 0}):`)
    
    if (segments.segments && segments.segments.length > 0) {
      segments.segments.forEach((seg, i) => {
        console.log(`\n   ${i + 1}. ${seg.label || seg.name}`)
        console.log(`      Priority: ${seg.priority}`)
        console.log(`      Motivation: ${seg.motivation}`)
        console.log(`      Timing: ${seg.timing?.length || 0} windows`)
        if (seg.timing && seg.timing.length > 0) {
          seg.timing.forEach(t => {
            console.log(`         - ${t.day} ${t.time_range}: ${t.context || ''}`)
          })
        }
        console.log(`      Content angles: ${seg.content_angles?.join(', ') || 'N/A'}`)
      })
    }
    
    console.log('\n✅ Stage B5 audience segmentation successfully saved!')
  } catch (e) {
    console.log(`❌ Error: ${e.message}`)
    process.exit(1)
  }
}

checkAudienceSegments()
