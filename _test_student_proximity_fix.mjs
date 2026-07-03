/**
 * Test script to verify student proximity fix
 * 
 * This script:
 * 1. Checks current location intelligence for restaurantvaldemar
 * 2. Clears the cached data
 * 3. Triggers re-analysis with new proximity logic
 * 4. Verifies students are no longer in primary unless within 600m of campus
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env and .env.local files
function loadEnv(filename) {
  try {
    const envContent = readFileSync(filename, 'utf-8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    });
    return envVars;
  } catch (e) {
    return {};
  }
}

const envLocal = loadEnv('.env.local');
const env = loadEnv('.env');
const allEnv = { ...env, ...envLocal };

const supabaseUrl = allEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = allEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('\n🔍 Testing student proximity fix for restaurantvaldemar...\n');

  // 1. Use provided business ID
  const businessId = '1a285371-64f7-4def-b248-2e8cdfbba106';
  
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', businessId)
    .single();

  if (bizError || !business) {
    console.error('❌ Could not find business:', bizError);
    return;
  }

  console.log(`✅ Found business: ${business.name} (${businessId})\n`);

  // 2. Check current location intelligence
  const { data: currentIntel } = await supabase
    .from('business_location_intelligence')
    .select('*')
    .eq('business_id', business.id)
    .single();

  if (currentIntel) {
    console.log('📊 CURRENT state:');
    console.log('   category_scores:', JSON.stringify(currentIntel.category_scores, null, 2));
    console.log('   who.primary:', currentIntel.who?.primary || []);
    console.log('   who.secondary:', currentIntel.who?.secondary || []);
    console.log('   analyzed_at:', currentIntel.analyzed_at);
    
    if (currentIntel.who?.primary?.includes('student')) {
      console.log('   ⚠️  Students are currently PRIMARY\n');
    } else if (currentIntel.who?.secondary?.includes('student')) {
      console.log('   ℹ️  Students are currently SECONDARY\n');
    } else {
      console.log('   ✅ Students are NOT in audience\n');
    }
  }

  // 3. Clear location intelligence to force re-analysis
  console.log('🗑️  Clearing cached location intelligence...');
  const { error: deleteError } = await supabase
    .from('business_location_intelligence')
    .delete()
    .eq('business_id', business.id);

  if (deleteError) {
    console.error('❌ Error clearing cache:', deleteError);
    return;
  }

  console.log('✅ Cache cleared\n');

  // 4. Trigger re-analysis by calling the edge function
  console.log('🔄 Triggering location intelligence re-analysis...');
  console.log('   (This may take 10-30 seconds)\n');

  const functionUrl = `${supabaseUrl}/functions/v1/populate-location-intelligence`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      business_id: business.id,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Error calling function:', response.status, errorText);
    return;
  }

  const result = await response.json();
  console.log('✅ Analysis complete!\n');

  // 5. Fetch updated intelligence
  const { data: newIntel } = await supabase
    .from('business_location_intelligence')
    .select('*')
    .eq('business_id', business.id)
    .single();

  if (!newIntel) {
    console.error('❌ No intelligence data found after re-analysis');
    return;
  }

  console.log('📊 NEW state after fix:');
  console.log('   category_scores:', JSON.stringify(newIntel.category_scores, null, 2));
  console.log('   who.primary:', newIntel.who?.primary || []);
  console.log('   who.secondary:', newIntel.who?.secondary || []);
  
  // 6. Verify the fix
  const universityScore = newIntel.category_scores?.university_campus || 0;
  const hasStudentsPrimary = newIntel.who?.primary?.includes('student');
  const hasStudentsSecondary = newIntel.who?.secondary?.includes('student');

  console.log('\n═══════════════════════════════════════');
  console.log('VERIFICATION RESULTS');
  console.log('═══════════════════════════════════════');
  console.log(`university_campus score: ${universityScore}`);
  console.log(`Students in primary: ${hasStudentsPrimary ? '❌ YES (unexpected)' : '✅ NO'}`);
  console.log(`Students in secondary: ${hasStudentsSecondary ? 'ℹ️  YES' : '✅ NO'}`);

  if (universityScore < 60) {
    console.log('\n✅ SUCCESS: university_campus score is low (<60)');
    if (!hasStudentsPrimary) {
      console.log('✅ SUCCESS: Students are NOT in primary audience');
      console.log('\n🎉 Fix verified! Students now require actual campus proximity (<600m)');
    } else {
      console.log('⚠️  WARNING: Students still in primary despite low campus score');
    }
  } else {
    console.log(`\n⚠️  Note: university_campus score is ${universityScore} (≥60)`);
    console.log('   This suggests a university IS within 600m');
    if (hasStudentsPrimary) {
      console.log('   Students are correctly in primary (campus nearby)');
    }
  }
  console.log('═══════════════════════════════════════\n');
}

main().catch(console.error);
