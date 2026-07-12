#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Check what was extracted for Souk Aarhus after cookie consent fix
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { load } from 'jsr:@std/dotenv'

// Load environment variables
let env = {}
try {
  env = await load({ envPath: '.env.local', export: false })
} catch {
  try {
    env = await load({ envPath: '.env', export: false })
  } catch {
    console.log('No env file found')
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://oadwluspjlsnxhgakral.supabase.co'
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const businessId = '16c0d97d-8f02-4be8-8636-798a7f314db9'

console.log('🔍 Checking extraction results for Souk Aarhus...\n')

// Get business data
const { data: business, error: bizError } = await supabase
  .from('businesses')
  .select('*')
  .eq('id', businessId)
  .single()

if (bizError) {
  console.error('❌ Error fetching business:', bizError)
  Deno.exit(1)
}

console.log('═══════════════════════════════════════════════════════════')
console.log('BUSINESS TABLE DATA:')
console.log('═══════════════════════════════════════════════════════════')
console.log('Name:', business?.name || '(empty)')
console.log('Category:', business?.category || '(empty)')
console.log('Business Type (hybrid):', JSON.stringify(business?.business_type_hybrid, null, 2) || '(empty)')
console.log('Website:', business?.website_url || '(empty)')
console.log('Logo URL:', business?.logo_url || '(empty)')

// Get business profile data
const { data: profile, error: profileError } = await supabase
  .from('business_profile')
  .select('long_description, menu_signal, key_offerings, user_about_text, ai_place_synopsis')
  .eq('business_id', businessId)
  .single()

if (!profileError && profile) {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('BUSINESS PROFILE DATA:')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('Long Description:')
  console.log(profile?.long_description || '(empty)')
  console.log('User About Text:', profile?.user_about_text || '(empty)')
  console.log('AI Place Synopsis:', profile?.ai_place_synopsis || '(empty)')
  console.log('\nMenu Signal:')
  console.log(JSON.stringify(profile?.menu_signal, null, 2) || '(empty)')
  console.log('\nKey Offerings:')
  console.log(JSON.stringify(profile?.key_offerings, null, 2) || '(empty)')
}

// Get website analysis data
const { data: analysis, error: analysisError } = await supabase
  .from('website_analyses')
  .select('raw_result, analyzed_at')
  .eq('business_id', businessId)
  .order('analyzed_at', { ascending: false })
  .limit(1)
  .single()

if (!analysisError && analysis) {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('WEBSITE ANALYSIS (LATEST):')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('Analyzed At:', analysis?.analyzed_at)
  console.log('Raw Result Size:', JSON.stringify(analysis?.raw_result || {}).length, 'chars')
  
  const result = analysis?.raw_result
  if (result) {
    console.log('\nExtracted by AI:')
    console.log('  Business Name:', result.businessName || '(not extracted)')
    console.log('  Business Type:', typeof result.businessType === 'object' 
      ? JSON.stringify(result.businessType) 
      : result.businessType || '(not extracted)')
    console.log('  Description:', result.description || '(not extracted)')
    console.log('\nContact Info:')
    console.log('  Phone:', result.contact?.phone || '(not extracted)')
    console.log('  Email:', result.contact?.email || '(not extracted)')
    console.log('  Address:', result.contact?.address || '(not extracted)')
    console.log('\nMenu Signal:')
    if (result.menuSignal) {
      console.log('  Has Menu:', result.menuSignal.hasMenu)
      console.log('  Place Synopsis:', result.menuSignal.placeSynopsis || '(not extracted)')
      console.log('  Menu Description:', result.menuSignal.menuDescription || '(not extracted)')
      console.log('  Signature Items:', result.menuSignal.signatureItems || '(not extracted)')
      console.log('  Menu Categories:', result.menuSignal.menuCategories || '(not extracted)')
    } else {
      console.log('  (no menu signal extracted)')
    }
    console.log('\nURLs:')
    console.log('  Menu URL:', result.menuUrl || '(not detected)')
    console.log('  Booking URL:', result.bookingUrl || '(not detected)')
    console.log('  Detected Menu URLs:', result.detectedMenuUrls || [])
  }
} else {
  console.log('\n⚠️ No website analysis found')
}

// Check if this looks like the original generic problem
if (profile?.long_description?.includes('My Business is a unique establishment')) {
  console.log('\n❌ PROBLEM: Still getting generic placeholder text!')
  console.log('The cookie consent filtering did not fully resolve the issue.')
} else if (profile?.long_description && profile.long_description.length > 50) {
  console.log('\n✅ Good: Description contains real content (not generic placeholder)')
} else {
  console.log('\n⚠️ Warning: Description is empty or very short')
}
