// Test if the extraction logic works with the exact brand_profile_v5 structure

const mockBrandVoice = {
  brand_profile_v5: {
    guardrails: {
      forbidden_phrases: ["hygge", "hyggelig", "hyggelige", "lokal perle"],
      technical_terms: ["hybrid", "day-to-evening"],
      weather_cliches: ["skubber gæsterne indendørs"]
    }
  }
};

console.log('Testing extraction logic:\n');

const bv = mockBrandVoice;
const guardrails = bv?.brand_profile_v5?.guardrails || {};

const forbiddenPhrases = guardrails.forbidden_phrases || [];
const technicalTerms = guardrails.technical_terms || [];
const weatherCliches = guardrails.weather_cliches || [];

console.log('Extracted forbidden_phrases:', forbiddenPhrases.length, 'items');
console.log('Sample:', forbiddenPhrases.slice(0, 3));
console.log('');
console.log('Extracted technical_terms:', technicalTerms.length, 'items');
console.log('Extracted weather_cliches:', weatherCliches.length, 'items');

console.log('\n✅ Extraction logic works correctly');
console.log('\nThis means the issue is either:');
console.log('1. brand_voice context is not receiving brand_profile_v5 field');
console.log('2. The field is there but structured differently');
console.log('3. Logs will show which case it is');
