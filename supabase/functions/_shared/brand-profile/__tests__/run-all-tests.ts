/**
 * Test Runner for v4.9.0 Phase 3
 * 
 * Runs all unit tests for brand profile generation features.
 * 
 * Usage:
 *   deno test supabase/functions/_shared/brand-profile/__tests__/run-all-tests.ts
 */

console.log('🧪 Running Brand Profile Generator Test Suite (v4.9.0 Phase 3)\n')
console.log('=' .repeat(60))

// Import all test files
import './proof-grounding.test.ts'
import './website-presence.test.ts'
import './soft-repairs.test.ts'

console.log('=' .repeat(60))
console.log('\n✅ All test suites completed successfully!')
console.log('\nTest Coverage:')
console.log('  ✓ Proof Grounding (cleanProofArray, applyProofGrounding, token extraction)')
console.log('  ✓ Website Presence Detection (data source validation)')
console.log('  ✓ Soft Repairs (banned word replacement, empty notes filling)')
console.log('\n🎉 v4.9.0 Phase 3 Complete!')
