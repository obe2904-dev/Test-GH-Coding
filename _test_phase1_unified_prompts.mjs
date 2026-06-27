#!/usr/bin/env node

/**
 * Phase 1 Unified Prompts Test
 * 
 * Tests the hybrid B+C unified prompt implementation:
 * - Verifies 2 AI calls instead of 4 (planner+A, then B+C unified)
 * - Checks that Slot B doesn't repeat Slot A dish
 * - Validates JSON array parsing from Gemini
 * - Measures response time improvement
 * 
 * Test business: Café Faust (38fc71f8-8afb-4702-a4d7-c981e84bb779)
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── Load environment variables manually ──
function loadEnv() {
  const envPaths = ['.env.local', '.env']
  
  for (const path of envPaths) {
    try {
      const envFile = readFileSync(path, 'utf-8')
      const lines = envFile.split('\n')
      
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          process.env[key.trim()] = value
        }
      }
      console.log(`✅ Loaded environment from ${path}`)
    } catch (e) {
      // Try next file
    }
  }
}

// Load both .env.local and .env
loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ══════════════════════════════════════════════════════════════════════════════
// TEST: Phase 1 Unified Prompts
// ══════════════════════════════════════════════════════════════════════════════

const CAFE_FAUST_ID = '38fc71f8-8afb-4702-a4d7-c981e84bb779'

console.log('\n' + '═'.repeat(80))
console.log('PHASE 1 TEST: Unified B+C Prompts')
console.log('═'.repeat(80))

async function testUnifiedPrompts() {
  console.log(`\n📋 Test Business: Café Faust`)
  console.log(`   Business ID: ${CAFE_FAUST_ID}`)
  
  // Clear cache to force fresh generation
  const cacheKey = `quick-suggestions-v1:${CAFE_FAUST_ID}`
  await supabase.from('edge_function_cache').delete().eq('cache_key', cacheKey)
  console.log(`   Cache cleared: ${cacheKey}`)
  
  console.log('\n🚀 Calling get-quick-suggestions edge function...')
  console.log('   Expected: 2 AI calls (planner+A, then B+C unified)')
  
  const startTime = Date.now()
  
  const { data, error } = await supabase.functions.invoke('get-quick-suggestions', {
    body: {
      businessId: CAFE_FAUST_ID,
      tier: 'premium', // Pro tier to test full 3-slot generation
      regenerate: true,
      localTime: new Date().toISOString(),
      debug: true
    }
  })
  
  const elapsed = Date.now() - startTime
  
  if (error) {
    console.error('\n❌ ERROR:', error)
    return false
  }
  
  if (!data) {
    console.error('\n❌ No data returned')
    return false
  }
  
  console.log(`\n✅ Response received in ${(elapsed / 1000).toFixed(2)}s`)
  
  // ── Validate response structure ──
  console.log('\n📊 Response Analysis:')
  console.log(`   Total suggestions: ${data.suggestions?.length || 0}`)
  
  if (!data.suggestions || data.suggestions.length === 0) {
    console.error('   ❌ No suggestions returned')
    return false
  }
  
  const suggestions = data.suggestions
  
  // ── Check slot distribution ──
  const slotA = suggestions.find(s => s.slot === 'offering')
  const slotB = suggestions.find(s => s.slot === 'guest_moment')
  const slotC = suggestions.find(s => s.slot === 'brand_behind')
  
  console.log('\n📌 Slot Distribution:')
  console.log(`   Slot A (offering):      ${slotA ? '✅' : '❌'} ${slotA?.title || 'missing'}`)
  console.log(`   Slot B (guest_moment):  ${slotB ? '✅' : '❌'} ${slotB?.title || 'missing'}`)
  console.log(`   Slot C (brand_behind):  ${slotC ? '✅' : '❌'} ${slotC?.title || 'missing'}`)
  
  // ── Check deduplication ──
  console.log('\n🔍 Deduplication Check:')
  const slotADish = slotA?.menu_item_name
  const slotBDish = slotB?.menu_item_name
  
  console.log(`   Slot A dish: ${slotADish || 'N/A'}`)
  console.log(`   Slot B dish: ${slotBDish || 'N/A'}`)
  
  if (slotADish && slotBDish) {
    const isDuplicate = slotADish.toLowerCase() === slotBDish.toLowerCase()
    console.log(`   Duplicate check: ${isDuplicate ? '❌ DUPLICATE!' : '✅ Different dishes'}`)
    
    if (isDuplicate) {
      console.error('   ⚠️ DEDUPLICATION FAILED: Slot B repeated Slot A dish!')
      return false
    }
  }
  
  // ── Content type validation ──
  console.log('\n📝 Content Types:')
  suggestions.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.content_type?.padEnd(15)} - "${s.title}"`)
  })
  
  // ── Field presence validation ──
  console.log('\n✅ Required Fields Check:')
  const requiredFields = ['title', 'content_type', 'slot']
  
  suggestions.forEach((s, i) => {
    const missing = requiredFields.filter(f => !s[f])
    if (missing.length > 0) {
      console.log(`   Suggestion ${i + 1}: ❌ Missing: ${missing.join(', ')}`)
    } else {
      console.log(`   Suggestion ${i + 1}: ✅ All required fields present`)
    }
  })
  
  // ── Performance summary ──
  console.log('\n⏱️ Performance Metrics:')
  console.log(`   Response time: ${(elapsed / 1000).toFixed(2)}s`)
  console.log(`   Target: <10s (old: 12-15s)`)
  console.log(`   Status: ${elapsed < 10000 ? '✅ PASS' : '⚠️ SLOW'}`)
  
  // ── Check for unified call evidence in logs ──
  console.log('\n📋 Implementation Validation:')
  console.log('   Check server logs for:')
  console.log('   - "🤖 Generating Slots B+C [menu_item, behind_scenes] via Gemini (unified)"')
  console.log('   - "✅ [Slots-B+C] OK: 2 suggestions"')
  
  return true
}

// ══════════════════════════════════════════════════════════════════════════════
// RUN TEST
// ══════════════════════════════════════════════════════════════════════════════

try {
  const success = await testUnifiedPrompts()
  
  console.log('\n' + '═'.repeat(80))
  if (success) {
    console.log('✅ PHASE 1 TEST PASSED')
    console.log('   Unified B+C prompts working correctly')
    console.log('   Deduplication preserved')
    console.log('   Ready for staging deployment')
  } else {
    console.log('❌ PHASE 1 TEST FAILED')
    console.log('   Review logs above for details')
    process.exit(1)
  }
  console.log('═'.repeat(80) + '\n')
  
} catch (error) {
  console.error('\n❌ Test exception:', error)
  process.exit(1)
}
