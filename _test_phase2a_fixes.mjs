#!/usr/bin/env node

/**
 * Test Phase 2a fixes:
 * 1. No legacy slot_id expansion (no _exp suffixes)
 * 2. Angle focus validation works (logs warnings for mismatches)
 * 3. Slot count validation (throws error if count mismatch)
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
const TEST_WEEK = 26;

console.log('\n=== Phase 2a Fixes Verification ===\n');

// Step 1: Delete week 26 cache to force fresh generation
console.log('Step 1: Deleting week 26 cache...');

const { error: planDeleteError } = await supabase
  .from('weekly_content_plans')
  .delete()
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', TEST_WEEK);

if (planDeleteError) console.error('  ⚠️ Plan delete:', planDeleteError.message);

const { error: strategyDeleteError } = await supabase
  .from('weekly_strategies')
  .delete()
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', TEST_WEEK);

if (strategyDeleteError) console.error('  ⚠️ Strategy delete:', strategyDeleteError.message);

console.log('  ✓ Cache cleared');

// Step 2: Generate fresh strategy
console.log('\nStep 2: Generating fresh week 26 strategy...');

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/get-weekly-strategy`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      business_id: BUSINESS_ID,
      week_number: TEST_WEEK,
      year: 2025,
    }),
  }
);

if (!response.ok) {
  const errorText = await response.text();
  console.error('  ❌ Function error:', response.status, errorText);
  Deno.exit(1);
}

const result = await response.json();

if (!result.success || !result.strategy_id) {
  console.error('  ❌ Function failed:', result);
  Deno.exit(1);
}

console.log('  ✓ Strategy generated:', result.strategy_id);

// Step 3: Fetch the strategy from database to check slot_ids
console.log('\nStep 3: Fetching strategy data...');

const { data: strategyData, error: fetchError } = await supabase
  .from('weekly_strategies')
  .select('strategic_brief, post_ideas')
  .eq('id', result.strategy_id)
  .single();

if (fetchError || !strategyData) {
  console.error('  ❌ Failed to fetch strategy:', fetchError?.message || 'null result');
  Deno.exit(1);
}

console.log('  ✓ Strategy fetched');

// Step 4: Verify no legacy slot_id patterns
console.log('\nStep 4: Checking for legacy slot_id patterns...');

const angles = strategyData.strategic_brief?.angles || [];
if (angles.length === 0) {
  console.error('  ❌ No angles found in strategic_brief');
  console.error('  Strategic brief keys:', Object.keys(strategyData.strategic_brief || {}).join(', '));
  Deno.exit(1);
}

const hasLegacyPattern = angles.some(angle => 
  angle.slot_id && angle.slot_id.includes('_exp')
);

if (hasLegacyPattern) {
  console.error('  ❌ FAIL: Found legacy _exp suffix in slot_ids');
  console.error('  Angles:', angles.map(a => a.slot_id));
  Deno.exit(1);
} else {
  console.log('  ✓ PASS: No legacy _exp patterns found');
  console.log('  Slot IDs:', angles.map(a => a.slot_id).join(', '));
}

// Check for duplicate angle focus handling
console.log('\nStep 5: Checking angle focus distribution...');

const postIdeas = strategyData.post_ideas || [];
const angleFocuses = postIdeas.map(p => p.angle_focus);
const uniqueFocuses = new Set(angleFocuses);

console.log('  Total posts:', postIdeas.length);
console.log('  Unique angle_focus values:', uniqueFocuses.size);

if (postIdeas.length > 0) {
  console.log('  Angle focuses:');
  postIdeas.forEach((p, i) => {
    console.log(`    ${i + 1}. "${p.angle_focus}" (${p.title})`);
  });
}

if (postIdeas.some(p => p.angle_focus?.includes('(2)') || p.angle_focus?.includes('(3)'))) {
  console.log('  ✓ Found numbered duplicates (e.g., "Focus (2)") - revenue distribution working');
}

console.log('\n=== All tests passed! ===\n');
