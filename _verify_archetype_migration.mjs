#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Read .env file
const envContent = await Deno.readTextFile('.env');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, ''); // Remove quotes
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 VERIFYING BUSINESS ARCHETYPE MIGRATION\n');
console.log('=' .repeat(60));

// Check 1: Verify column exists by querying it
console.log('\n📋 CHECK 1: Column Existence');
console.log('-'.repeat(60));

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a';

const { data: columnCheck, error: columnError } = await supabase
  .from('business_brand_profile')
  .select('business_id, business_character, business_archetype')
  .eq('business_id', businessId)
  .maybeSingle();

if (columnError) {
  if (columnError.message.includes('business_archetype')) {
    console.log('❌ COLUMN NOT FOUND: business_archetype does not exist');
    console.log('   Error:', columnError.message);
  } else {
    console.log('❌ Query error:', columnError.message);
  }
} else {
  console.log('✅ Column EXISTS: business_archetype can be queried');
  console.log('   Current value for Cafe Faust:', columnCheck?.business_archetype || 'NULL');
  console.log('   business_character:', columnCheck?.business_character?.substring(0, 60) + '...' || 'NULL');
}

// Check 2: Verify ENUM type and values using raw SQL
console.log('\n🏷️  CHECK 2: ENUM Type and Values');
console.log('-'.repeat(60));

const { data: enumCheck, error: enumError } = await supabase.rpc('exec_sql', {
  query: `
    SELECT 
      t.typname as enum_name,
      e.enumlabel as enum_value
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'business_archetype_enum'
    ORDER BY e.enumsortorder;
  `
});

if (enumError) {
  console.log('❌ ENUM TYPE NOT FOUND or query failed');
  console.log('   Error:', enumError.message);
} else if (!enumCheck || enumCheck.length === 0) {
  console.log('❌ ENUM TYPE NOT FOUND: business_archetype_enum does not exist');
} else {
  console.log('✅ ENUM TYPE EXISTS: business_archetype_enum');
  console.log(`   Found ${enumCheck.length} enum values:`);
  
  const expectedValues = [
    'fine_dining', 'casual_dining', 'cafe_bistro', 'cafe_bar', 
    'wine_bar', 'coffee_shop', 'quick_service', 'bakery',
    'morning_cafe', 'brunch_cafe', 'all_day_cafe',
    'lunch_restaurant', 'dinner_restaurant', 'full_service_restaurant',
    'evening_bar', 'late_night_bar', 'nightlife_bar',
    'brunch_specialist', 'fast_casual'
  ];
  
  const actualValues = enumCheck.map(row => row.enum_value);
  
  // Display in columns
  console.log('\n   Expected (19 values):');
  for (let i = 0; i < expectedValues.length; i += 3) {
    const row = expectedValues.slice(i, i + 3);
    console.log('   ' + row.map(v => v.padEnd(25)).join(''));
  }
  
  console.log('\n   Actual values in database:');
  for (let i = 0; i < actualValues.length; i += 3) {
    const row = actualValues.slice(i, i + 3);
    console.log('   ' + row.map(v => v.padEnd(25)).join(''));
  }
  
  // Check if all expected values are present
  const missing = expectedValues.filter(v => !actualValues.includes(v));
  const extra = actualValues.filter(v => !expectedValues.includes(v));
  
  if (missing.length === 0 && extra.length === 0) {
    console.log('\n   ✅ All 19 expected values present and correct');
  } else {
    if (missing.length > 0) {
      console.log('\n   ⚠️  Missing values:', missing.join(', '));
    }
    if (extra.length > 0) {
      console.log('   ⚠️  Extra values:', extra.join(', '));
    }
  }
}

// Check 3: Verify index exists
console.log('\n📊 CHECK 3: Index');
console.log('-'.repeat(60));

const { data: indexCheck, error: indexError } = await supabase.rpc('exec_sql', {
  query: `
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'business_brand_profile'
      AND indexname = 'idx_brand_profile_archetype';
  `
});

if (indexError) {
  console.log('❌ Index check failed');
  console.log('   Error:', indexError.message);
} else if (!indexCheck || indexCheck.length === 0) {
  console.log('⚠️  INDEX NOT FOUND: idx_brand_profile_archetype');
  console.log('   (This is optional for functionality but recommended for performance)');
} else {
  console.log('✅ INDEX EXISTS: idx_brand_profile_archetype');
  console.log('   Definition:', indexCheck[0].indexdef);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📝 MIGRATION VERIFICATION SUMMARY');
console.log('='.repeat(60));

const checks = [
  { name: 'Column exists', passed: !columnError },
  { name: 'ENUM type exists', passed: !enumError && enumCheck && enumCheck.length > 0 },
  { name: 'All 19 values present', passed: !enumError && enumCheck && enumCheck.length === 19 },
  { name: 'Index exists', passed: !indexError && indexCheck && indexCheck.length > 0 }
];

checks.forEach(check => {
  const status = check.passed ? '✅' : '❌';
  console.log(`${status} ${check.name}`);
});

const allPassed = checks.every(c => c.passed);

if (allPassed) {
  console.log('\n🎉 MIGRATION FULLY APPLIED - All checks passed!');
  console.log('\nNext steps:');
  console.log('  1. Regenerate Cafe Faust brand profile');
  console.log('  2. Check for archetype inference in logs');
  console.log('  3. Verify archetype saved to database');
  console.log('  4. Generate weekly plan and verify usage');
} else {
  console.log('\n⚠️  MIGRATION INCOMPLETE - Some checks failed');
  console.log('\nAction required:');
  console.log('  Run: supabase db push');
  console.log('  Or apply migration manually in Supabase Dashboard');
}

console.log('\n');
