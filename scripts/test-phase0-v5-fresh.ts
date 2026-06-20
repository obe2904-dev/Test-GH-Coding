/**
 * Test Phase 0 V5 Enhancement with Fresh Generation
 * Clears cache and generates new strategy to verify V5 programme windows appear in Phase 0
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Load environment
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f' // Café Faust
const WEEK_NUMBER = 20  // Current week (May 12-18, 2026)
const YEAR = 2026

// Calculate week_start date (2026-05-11 for week 20)
const weekStartDate = new Date(2026, 4, 11) // May 11, 2026 (month is 0-indexed)
const weekStartStr = weekStartDate.toISOString().split('T')[0]

console.log('🧪 Testing Phase 0 V5 Enhancement')
console.log('Business: Café Faust')
console.log('Week:', WEEK_NUMBER, YEAR, '(May 11-17, 2026 - CURRENT WEEK)')
console.log('Week start:', weekStartStr)
console.log('')

// Step 1: Clear cache
console.log('Step 1: Clearing existing strategy cache')
const { error: deleteError, count } = await supabase
  .from('weekly_strategies')
  .delete({ count: 'exact' })
  .eq('business_id', BUSINESS_ID)
  .eq('week_start', weekStartStr)

if (deleteError) {
  console.warn('⚠️  Cache clear warning:', deleteError.message)
} else {
  console.log(`✅ Cache cleared (${count || 0} rows deleted)`)
}

console.log('')

// Step 2: Generate fresh strategy
console.log('Step 2: Generating fresh weekly strategy')
const startTime = Date.now()

const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
  },
  body: JSON.stringify({
    business_id: BUSINESS_ID,
    week_number: WEEK_NUMBER,
    year: YEAR,
    force_regenerate: true  // Force bypass cache
  })
})

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
const result = await response.json()

if (!response.ok) {
  console.error('❌ Generation failed:', result)
  Deno.exit(1)
}

console.log(`✅ Strategy generated in ${elapsed}s`)
console.log('')
console.log('📊 Results:')
console.log('   Strategy ID:', result.strategy_id)
console.log('   From cache:', result.from_cache)
console.log('   Post count:', result.strategy?.post_ideas?.length || 0)
console.log('   Generated at:', result.strategy?.generated_at)
console.log('')

// Step 3: Verification instructions
console.log('🔍 Manual Verification Steps:')
console.log('')
console.log('   1. Open Supabase Dashboard Logs:')
console.log('      https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions/get-weekly-strategy/logs')
console.log('')
console.log('   2. Find the most recent invocation (just now)')
console.log('')
console.log('   3. Search logs for these keywords:')
console.log('      • "V5 PROGRAMME DRIFTSVINDUER"')
console.log('      • "formatProgrammeWindows"')
console.log('      • "TEMPORAL PRÆCISION"')
console.log('')
console.log('   4. Expected in Phase 0 prompt:')
console.log('      • List of programmes with days and hours')
console.log('      • Example: "• Brunch Programme: Lørdag-Søndag, 09:00-14:00 (confidence: 0.85)"')
console.log('      • Instruction to cross-reference temporal factors with programme windows')
console.log('')
console.log('   5. Verify Phase 0 output:')
console.log('      • Should mention temporal alignment with programmes')
console.log('      • Example: "Frokosttrafik aligner med Frokost Programme (Man-Fre, 11:30-15:00)"')
console.log('')
console.log('✅ Test complete!')
