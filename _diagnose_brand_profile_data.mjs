/**
 * Diagnostic script to check Brand Profile V5 data availability
 * Run: node _diagnose_brand_profile_data.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here';

const supabase = createClient(supabaseUrl, supabaseKey);

const BUSINESS_ID = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4'; // Café Faust

async function diagnose() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🔍 BRAND PROFILE V5 DATA DIAGNOSTIC');
  console.log('Business ID:', BUSINESS_ID);
  console.log('═══════════════════════════════════════════════════\n');

  // Test 1: Check business_programme_profiles table
  console.log('📊 TEST 1: Query business_programme_profiles');
  console.log('─────────────────────────────────────────────────');
  const { data: programmes, error: progError } = await supabase
    .from('business_programme_profiles')
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .order('programme_type');

  if (progError) {
    console.error('❌ Error querying programmes:', progError.message);
    console.error('   Code:', progError.code);
    console.error('   Details:', progError.details);
    console.error('   Hint:', progError.hint);
  } else {
    console.log(`✅ Found ${programmes?.length || 0} programme(s)`);
    if (programmes && programmes.length > 0) {
      programmes.forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.programme_name} (${p.programme_type})`);
        console.log(`      - Confidence: ${p.confidence}%`);
        console.log(`      - Time windows: ${p.time_windows?.length || 0}`);
        console.log(`      - Segments: ${p.audience_segments?.length || 0}`);
        console.log(`      - Created: ${new Date(p.created_at).toLocaleString()}`);
      });
    } else {
      console.log('   ⚠️  No programmes found in database');
    }
  }

  // Test 2: Check business_brand_profile table (brand_profile_v5 JSONB)
  console.log('\n\n📊 TEST 2: Query business_brand_profile (V5 JSONB)');
  console.log('─────────────────────────────────────────────────');
  const { data: brandProfile, error: brandError } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5, created_at, updated_at')
    .eq('business_id', BUSINESS_ID)
    .maybeSingle();

  if (brandError) {
    console.error('❌ Error querying brand profile:', brandError.message);
  } else if (!brandProfile) {
    console.log('❌ No brand profile found');
  } else {
    console.log('✅ Brand profile found');
    console.log(`   - Updated: ${new Date(brandProfile.updated_at).toLocaleString()}`);
    
    if (brandProfile.brand_profile_v5) {
      const v5 = brandProfile.brand_profile_v5;
      console.log('\n   📦 V5 Profile Structure:');
      console.log(`      - Programme profiles: ${v5.programme_profiles?.length || 0}`);
      console.log(`      - Voice profile: ${v5.voice_profile ? '✓' : '✗'}`);
      console.log(`      - Tone DNA: ${v5.tone_dna ? '✓' : '✗'}`);
      console.log(`      - Writing examples: ${v5.writing_examples?.menu_descriptions?.length || 0} menu + ${v5.writing_examples?.social_examples?.length || 0} social`);
      console.log(`      - Guardrails: ${v5.guardrails ? '✓' : '✗'}`);

      if (v5.programme_profiles && v5.programme_profiles.length > 0) {
        console.log('\n   📋 Programmes in V5 JSONB:');
        v5.programme_profiles.forEach((p, i) => {
          console.log(`      ${i + 1}. ${p.programme_name} (${p.programme_type})`);
          console.log(`         - Segments: ${p.audience_segments?.length || 0}`);
        });
      }
    } else {
      console.log('   ⚠️  brand_profile_v5 field is NULL');
    }
  }

  // Test 3: Check RLS policies
  console.log('\n\n📊 TEST 3: Check RLS Policies');
  console.log('─────────────────────────────────────────────────');
  const { data: policies, error: policyError } = await supabase
    .rpc('exec_sql', { 
      sql: `
        SELECT 
          policyname,
          permissive,
          roles::text,
          cmd,
          qual
        FROM pg_policies
        WHERE tablename = 'business_programme_profiles'
        ORDER BY policyname;
      `
    })
    .catch(() => ({
      data: null,
      error: { message: 'RPC not available - requires database function' }
    }));

  if (policyError) {
    console.log('   ⚠️  Could not check RLS policies (requires admin access)');
  } else if (policies && policies.length > 0) {
    console.log(`   ✅ Found ${policies.length} RLS policy/policies`);
    policies.forEach(p => {
      console.log(`      - ${p.policyname}`);
    });
  } else {
    console.log('   ⚠️  No RLS policies found (or table has RLS disabled)');
  }

  // Test 4: Verify user can access their own business
  console.log('\n\n📊 TEST 4: Verify Business Ownership');
  console.log('─────────────────────────────────────────────────');
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.log('   ❌ Not authenticated or error getting user');
  } else if (!user) {
    console.log('   ❌ No authenticated user');
  } else {
    console.log(`   ✅ Authenticated as: ${user.email}`);
    
    // Check business ownership
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, owner_id')
      .eq('id', BUSINESS_ID)
      .single();
    
    if (bizError) {
      console.error('   ❌ Error querying business:', bizError.message);
    } else if (!business) {
      console.log('   ❌ Business not found or no access');
    } else {
      console.log(`   ✅ Business found: ${business.name}`);
      console.log(`   ${business.owner_id === user.id ? '✅' : '❌'} User owns this business`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Diagnostic complete');
  console.log('═══════════════════════════════════════════════════\n');
}

diagnose().catch(console.error);
