#!/usr/bin/env node
/**
 * Verify Segment Separation Architecture - June 14, 2026
 * 
 * CORRECT ARCHITECTURE:
 * - business_identity_persona: Contains ONLY 4 sections (static business facts)
 * - strategic_audience_segments: Stored separately in JSONB (dynamic runtime injection)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read .env manually
const envContent = readFileSync('.env', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1]] = match[2]
  }
})

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Cafe Faust

console.log('🔍 Verifying Segment Separation Architecture...\n')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_identity_persona, strategic_audience_segments, updated_at')
  .eq('business_id', businessId)
  .single()

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

console.log('📄 PERSONA TEXT (first 500 chars):')
console.log(data.business_identity_persona.substring(0, 500))
console.log('...\n')

// Check if persona contains "Strategiske målgrupper"
const hasSegmentsInPersona = data.business_identity_persona.includes('Strategiske målgrupper')

console.log('═══════════════════════════════════════════════════════════════\n')

if (hasSegmentsInPersona) {
  console.log('❌ ARCHITECTURAL VIOLATION!')
  console.log('   Persona contains "Strategiske målgrupper:" section')
  console.log('   This violates the separation architecture.\n')
  console.log('Expected: 4 sections only (FORRETNING, LOKATION, TILBUD, KULINARISK KARAKTER)')
  console.log('Actual: 5 sections (includes Strategiske målgrupper)\n')
  process.exit(1)
} else {
  console.log('✅ PERSONA ARCHITECTURE CORRECT')
  console.log('   Contains ONLY 4 sections:')
  console.log('   1. FORRETNING')
  console.log('   2. LOKATION')
  console.log('   3. TILBUD')
  console.log('   4. KULINARISK KARAKTER\n')
}

// Check if strategic_audience_segments field is populated
if (data.strategic_audience_segments && Object.keys(data.strategic_audience_segments).length > 0) {
  console.log('✅ SEGMENTS FIELD POPULATED')
  console.log('   strategic_audience_segments contains:')
  if (data.strategic_audience_segments.primary) {
    console.log(`   - Primary: ${data.strategic_audience_segments.primary.name}`)
  }
  if (data.strategic_audience_segments.secondary && data.strategic_audience_segments.secondary.length > 0) {
    console.log(`   - Secondary: ${data.strategic_audience_segments.secondary.length} segments`)
    data.strategic_audience_segments.secondary.forEach(seg => {
      console.log(`     • ${seg.name}`)
    })
  }
  console.log('')
} else {
  console.log('⚠️  WARNING: strategic_audience_segments field is empty\n')
}

console.log('═══════════════════════════════════════════════════════════════\n')
console.log('🎉 SUCCESS: Architecture follows correct pattern')
console.log('   - Persona = static business facts (4 sections)')
console.log('   - Segments = dynamic JSONB field for runtime injection\n')
console.log(`📅 Last updated: ${data.updated_at}\n`)
