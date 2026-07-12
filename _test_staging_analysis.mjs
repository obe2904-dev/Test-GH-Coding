#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Test analyze-website function on correct Supabase project
 */

import { load } from 'jsr:@std/dotenv'

// Load environment variables
let env = {}
try {
  env = await load({ envPath: '.env.local', export: false })
} catch {
  console.log('No .env.local found')
}

// FORCE the correct staging project
const STAGING_URL = 'https://oadwluspjlsnxhgakral.supabase.co'
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY

console.log('🎯 Targeting STAGING project:', STAGING_URL)
console.log('🚀 Calling analyze-website function...\n')

const startTime = Date.now()

try {
  const response = await fetch(`${STAGING_URL}/functions/v1/analyze-website`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      businessId: '450c1b6a-e354-4eef-88d8-86cd2ac8d42b',
      websiteUrl: 'https://soukaarhus.dk/da',
      forceReanalysis: true
    })
  })

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('📊 Response status:', response.status, response.statusText)
  console.log('⏱️  Duration:', duration, 'seconds\n')

  const data = await response.json()
  
  if (!response.ok) {
    console.error('❌ Error response:')
    console.error(JSON.stringify(data, null, 2))
    Deno.exit(1)
  }

  console.log('✅ Success! Response:')
  console.log(JSON.stringify(data, null, 2))

  // Check results
  if (data?.businessName) {
    console.log('\n✨ Business Name:', data.businessName)
    if (data.businessName !== 'soukaarhus.dk') {
      console.log('  ✅ Got real name (not domain)!')
    }
  }

  if (data?.businessType) {
    console.log('✨ Business Type:', data.businessType)
    if (data.businessType === 'restaurant') {
      console.log('  ✅ Correctly identified as restaurant!')
    }
  }

} catch (error) {
  console.error('❌ Request failed:', error.message)
  Deno.exit(1)
}
