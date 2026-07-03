#!/usr/bin/env node

/**
 * TEST HYBRID PERSONA IMPLEMENTATION
 * Regenerates brand profile for Café Faust to test HYBRID business identity persona
 */

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ3VqcG4iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwNjk1OTIwMCwiZXhwIjoyMDIyNTM1MjAwfQ.123456789' // Replace with actual anon key
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'

async function testHybridPersona() {
  console.log('🧪 Testing HYBRID Persona Implementation...\n')
  
  // Call brand-profile-generator-v5
  console.log(`📞 Calling brand-profile-generator-v5 for Café Faust...`)
  const response = await fetch(`${SUPABASE_URL}/functions/v1/brand-profile-generator-v5`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      business_id: CAFE_FAUST_ID
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Function call failed:', error)
    process.exit(1)
  }

  const result = await response.json()
  console.log('✅ Function completed!\n')
  
  // Check if business_identity exists
  if (result.layer_0_intelligence?.business_identity) {
    console.log('✅ HYBRID business_identity found!\n')
    console.log('📝 Business Identity Persona:')
    console.log('─'.repeat(80))
    console.log(result.layer_0_intelligence.business_identity.system_persona)
    console.log('─'.repeat(80))
    console.log(`\nWord count: ${result.layer_0_intelligence.business_identity.word_count}`)
    console.log(`Signature items: ${result.layer_0_intelligence.business_identity.signature_items_count}`)
    console.log(`Programmes: ${result.layer_0_intelligence.business_identity.programmes_count}`)
    console.log(`City context used: ${result.layer_0_intelligence.business_identity.city_context_used}`)
    console.log(`Generated at: ${result.layer_0_intelligence.business_identity.generated_at}`)
  } else {
    console.log('❌ business_identity NOT found in response')
  }

  // Check city context AI
  if (result.layer_0_intelligence?.city_context_ai) {
    console.log('\n✅ AI-generated city context found!')
    console.log(`City: ${result.layer_0_intelligence.city_context_ai.city}`)
    console.log(`Population: ${result.layer_0_intelligence.city_context_ai.population}`)
    console.log(`Size: ${result.layer_0_intelligence.city_context_ai.city_size}`)
    console.log(`Context: ${result.layer_0_intelligence.city_context_ai.cultural_context}`)
    console.log(`AI-generated: ${result.layer_0_intelligence.city_context_ai.ai_generated}`)
    console.log(`Cached until: ${result.layer_0_intelligence.city_context_ai.cached_until}`)
  } else {
    console.log('\n⚠️  city_context_ai NOT found in response')
  }

  // Quality checks
  console.log('\n🔍 Quality Checks:')
  const persona = result.layer_0_intelligence?.business_identity?.system_persona || ''
  
  const checks = [
    { name: 'Starts with "Du er"', pass: persona.startsWith('Du er'), critical: true },
    { name: 'Does NOT contain "professionel"', pass: !persona.includes('professionel'), critical: true },
    { name: 'Does NOT contain "ekspertise"', pass: !persona.includes('ekspertise'), critical: true },
    { name: 'Word count 100-150', pass: result.layer_0_intelligence?.business_identity?.word_count >= 100 && result.layer_0_intelligence?.business_identity?.word_count <= 150, critical: false },
    { name: 'Contains business name "Café Faust"', pass: persona.includes('Café Faust'), critical: true },
    { name: 'Contains city "Aarhus"', pass: persona.includes('Aarhus'), critical: true }
  ]

  let allPassed = true
  for (const check of checks) {
    const icon = check.pass ? '✅' : (check.critical ? '❌' : '⚠️ ')
    console.log(`${icon} ${check.name}`)
    if (!check.pass && check.critical) {
      allPassed = false
    }
  }

  if (allPassed) {
    console.log('\n🎉 ALL CRITICAL CHECKS PASSED!')
  } else {
    console.log('\n❌ SOME CRITICAL CHECKS FAILED')
  }

  console.log('\n📊 Full result saved to hybrid-persona-test-result.json')
  const fs = require('fs')
  fs.writeFileSync(
    './hybrid-persona-test-result.json',
    JSON.stringify(result, null, 2)
  )
}

testHybridPersona().catch(console.error)
