#!/usr/bin/env node
/**
 * Verify V5.3 Brand Profile Generation Results
 * Checks database for marketing manager brief, USPs, and customer situations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { readFileSync, existsSync } from 'node:fs'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'

// Get anon key from .env.local
let ANON_KEY = null
let ACCESS_TOKEN = null
const envFiles = ['.env.local', '.env']
for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    const envContent = readFileSync(envFile, 'utf-8')
    const anonMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)
    const tokenMatch = envContent.match(/ACCESS_TOKEN=(.+)/)
    if (anonMatch) ANON_KEY = anonMatch[1].trim()
    if (tokenMatch) ACCESS_TOKEN = tokenMatch[1].trim()
    if (ANON_KEY && ACCESS_TOKEN) break
  }
}

if (!ANON_KEY || !ACCESS_TOKEN) {
  console.error('❌ VITE_SUPABASE_ANON_KEY or ACCESS_TOKEN not found')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  global: {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`
    }
  }
})

console.log('═══════════════════════════════════════════════════════════════')
console.log('  V5.3 VERIFICATION RESULTS')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`Business ID: ${BUSINESS_ID}`)
console.log('')

// Test 1: Marketing Manager Brief
console.log('─── Test 1: Marketing Manager Brief ───')
const { data: profile, error: profileError } = await supabase
  .from('business_brand_profile')
  .select('marketing_manager_brief, brand_profile_v5')
  .eq('business_id', BUSINESS_ID)
  .single()

if (profileError) {
  console.error('❌ Failed to fetch profile:', profileError.message)
} else if (!profile.marketing_manager_brief) {
  console.log('❌ Marketing manager brief is NULL')
} else {
  const brief = profile.marketing_manager_brief
  const length = brief.length
  const isDanish = /Du er/i.test(brief)
  const hasEnglish = /you are|always|never/i.test(brief)
  
  console.log(`✅ Marketing manager brief exists`)
  console.log(`   Length: ${length} chars`)
  console.log(`   Danish: ${isDanish ? 'YES ✅' : 'NO ❌'}`)
  console.log(`   English pollution: ${hasEnglish ? 'YES ❌' : 'NO ✅'}`)
  console.log(`\n   Preview:\n   ${brief.substring(0, 250)}...\n`)
}

// Test 2: USPs
console.log('─── Test 2: USP Extraction ───')
const v5 = profile?.brand_profile_v5
if (v5?.layer_0_intelligence?.usps) {
  const usps = v5.layer_0_intelligence.usps
  console.log(`✅ USPs extracted`)
  console.log(`   Primary: ${usps.primary_usp?.text || 'N/A'} (score: ${usps.primary_usp?.score || 'N/A'})`)
  console.log(`   Secondary: ${usps.secondary_usps?.length || 0} (${usps.secondary_usps?.map(u => u.text).join(', ') || 'none'})`)
} else {
  console.log('❌ USPs not found in brand_profile_v5')
}

// Test 3: Customer Situations
console.log('\n─── Test 3: Customer Situations ───')
const { data: programmes, error: progError } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, programme_name, audience_segments')
  .eq('business_id', BUSINESS_ID)

if (progError) {
  console.error('❌ Failed to fetch programmes:', progError.message)
} else {
  let totalSituations = 0
  let segmentsWithSituations = 0
  
  programmes.forEach(prog => {
    if (prog.audience_segments) {
      prog.audience_segments.forEach(segment => {
        if (segment.situations && segment.situations.length > 0) {
          totalSituations += segment.situations.length
          segmentsWithSituations++
        }
      })
    }
  })
  
  if (segmentsWithSituations > 0) {
    console.log(`✅ Customer situations added to ${segmentsWithSituations} segments`)
    console.log(`   Total situations: ${totalSituations}`)
    
    // Show sample
    const sampleProg = programmes.find(p => p.audience_segments?.some(s => s.situations?.length > 0))
    if (sampleProg) {
      const sampleSegment = sampleProg.audience_segments.find(s => s.situations?.length > 0)
      console.log(`\n   Sample (${sampleProg.programme_type} - ${sampleSegment.label}):`)
      console.log(`   ${sampleSegment.situations.join(', ')}`)
    }
  } else {
    console.log('❌ No customer situations found')
  }
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('  VERIFICATION COMPLETE')
console.log('═══════════════════════════════════════════════════════════════')
