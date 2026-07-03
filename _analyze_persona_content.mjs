#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

// 1. Get business_identity_persona content
const { data: profile, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('business_id, business_identity_persona, brand_profile_v5')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (profileError) {
  console.error('Profile Error:', profileError)
  process.exit(1)
}

// 2. Get audience_segments data
const { data: segments, error: segmentsError } = await supabase
  .from('audience_segments')
  .select('*')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .order('priority', { ascending: false })

if (segmentsError) {
  console.error('Segments Error:', segmentsError)
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('PERSONA CONTENT ANALYSIS')
console.log('═══════════════════════════════════════════════════════════════\n')

const persona = profile.business_identity_persona || ''

// Check for sustainability claims
console.log('--- 🌱 Sustainability Check ---')
const sustainabilityTerms = ['bæredygtighed', 'bæredygtig', 'økologisk', 'lokale råvarer', 'sæsonbetonede']
sustainabilityTerms.forEach(term => {
  if (persona.toLowerCase().includes(term.toLowerCase())) {
    console.log(`⚠️  Found: "${term}"`)
  }
})

// Extract segments from persona
console.log('\n--- 👥 Segments in PERSONA ---')
const personaSegmentMatch = persona.match(/Strategiske målgrupper:(.*?)(?:TILBUD:|$)/s)
if (personaSegmentMatch) {
  const segmentLines = personaSegmentMatch[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.trim())
  
  segmentLines.forEach(line => {
    console.log(line)
  })
  console.log(`\nTotal: ${segmentLines.length} segments`)
}

// Show segments from audience_segments table
console.log('\n--- 👥 Segments in AUDIENCE_SEGMENTS Table ---')
if (segments && segments.length > 0) {
  segments.forEach(seg => {
    const isPrimary = seg.priority === 'primary' || seg.priority === 5
    const label = isPrimary ? '(primær)' : '(sekundær)'
    console.log(`- ${seg.segment_name} ${label}: ${seg.time_windows?.join(', ') || 'no time'}`)
  })
  console.log(`\nTotal: ${segments.length} segments`)
} else {
  console.log('⚠️  No segments found in audience_segments table')
}

// Compare segment names
console.log('\n--- ⚔️  Reconciliation Analysis ---')
if (segments && segments.length > 0) {
  const personaSegmentNames = new Set()
  if (personaSegmentMatch) {
    personaSegmentMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .forEach(line => {
        // Extract segment name before (primær) or (sekundær)
        const match = line.match(/- (.+?) \((?:primær|sekundær)\)/)
        if (match) {
          personaSegmentNames.add(match[1].toLowerCase())
        }
      })
  }
  
  const tableSegmentNames = new Set(segments.map(s => s.segment_name.toLowerCase()))
  
  // Find segments only in persona
  const onlyInPersona = [...personaSegmentNames].filter(name => !tableSegmentNames.has(name))
  if (onlyInPersona.length > 0) {
    console.log('\n❌ Only in PERSONA (not in table):')
    onlyInPersona.forEach(name => console.log(`   - ${name}`))
  }
  
  // Find segments only in table
  const onlyInTable = [...tableSegmentNames].filter(name => !personaSegmentNames.has(name))
  if (onlyInTable.length > 0) {
    console.log('\n❌ Only in TABLE (not in persona):')
    onlyInTable.forEach(name => console.log(`   - ${name}`))
  }
  
  // Find matching segments
  const matching = [...personaSegmentNames].filter(name => tableSegmentNames.has(name))
  if (matching.length > 0) {
    console.log('\n✅ Matching segments:')
    matching.forEach(name => console.log(`   - ${name}`))
  }
}

// Check V5 profile for sustainability data
console.log('\n--- 🔍 V5 Profile Data Check ---')
if (profile.brand_profile_v5) {
  const v5 = profile.brand_profile_v5
  console.log('Identity.sustainability:', v5.identity?.sustainability || 'NOT FOUND')
  console.log('Identity.brand_essence:', v5.identity?.brand_essence?.substring(0, 150) || 'NOT FOUND')
  
  // Check menu data
  const { data: menuItems } = await supabase
    .from('menu_items_normalized')
    .select('item_name, item_description')
    .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
    .eq('is_active', true)
    .limit(10)
  
  console.log('\n--- 🍽️  Menu Item Sample ---')
  if (menuItems && menuItems.length > 0) {
    menuItems.slice(0, 5).forEach(item => {
      const hasOrganic = item.item_description?.toLowerCase().includes('økologisk')
      const hasLocal = item.item_description?.toLowerCase().includes('lokal')
      const marker = (hasOrganic || hasLocal) ? '🌱' : '  '
      console.log(`${marker} ${item.item_name}`)
      if (item.item_description && (hasOrganic || hasLocal)) {
        console.log(`   → ${item.item_description.substring(0, 80)}...`)
      }
    })
  }
}

console.log('\n--- 📝 Full Persona ---')
console.log(persona)
console.log('\n═══════════════════════════════════════════════════════════════\n')
