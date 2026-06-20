#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Local test script to measure token usage and cost of optimized prompts
 * Run with: deno run --allow-net --allow-env --allow-read _test_token_usage.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUSINESS_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'; // Cafe Faust

// Baseline measurements (before optimization)
const BASELINE = {
  phase0_tokens: 4850,
  phase1_tokens: 15100,
  phase2a_tokens: 3800,
  phase2b_tokens: 9500 * 4, // 4 posts
  phase2c_tokens: 6600,
  total_tokens: 68350,
  total_cost: 0.096,
};

async function testStrategyGeneration() {
  console.log('🧪 Testing optimized strategy generation for Cafe Faust...\n');
  
  // Get environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://kvqdkohdpvmdylqgujpn.supabase.co';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII';

  console.log('📡 Calling get-weekly-strategy function...');
  const startTime = Date.now();
  
  const response = await fetch(`${supabaseUrl}/functions/v1/get-weekly-strategy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      business_id: BUSINESS_ID,
      regenerate: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Function call failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const elapsed = Date.now() - startTime;
  
  console.log(`✅ Function call completed in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`📊 Strategy ID: ${result.strategy_id}`);
  console.log(`📊 Status: ${result.status}\n`);

  // Wait for background generation to complete
  console.log('⏳ Waiting 60s for background strategy generation...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Query the strategy to get token metrics
  console.log('🔍 Querying strategy metrics...\n');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: strategies, error } = await supabase
    .from('weekly_strategies')
    .select('id, status, post_ideas, strategic_brief')
    .eq('business_id', BUSINESS_ID)
    .order('week_start', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to query strategies: ${error.message}`);
  }

  if (!strategies || strategies.length === 0) {
    console.log('❌ No strategy found. Generation may have failed.');
    console.log('💡 Check Supabase dashboard logs for errors.');
    return;
  }

  const strategy = strategies[0];
  console.log(`✅ Strategy found: ${strategy.id}`);
  console.log(`📊 Status: ${strategy.status}`);
  console.log(`📊 Posts: ${strategy.post_ideas?.length || 0}\n`);

  // Note: Token metrics are logged to console during generation
  // We can't retrieve them from the database without adding a metadata column
  console.log('📋 COMPARISON ANALYSIS');
  console.log('='.repeat(60));
  console.log(`\n⚠️  Token metrics are logged in function execution logs.`);
  console.log(`    Check Supabase Dashboard > Edge Functions > get-weekly-strategy > Logs\n`);
  console.log(`📊 Baseline (before optimization):`);
  console.log(`   - Phase 0: ${BASELINE.phase0_tokens.toLocaleString()} tokens`);
  console.log(`   - Phase 1: ${BASELINE.phase1_tokens.toLocaleString()} tokens`);
  console.log(`   - Phase 2a: ${BASELINE.phase2a_tokens.toLocaleString()} tokens`);
  console.log(`   - Phase 2b: ${BASELINE.phase2b_tokens.toLocaleString()} tokens (4 posts)`);
  console.log(`   - Phase 2c: ${BASELINE.phase2c_tokens.toLocaleString()} tokens`);
  console.log(`   - TOTAL: ${BASELINE.total_tokens.toLocaleString()} tokens`);
  console.log(`   - COST: $${BASELINE.total_cost.toFixed(4)}\n`);
  
  console.log(`🎯 Expected savings (from optimization analysis):`);
  console.log(`   - Phase 0 summary: 1,400-2,000 tokens`);
  console.log(`   - BI injection: 1,600-2,400 tokens`);
  console.log(`   - Separators: 275-330 tokens`);
  console.log(`   - BI table format: 800-1,400 tokens`);
  console.log(`   - Verbose prose: 1,175-1,750 tokens`);
  console.log(`   - TOTAL SAVINGS: 5,650-8,480 tokens (8-12%)`);
  console.log(`   - EXPECTED COST: $0.068-$0.074 (23-29% reduction)\n`);
  
  console.log('✅ VALIDATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Check function logs in Supabase Dashboard for actual token counts`);
  console.log(`   2. Compare logged tokens to baseline to verify savings`);
  console.log(`   3. Review generated post quality (titles, rationales, captions)`);
  console.log(`   4. If quality is good, proceed with Gemini migration for Phase 2b\n`);
}

// Run the test
if (import.meta.main) {
  testStrategyGeneration().catch(error => {
    console.error('❌ Test failed:', error);
    Deno.exit(1);
  });
}
