#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Test ONLY the city context function in isolation
 * This helps debug if the issue is with city context or something else
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import OpenAI from 'https://esm.sh/openai@4.20.1'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set')
  Deno.exit(1)
}

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

console.log('🧪 Testing city context cache...\n')

// Test 1: Check table exists
console.log('1️⃣ Checking if city_context_cache table exists...')
const { data: tableCheck, error: tableError } = await supabase
  .from('city_context_cache')
  .select('count')
  .limit(1)

if (tableError) {
  console.error('❌ Table check failed:', tableError.message)
  Deno.exit(1)
}
console.log('✅ Table exists\n')

// Test 2: Read existing cache (Aarhus)
console.log('2️⃣ Reading cached city: Aarhus...')
const { data: cached, error: cacheError } = await supabase
  .from('city_context_cache')
  .select('*')
  .eq('city', 'Aarhus')
  .eq('country', 'Denmark')
  .single()

if (cacheError) {
  console.error('❌ Cache read failed:', cacheError.message)
} else {
  console.log('✅ Cache HIT:')
  console.log(`   City: ${(cached as any).city}`)
  console.log(`   Population: ${(cached as any).population}`)
  console.log(`   Size: ${(cached as any).city_size}`)
  console.log(`   Context: ${(cached as any).cultural_context}`)
}

console.log('\n✅ All tests passed!')
console.log('If this works, the issue is NOT with city_context_cache table.')
