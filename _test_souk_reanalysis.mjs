#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Test script: Re-analyze soukaarhus.dk with updated cookie filtering
 * Business ID: 16c0d97d-8f02-4be8-8636-798a7f314db9
 */

import { load } from 'jsr:@std/dotenv'

// Load environment variables
let env = {}
try {
  env = await load({ envPath: '.env.local', export: false })
} catch {
  console.log('No .env.local found, trying .env...')
  try {
    env = await load({ envPath: '.env', export: false })
  } catch {
    console.log('No .env found')
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://oadwluspjlsnxhgakral.supabase.co'
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment')
  Deno.exit(1)
}

const businessId = '16c0d97d-8f02-4be8-8636-798a7f314db9'
const url = 'https://soukaarhus.dk/'

console.log('🔄 Re-analyzing website with cookie filtering fix...')
console.log('📍 URL:', url)
console.log('🆔 Business ID:', businessId)
console.log('')

try {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/analyze-website`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        businessId: businessId,
        tier: 'free',
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ HTTP ${response.status}: ${errorText}`)
    Deno.exit(1)
  }

  const result = await response.json()
  
  console.log('✅ Analysis complete!\n')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('EXTRACTED BUSINESS INFO:')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('Business Name:', result.businessName || '(not found)')
  console.log('Business Type:', result.businessType || '(not found)')
  console.log('\nDescription:')
  console.log(result.description || '(not found)')
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('CONTACT INFO:')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('Phone:', result.contact?.phone || '(not found)')
  console.log('Email:', result.contact?.email || '(not found)')
  console.log('Address:', result.contact?.address || '(not found)')
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('MENU SIGNAL:')
  console.log('═══════════════════════════════════════════════════════════')
  if (result.menuSignal) {
    console.log('Has Menu:', result.menuSignal.hasMenu)
    console.log('Place Synopsis:', result.menuSignal.placeSynopsis)
    console.log('Menu Description:', result.menuSignal.menuDescription)
    console.log('Signature Items:', result.menuSignal.signatureItems)
    console.log('Menu Categories:', result.menuSignal.menuCategories)
  } else {
    console.log('(no menu signal)')
  }
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('URLS:')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('Menu URL:', result.menuUrl || '(not found)')
  console.log('Booking URL:', result.bookingUrl || '(not found)')
  console.log('Detected Menu URLs:', result.detectedMenuUrls || [])
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('KEYWORDS:')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(result.keywords || [])
  console.log('\n═══════════════════════════════════════════════════════════')
  
  // Check if this is significantly better than the original generic result
  const isGeneric = result.description?.includes('My Business is a unique establishment')
  if (isGeneric) {
    console.log('\n⚠️  WARNING: Still getting generic placeholder text!')
    console.log('The cookie filtering may not be sufficient.')
  } else {
    console.log('\n✅ SUCCESS: Extracted real business information!')
  }
  
} catch (error) {
  console.error('❌ Error:', error.message)
  Deno.exit(1)
}
