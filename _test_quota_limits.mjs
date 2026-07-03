#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test current quota limits in database
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

const supabase = createClient(supabaseUrl, supabaseKey)

// Test with Cafe Faust
const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('🧪 Testing current quota limits from database...\n')

const { data, error } = await supabase.rpc('get_daily_usage_stats', {
  p_business_id: businessId
})

if (error) {
  console.error('❌ Error:', error)
  Deno.exit(1)
}

console.log('📊 Current Database Quotas:')
console.log(JSON.stringify(data, null, 2))

if (data && data[0]) {
  const stats = data[0]
  console.log(`\n✅ Current Limit: ${stats.regenerations_limit}`)
  console.log(`📍 Used Today: ${stats.regenerations_used}`)
  console.log(`🎯 Tier: ${stats.tier}`)
  
  if (stats.regenerations_limit !== 100) {
    console.log(`\n⚠️  Limit is ${stats.regenerations_limit}, not 100!`)
    console.log('\n📝 To update, run this SQL in Supabase SQL Editor:')
    console.log('https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new\n')
    console.log('-- Paste the content from: supabase/migrations/20260527000000_testing_mode_quotas.sql')
  } else {
    console.log('\n✅ Limit is already set to 100!')
  }
}
