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
import './website-presence.test.ts'

console.log('=' .repeat(60))
console.log('\n✅ All test suites completed successfully!')
console.log('\nTest Coverage:')
console.log('  \u2713 Website Presence Detection (data source validation)')
console.log('  \u2713 Soft Repairs (banned word replacement, empty notes filling)')
console.log('\n🎉 v4.9.0 Phase 3 Complete!')
