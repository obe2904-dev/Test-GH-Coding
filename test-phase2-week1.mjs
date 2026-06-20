/**
 * Test Phase 2 Week 1: Forbidden Phrases Migration
 */

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';
const WEEK_24 = 24;

const forbiddenPhrases = [
  "hygge", "hyggelig", "hyggelige", "lokal perle", "socialt samvær",
  "fristed", "oase", "trækker folk ind", "oplagt valg", "i læ for vejret"
];

console.log('🧪 Testing Phase 2 Week 1: Dynamic Forbidden Phrases\n');
console.log('═'.repeat(60));

async function runTest() {
  console.log('\n📊 Step 1: Checking brand profile guardrails...\n');
  
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/business_brand_profile?business_id=eq.${CAFE_FAUST_ID}&select=brand_profile_v5`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });
  
  const profileData = await profileResponse.json();
  const profile = profileData[0];
  
  if (!profile) {
    console.error('❌ No brand profile found');
    return false;
  }
  
  const guardrails = profile.brand_profile_v5?.guardrails || {};
  const forbiddenCount = guardrails.forbidden_phrases?.length || 0;
  const technicalCount = guardrails.technical_terms?.length || 0;
  const weatherCount = guardrails.weather_cliches?.length || 0;
  
  console.log(`  ✅ forbidden_phrases: ${forbiddenCount} items`);
  console.log(`  ✅ technical_terms: ${technicalCount} items`);
  console.log(`  ✅ weather_cliches: ${weatherCount} items`);
  
  if (forbiddenCount === 0) {
    console.error('  ❌ No forbidden phrases in profile!');
    return false;
  }
  
  console.log('\n📊 Step 2: Calling get-weekly-strategy for week 24...\n');
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      business_id: CAFE_FAUST_ID,
      week_number: WEEK_24,
      force_regenerate: false
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`  ❌ Failed:`, error);
    return false;
  }
  
  const result = await response.json();
  
  if (!result.success) {
    console.error('  ❌ Generation failed:', result.error);
    return false;
  }
  
  console.log('  ✅ Strategy generated successfully');
  
  console.log('\n📊 Step 3: Checking output for forbidden phrases...\n');
  
  const strategy = result.strategy || {};
  const narrative = strategy.narrative || {};
  
  const fieldsToCheck = {
    'Headline': narrative.headline,
    'Overview': narrative.overview,
    'Weather/Season': narrative.weather_season,
    'Timing Context': narrative.timing_context,
    'Business Advantage': narrative.business_advantage,
  };
  
  let foundViolations = false;
  
  for (const [fieldName, fieldValue] of Object.entries(fieldsToCheck)) {
    if (!fieldValue) continue;
    
    const text = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
    const violations = [];
    
    for (const phrase of forbiddenPhrases) {
      if (text.toLowerCase().includes(phrase.toLowerCase())) {
        violations.push(phrase);
      }
    }
    
    if (violations.length > 0) {
      console.log(`  ❌ ${fieldName}: ${violations.join(', ')}`);
      console.log(`     "${text.substring(0, 80)}..."`);
      foundViolations = true;
    } else {
      console.log(`  ✅ ${fieldName}: No forbidden phrases`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  
  if (foundViolations) {
    console.log('❌ TEST FAILED\n');
    return false;
  } else {
    console.log('✅ TEST PASSED\n');
    console.log('Next steps:');
    console.log('1. Monitor production for 24h');
    console.log('2. Proceed to Phase 2 Week 2 (creativity dials)\n');
    return true;
  }
}

const success = await runTest();
process.exit(success ? 0 : 1);
