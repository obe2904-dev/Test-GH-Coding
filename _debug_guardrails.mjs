#!/usr/bin/env node
/**
 * Debug script: Check what's actually in brand_profile_v5.guardrails
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const BUSINESS_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('Fetching brand_profile_v5 for Cafe Faust...')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', BUSINESS_ID)
  .single()

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('\nFull brand_profile_v5 structure:')
console.log(JSON.stringify(data.brand_profile_v5, null, 2))

console.log('\n\n===== GUARDRAILS =====')
console.log(JSON.stringify(data.brand_profile_v5?.guardrails, null, 2))
