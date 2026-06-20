const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';
const WEEK_24 = 24;

console.log('🧪 Testing Phase 2 Week 1 with FORCED regeneration\n');
console.log('═'.repeat(60));

const forbiddenPhrases = [
  "hygge", "hyggelig", "hyggelige", "lokal perle", "socialt samvær",
  "fristed", "oase", "trækker folk ind", "oplagt valg", "i læ for vejret"
];

console.log('\n📊 Forcing week 24 regeneration with new code...\n');

const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({
    business_id: CAFE_FAUST_ID,
    week_number: WEEK_24,
    force_regenerate: true  // Force regeneration
  }),
});

if (!response.ok) {
  const error = await response.text();
  console.error(`❌ Failed:`, error);
  process.exit(1);
}

const result = await response.json();

if (!result.success) {
  console.error('❌ Generation failed:', result.error);
  process.exit(1);
}

console.log('✅ Strategy generated\n');

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

console.log('📊 Checking for forbidden phrases...\n');

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
    console.log(`❌ ${fieldName}: ${violations.join(', ')}`);
    console.log(`   "${text.substring(0, 80)}..."`);
    foundViolations = true;
  } else {
    console.log(`✅ ${fieldName}: Clean`);
  }
}

console.log('\n' + '═'.repeat(60));

if (foundViolations) {
  console.log('❌ TEST FAILED: Forbidden phrases still appear\n');
  process.exit(1);
} else {
  console.log('✅ TEST PASSED: All forbidden phrases removed\n');
  process.exit(0);
}
