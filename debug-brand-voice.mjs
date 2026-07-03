const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';

console.log('🔍 Debugging brand_voice structure\n');

const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/business_brand_profile?business_id=eq.${CAFE_FAUST_ID}&select=brand_profile_v5`, {
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
  }
});

const profileData = await profileResponse.json();
const brandProfile = profileData[0];

console.log('brand_profile_v5 keys:', Object.keys(brandProfile.brand_profile_v5 || {}));
console.log('\nguardrails keys:', Object.keys(brandProfile.brand_profile_v5?.guardrails || {}));
console.log('\nforbidden_phrases:', brandProfile.brand_profile_v5?.guardrails?.forbidden_phrases);
console.log('\nPath test: bv.brand_profile_v5.guardrails.forbidden_phrases');
const bv = { brand_profile_v5: brandProfile.brand_profile_v5 };
const guardrails = bv?.brand_profile_v5?.guardrails || {};
console.log('Extracted guardrails:', guardrails);
console.log('Forbidden phrases:', guardrails.forbidden_phrases);
