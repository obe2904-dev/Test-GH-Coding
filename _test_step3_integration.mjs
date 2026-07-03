#!/usr/bin/env node

/**
 * Test Step 3: Phase 1 Integration with Business Rules Engine
 * Business: Cafe Faust
 * Expected: Console logs showing Business Rules Engine in use
 */

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA4MzExNSwiZXhwIjoyMDUxNjU5MTE1fQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo';

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'; // Cafe Faust

// Get current week Monday
const today = new Date();
const dayOfWeek = today.getDay();
const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
const monday = new Date(today);
monday.setDate(today.getDate() + diff);
monday.setHours(0, 0, 0, 0);

const weekStart = monday.toISOString().split('T')[0];

console.log('========================================');
console.log('  STEP 3 INTEGRATION TEST: Cafe Faust');
console.log('========================================');
console.log(`Business ID: ${businessId}`);
console.log(`Week Start: ${weekStart}`);
console.log('');
console.log('Expected Console Logs:');
console.log('  [Phase 1] Using Business Rules Engine (brand_profile_v5.layer_1_programmes, confidence 95%)');
console.log('  [Business Rules Engine] Generated slots: A(drive_footfall/product_menu): same_day 08:00-10:00, ...');
console.log('');
console.log('========================================');
console.log('');

async function testIntegration() {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_id: businessId,
        week_start: weekStart,
        regenerate: true, // Force regeneration to see fresh logs
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Error response:', error);
      return;
    }

    const result = await response.json();
    
    console.log('✅ Weekly Strategy Generated Successfully');
    console.log('');
    console.log('Strategic Brief (first 3 angles):');
    console.log('----------------------------------------');
    
    if (result.strategic_brief?.angles) {
      result.strategic_brief.angles.slice(0, 3).forEach((angle, idx) => {
        console.log(`\nAngle ${idx + 1}:`);
        console.log(`  Occasion: ${angle.occasion_identity || 'N/A'}`);
        console.log(`  Slot: ${angle.slot_id}`);
        console.log(`  Goal Mode: ${angle.goal_mode}`);
        console.log(`  Content Category: ${angle.content_category}`);
        console.log(`  Timing Window: ${angle.timing_window}`);
        console.log(`  Headline: ${angle.headline_hook?.substring(0, 80)}...`);
      });
    }
    
    console.log('');
    console.log('========================================');
    console.log('');
    console.log('✅ VERIFICATION STEPS:');
    console.log('');
    console.log('1. Check Supabase Function Logs for:');
    console.log('   [Phase 1] Using Business Rules Engine (brand_profile_v5.layer_1_programmes, confidence 95%)');
    console.log('');
    console.log('2. Verify Slot Assignments:');
    console.log('   - At least one angle with timing_window="same_day 08:00-10:00" (FROKOST)');
    console.log('   - At least one angle with timing_window="Thursday 14:00" (AFTEN)');
    console.log('   - At least one angle with timing_window="Monday 09:00" (Brand)');
    console.log('');
    console.log('3. Check that slot metadata reflects revenue patterns:');
    console.log('   - Primary lunch service → same_day morning timing');
    console.log('   - Secondary dinner service → Thursday advance booking');
    console.log('   - Brunch programme → Mid-week engagement');
    console.log('');
    console.log('View logs at: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/logs/functions');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testIntegration();
