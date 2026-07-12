#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Trigger fresh website analysis for Souk Aarhus with ScrapingBee
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

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://oadwluspjlsnxhgakral.supabase.co'
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

const businessId = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b'
const websiteUrl = 'https://soukaarhus.dk/da'

console.log('🚀 Triggering website analysis for Souk Aarhus...')
console.log('URL:', websiteUrl)
console.log('\n⏳ Calling analyze-website function (this may take 60+ seconds)...\n')

const startTime = Date.now()

const { data, error } = await supabase.functions.invoke('analyze-website', {
  body: {
    businessId,
    websiteUrl,
    forceReanalysis: true
  }
})

const duration = ((Date.now() - startTime) / 1000).toFixed(1)

if (error) {
  console.error('❌ Analysis failed:', error)
  console.log('Duration:', duration, 'seconds')
  Deno.exit(1)
}

console.log(`✅ Analysis complete! (${duration}s)\n`)
console.log('📊 Results:')
console.log(JSON.stringify(data, null, 2))

// Check if we got good data
if (data?.businessName) {
  console.log('\n✨ Extracted business name:', data.businessName)
  if (data.businessName !== 'soukaarhus.dk') {
    console.log('✅ SUCCESS: Got real business name, not domain!')
  } else {
    console.log('⚠️ WARNING: Still getting domain as name')
  }
}

if (data?.businessType) {
  console.log('✨ Extracted business type:', data.businessType)
  if (data.businessType === 'restaurant') {
    console.log('✅ SUCCESS: Correctly identified as restaurant!')
  } else {
    console.log('⚠️ WARNING: Wrong business type:', data.businessType)
  }
}
