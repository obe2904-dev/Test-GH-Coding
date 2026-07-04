#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Update database function to use TESTING MODE quotas (100 for all tiers)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

// Read .env file manually
const envText = await Deno.readTextFile('.env')
const envVars = {}
for (const line of envText.split('\n')) {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

console.log('🔄 Updating database function to TESTING MODE (all tiers = 100)...\n')

// Execute the SQL from the migration file
const sql = await Deno.readTextFile('supabase/migrations/20260527000000_testing_mode_quotas.sql')

// Use the REST API to execute SQL
const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
  method: 'POST',
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ query: sql })
})

// Try alternative approach using query
const { data: result, error } = await supabase
  .from('_sql')
  .select('*')
  .limit(0)

console.log('📝 Executing SQL directly...')

// Use fetch to execute against the PostgREST endpoint
const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
  method: 'POST',
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/sql',
    'Prefer': 'return=representation'
  },
  body: sql
})

if (!sqlResponse.ok) {
  console.error('❌ SQL execution failed:', await sqlResponse.text())
  console.log('\n🔧 Manual steps required:')
  console.log('1. Open Supabase SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new')
  console.log('\n2. Paste and run this SQL:\n')
  console.log(sql)
  Deno.exit(1)
}

const sqlResult = await sqlResponse.json()
console.log('✅ SQL executed!')
console.log('Result:', sqlResult)

// Verify the update
console.log('\n🧪 Verifying updated quotas...')
const { data, error: verifyError } = await supabase.rpc('get_daily_usage_stats', {
  p_business_id: 'f4679fa9-3120-4a59-9506-d059b010c34a'
})

if (verifyError) {
  console.error('❌ Verification error:', verifyError)
} else if (data && data[0]) {
  console.log(`\n✅ New Limit: ${data[0].regenerations_limit}`)
  if (data[0].regenerations_limit === 100) {
    console.log('🎉 Success! All tiers now have 100 regenerations/day')
  } else {
    console.log(`⚠️  Limit is ${data[0].regenerations_limit}, expected 100`)
  }
}
