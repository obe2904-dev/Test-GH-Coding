#!/usr/bin/env node
/**
 * Test Validation Script - Schema Alignment Fixes
 * 
 * Purpose: Validate that all 4 critical bugs are fixed in deployment
 * Run after deploying edge function updates
 * 
 * Prerequisites:
 * - Supabase CLI installed
 * - Environment variables configured
 * - Test business with website_url populated
 * 
 * Usage:
 *   npm run test:schema-alignment
 *   OR
 *   node _TEST_SCHEMA_ALIGNMENT_VALIDATION.mjs <business_id>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSchemaAlignment(businessId) {
  console.log('🧪 Testing Schema Alignment Fixes\n');
  console.log(`Business ID: ${businessId}\n`);

  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  // ======================================
  // STEP 1: Get current state
  // ======================================
  console.log('📊 Step 1: Fetching current data...');
  
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select(`
      *,
      business_profile (*),
      business_brand_profile (*),
      business_operations (*)
    `)
    .eq('id', businessId)
    .single();

  if (businessError || !business) {
    console.error('❌ Could not fetch business:', businessError);
    process.exit(1);
  }

  console.log(`   Business: ${business.name}`);
  console.log(`   Website: ${business.website_url || 'none'}\n`);

  // ======================================
  // STEP 2: Trigger website analysis
  // ======================================
  console.log('🔄 Step 2: Triggering website analysis...');
  
  const { data: functionData, error: functionError } = await supabase.functions.invoke(
    'analyze-and-distribute-website',
    {
      body: { business_id: businessId },
    }
  );

  if (functionError) {
    console.error('❌ Function invocation failed:', functionError);
    results.failed.push('Function invocation');
  } else {
    console.log('   ✅ Function executed successfully');
    console.log(`   Duration: ${functionData.duration_ms}ms`);
    console.log(`   Quality: ${functionData.quality}`);
    console.log(`   Cached: ${functionData.cached ? 'yes' : 'no'}\n`);
    results.passed.push('Function invocation');
  }

  // Wait for database updates
  await new Promise(resolve => setTimeout(resolve, 2000));

  // ======================================
  // STEP 3: Fetch updated data
  // ======================================
  console.log('🔍 Step 3: Validating database writes...');
  
  const { data: updated, error: updateError } = await supabase
    .from('businesses')
    .select(`
      *,
      business_profile (*),
      business_brand_profile (*),
      business_operations (*)
    `)
    .eq('id', businessId)
    .single();

  if (updateError) {
    console.error('❌ Could not fetch updated business:', updateError);
    process.exit(1);
  }

  // ======================================
  // TEST 1: Keywords Column
  // ======================================
  console.log('\n📋 Test 1: Keywords Column');
  
  if (updated.business_profile?.keywords) {
    if (Array.isArray(updated.business_profile.keywords)) {
      console.log('   ✅ Keywords saved as array');
      console.log(`   Keywords: ${updated.business_profile.keywords.join(', ')}`);
      results.passed.push('Keywords array type');
    } else {
      console.log('   ⚠️ Keywords exists but not an array');
      results.warnings.push('Keywords type mismatch');
    }
    results.passed.push('Keywords column');
  } else {
    console.log('   ❌ Keywords not saved (expected in business_profile.keywords)');
    results.failed.push('Keywords column');
  }

  // ======================================
  // TEST 2: Tone of Voice Table
  // ======================================
  console.log('\n🎨 Test 2: Tone of Voice Table');
  
  if (updated.business_brand_profile?.tone_of_voice) {
    console.log('   ✅ Tone saved to business_brand_profile table');
    console.log(`   Tone: ${updated.business_brand_profile.tone_of_voice}`);
    results.passed.push('Tone table location');
  } else {
    console.log('   ❌ Tone not saved (expected in business_brand_profile.tone_of_voice)');
    results.failed.push('Tone table location');
  }

  // Check it's NOT in wrong location
  if (updated.business_profile?.brand_tone) {
    console.log('   ⚠️ WARNING: Tone also found in business_profile.brand_tone (wrong table)');
    results.warnings.push('Tone in wrong table');
  }

  // ======================================
  // TEST 3: Key Offerings Format
  // ======================================
  console.log('\n🔑 Test 3: Key Offerings Format');
  
  if (updated.business_profile?.key_offerings) {
    const offerings = updated.business_profile.key_offerings;
    
    if (typeof offerings === 'string') {
      console.log('   ✅ Key offerings saved as TEXT');
      
      if (offerings.includes('\n')) {
        console.log('   ✅ Newline-separated format confirmed');
        const count = offerings.split('\n').length;
        console.log(`   Found ${count} offerings`);
        results.passed.push('Key offerings format');
      } else {
        console.log('   ⚠️ TEXT format but no newlines (might be single offering)');
        results.warnings.push('Key offerings no newlines');
      }
    } else {
      console.log('   ❌ Key offerings not TEXT format');
      results.failed.push('Key offerings type');
    }
  } else {
    console.log('   ⚠️ Key offerings not populated');
    results.warnings.push('Key offerings missing');
  }

  // ======================================
  // TEST 4: Cached Path Behavior
  // ======================================
  console.log('\n💾 Test 4: Cached Path Behavior');
  
  if (functionData?.cached) {
    console.log('   ✅ Used cached scrape');
    
    if (functionData.ai_analysis) {
      console.log('   ✅ AI analysis present in cached response');
      results.passed.push('Cached AI analysis');
    } else {
      console.log('   ❌ AI analysis missing from cached response');
      results.failed.push('Cached AI analysis');
    }

    if (functionData.distribution_summary) {
      console.log('   ✅ Distribution summary present (confirms aiResult passed)');
      results.passed.push('Cached distribution');
    } else {
      console.log('   ⚠️ Distribution summary missing (might be old version)');
      results.warnings.push('Cached distribution summary');
    }
  } else {
    console.log('   ℹ️ Fresh scrape used (cached test skipped)');
    console.log('   Run again to test cached path');
  }

  // ======================================
  // TEST 5: Error Handling
  // ======================================
  console.log('\n🛡️ Test 5: Error Handling');
  
  // This would require access to function logs
  // Manual check: Look at Supabase logs for error messages
  console.log('   ℹ️ Check Supabase function logs for:');
  console.log('   - "✓ AI data stored: ..." messages');
  console.log('   - "✗ Profile update error: ..." if any failures');
  console.log('   - No silent failures');

  // ======================================
  // FINAL SUMMARY
  // ======================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Passed: ${results.passed.length}`);
  results.passed.forEach(test => console.log(`   - ${test}`));
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️ Warnings: ${results.warnings.length}`);
    results.warnings.forEach(test => console.log(`   - ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(test => console.log(`   - ${test}`));
  }

  console.log('\n' + '='.repeat(60));
  
  const allCriticalPassed = 
    results.passed.includes('Keywords column') &&
    results.passed.includes('Tone table location') &&
    results.passed.includes('Key offerings format');

  if (allCriticalPassed && results.failed.length === 0) {
    console.log('✅ ALL CRITICAL FIXES VALIDATED');
    console.log('Schema alignment is working correctly');
    return 0;
  } else if (results.failed.length === 0) {
    console.log('⚠️ PARTIALLY VALIDATED');
    console.log('Some warnings but no critical failures');
    return 0;
  } else {
    console.log('❌ VALIDATION FAILED');
    console.log('Critical fixes not working as expected');
    return 1;
  }
}

// ======================================
// CLI Execution
// ======================================
const businessId = process.argv[2];

if (!businessId) {
  console.error('Usage: node _TEST_SCHEMA_ALIGNMENT_VALIDATION.mjs <business_id>');
  console.error('');
  console.error('To find a test business:');
  console.error('  SELECT id, name, website_url FROM businesses');
  console.error('  WHERE website_url IS NOT NULL LIMIT 5;');
  process.exit(1);
}

testSchemaAlignment(businessId)
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });
