#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

// Get brand profile with all audience-related fields
const { data: profile, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, strategic_audience_segments, audience_segments, brand_profile_v5, business_identity_persona')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('AUDIENCE SEGMENTS RECONCILIATION')
console.log('═══════════════════════════════════════════════════════════════\n')

// Extract segments from persona
console.log('--- 👥 Segments in PERSONA (business_identity_persona) ---')
const persona = profile.business_identity_persona || ''
const personaSegmentMatch = persona.match(/Strategiske målgrupper:(.*?)(?:TILBUD:|$)/s)
const personaSegments = []
if (personaSegmentMatch) {
  const segmentLines = personaSegmentMatch[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.trim())
  
  segmentLines.forEach(line => {
    console.log(line)
    // Parse segment
    const match = line.match(/- (.+?) \((primær|sekundær)\): (.+)/)
    if (match) {
      personaSegments.push({
        name: match[1],
        priority: match[2],
        timing: match[3]
      })
    }
  })
  console.log(`\nTotal: ${segmentLines.length} segments`)
}

// Check strategic_audience_segments
console.log('\n--- 👥 Segments in STRATEGIC_AUDIENCE_SEGMENTS (JSONB) ---')
if (profile.strategic_audience_segments) {
  console.log(JSON.stringify(profile.strategic_audience_segments, null, 2))
  
  const strategic = profile.strategic_audience_segments
  const strategicSegments = []
  
  if (strategic.primary) {
    strategicSegments.push({
      name: strategic.primary.name,
      priority: 'primær',
      timing: strategic.primary.timing
    })
  }
  
  if (Array.isArray(strategic.secondary)) {
    strategic.secondary.forEach(seg => {
      strategicSegments.push({
        name: seg.name,
        priority: 'sekundær',
        timing: seg.timing
      })
    })
  }
  
  console.log(`\nTotal: ${strategicSegments.length} segments`)
  
  // Compare with persona
  console.log('\n--- ⚔️  COMPARISON ---')
  console.log('\n✅ = Match, ❌ = Mismatch, ⚠️ = Close but not exact\n')
  
  personaSegments.forEach((pSeg, i) => {
    const sSeg = strategicSegments[i]
    if (!sSeg) {
      console.log(`❌ Persona segment ${i+1}: "${pSeg.name}" NOT FOUND in strategic_audience_segments`)
      return
    }
    
    const nameMatch = pSeg.name === sSeg.name
    const priorityMatch = pSeg.priority === sSeg.priority
    const timingMatch = pSeg.timing === sSeg.timing
    
    if (nameMatch && priorityMatch && timingMatch) {
      console.log(`✅ Segment ${i+1}: Perfect match`)
      console.log(`   Name: "${pSeg.name}"`)
      console.log(`   Priority: ${pSeg.priority}`)
      console.log(`   Timing: ${pSeg.timing}`)
    } else {
      console.log(`⚠️  Segment ${i+1}: Partial match`)
      console.log(`   Name: ${nameMatch ? '✅' : '❌'} Persona: "${pSeg.name}" vs Strategic: "${sSeg.name}"`)
      console.log(`   Priority: ${priorityMatch ? '✅' : '❌'} Persona: ${pSeg.priority} vs Strategic: ${sSeg.priority}`)
      console.log(`   Timing: ${timingMatch ? '✅' : '❌'} Persona: "${pSeg.timing}" vs Strategic: "${sSeg.timing}"`)
    }
    console.log()
  })
} else {
  console.log('⚠️  strategic_audience_segments field is NULL or empty')
}

// Check audience_segments
console.log('\n--- 👥 Segments in AUDIENCE_SEGMENTS (Legacy JSONB?) ---')
if (profile.audience_segments) {
  console.log(JSON.stringify(profile.audience_segments, null, 2))
} else {
  console.log('⚠️  audience_segments field is NULL or empty')
}

// Check brand_profile_v5.audience
console.log('\n--- 👥 Segments in BRAND_PROFILE_V5 (Nested) ---')
if (profile.brand_profile_v5?.audience) {
  console.log(JSON.stringify(profile.brand_profile_v5.audience, null, 2))
} else {
  console.log('⚠️  brand_profile_v5.audience is NULL or empty')
}

console.log('\n═══════════════════════════════════════════════════════════════\n')
