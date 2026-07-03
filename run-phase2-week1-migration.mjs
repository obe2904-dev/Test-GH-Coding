/**
 * Phase 2 Week 1: Run Forbidden Phrases Migration
 * 
 * This script migrates hardcoded forbidden phrases from prompts to brand profiles.
 * Each business can then customize their own tone restrictions.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Phase 2 Week 1: Forbidden Phrases Migration\n');
console.log('═══════════════════════════════════════════════\n');

// Step 1: Check current state
console.log('📊 Step 1: Checking current brand profiles...\n');

const { data: profilesBefore, error: beforeError } = await supabase
  .from('business_brand_profile')
  .select('business_id, brand_profile_v5')
  .not('brand_profile_v5', 'is', null);

if (beforeError) {
  console.error('❌ Error fetching profiles:', beforeError);
  process.exit(1);
}

console.log(`Found ${profilesBefore.length} brand profiles with v5 data\n`);

const profilesWithNeverSay = profilesBefore.filter(p => 
  p.brand_profile_v5?.guardrails?.never_say?.length > 0
);

console.log(`Currently ${profilesWithNeverSay.length} have never_say configured\n`);

// Step 2: Run migration
console.log('🔄 Step 2: Running migration...\n');

// Update 1: Add hardcoded forbidden phrases as new dedicated field
console.log('  Adding forbidden_phrases (from hardcoded FORBUDTE VENDINGER)...');

const hardcodedForbiddenPhrases = [
  "hygge", "hyggelig", "hyggelige", "hyggefølelse", "hyggepause", "hyggelig stemning",
  "hyggelige rammer", "den perfekte ramme", "indbydende atmosfære", "autentisk oplevelse",
  "lokal perle", "socialt samvær", "fristed", "fristed fra vejret", "oase", "indendørs oase",
  "trækker folk ind", "foråret er på vej", "folk vil forkæle sig selv", "forkælelse", "giv dig selv lov",
  "noget for enhver", "noget for alle", "tag chancen", "friske sæsoningredienser",
  "i læ for vejret", "i ly for vejret", "oplagt valg", "er et oplagt valg", "oplagt udflugtsmål", "oplagt destination"
];

const updates1 = [];
for (const profile of profilesBefore) {
  const updated = {
    ...profile.brand_profile_v5,
    guardrails: {
      ...profile.brand_profile_v5.guardrails,
      forbidden_phrases: hardcodedForbiddenPhrases
    }
  };
  
  updates1.push({ business_id: profile.business_id, data: updated });
}

for (const update of updates1) {
  const { error } = await supabase
    .from('business_brand_profile')
    .update({ brand_profile_v5: update.data })
    .eq('business_id', update.business_id);
  
  if (error) {
    console.error(`  ❌ Failed to update ${update.business_id}:`, error);
  }
}

console.log(`  ✅ Updated ${updates1.length} profiles with forbidden_phrases`);

// Update 2: Add technical terms
console.log('\n  Adding technical_terms...');
const updates2 = [];
for (const profile of profilesBefore) {
  if (!profile.brand_profile_v5?.guardrails?.technical_terms) {
    const updated = {
      ...profile.brand_profile_v5,
      guardrails: {
        ...profile.brand_profile_v5.guardrails,
        technical_terms: [
          "hybrid", "hybridformat", "hybridmodel", "day-to-evening", "day-to-evening format", 
          "treat", "discovery", "driftsmodel", "besøgstype", "serviceforløb", "visit_mode", "business_mode"
        ]
      }
    };
    updates2.push({ business_id: profile.business_id, data: updated });
  }
}

for (const update of updates2) {
  const { error } = await supabase
    .from('business_brand_profile')
    .update({ brand_profile_v5: update.data })
    .eq('business_id', update.business_id);
  
  if (error) {
    console.error(`  ❌ Failed to update ${update.business_id}:`, error);
  }
}
console.log(`  ✅ Updated ${updates2.length} profiles with technical_terms`);

// Update 3: Add weather clichés
console.log('\n  Adding weather_cliches...');
const updates3 = [];
for (const profile of profilesBefore) {
  if (!profile.brand_profile_v5?.guardrails?.weather_cliches) {
    const updated = {
      ...profile.brand_profile_v5,
      guardrails: {
        ...profile.brand_profile_v5.guardrails,
        weather_cliches: [
          "skubber gæsterne indendørs", "skubber indendørs", "trækker gæsterne indendørs", "trækker indendørs",
          "vejret gør stedet attraktivt", "vejret indbyder", "søger indendørs alternativer",
          "det kolde vejr indbyder til", "i læ for vejret", "i ly for vejret"
        ]
      }
    };
    updates3.push({ business_id: profile.business_id, data: updated });
  }
}

for (const update of updates3) {
  const { error } = await supabase
    .from('business_brand_profile')
    .update({ brand_profile_v5: update.data })
    .eq('business_id', update.business_id);
  
  if (error) {
    console.error(`  ❌ Failed to update ${update.business_id}:`, error);
  }
}
console.log(`  ✅ Updated ${updates3.length} profiles with weather_cliches`);

// Step 3: Verify
console.log('\n📊 Step 3: Verifying migration...\n');

const { data: profilesAfter, error: afterError } = await supabase
  .from('business_brand_profile')
  .select('business_id, brand_profile_v5')
  .not('brand_profile_v5', 'is', null);

if (afterError) {
  console.error('❌ Error fetching updated profiles:', afterError);
  process.exit(1);
}

const withForbidden = profilesAfter.filter(p => p.brand_profile_v5?.guardrails?.forbidden_phrases?.length > 0);
const withTechnical = profilesAfter.filter(p => p.brand_profile_v5?.guardrails?.technical_terms?.length > 0);
const withWeather = profilesAfter.filter(p => p.brand_profile_v5?.guardrails?.weather_cliches?.length > 0);

console.log(`  forbidden_phrases: ${withForbidden.length}/${profilesAfter.length} profiles`);
console.log(`  technical_terms: ${withTechnical.length}/${profilesAfter.length} profiles`);
console.log(`  weather_cliches: ${withWeather.length}/${profilesAfter.length} profiles`);

// Step 4: Sample verification
console.log('\n📄 Step 4: Sample verification (Cafe Faust)...\n');

const { data: cafeFaust, error: faustError } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single();

if (faustError) {
  console.warn('⚠️  Cafe Faust not found or no profile');
} else if (cafeFaust) {
  const forbiddenPhrases = cafeFaust.brand_profile_v5?.guardrails?.forbidden_phrases || [];
  const weatherCliches = cafeFaust.brand_profile_v5?.guardrails?.weather_cliches || [];
  const technicalTerms = cafeFaust.brand_profile_v5?.guardrails?.technical_terms || [];
  
  console.log(`  forbidden_phrases count: ${forbiddenPhrases.length}`);
  console.log(`  Sample phrases: ${forbiddenPhrases.slice(0, 5).join(', ')}`);
  console.log(`  weather_cliches count: ${weatherCliches.length}`);
  console.log(`  technical_terms count: ${technicalTerms.length}`);
}

console.log('\n═══════════════════════════════════════════════');
console.log('✅ Migration complete!\n');
console.log('Next steps:');
console.log('1. Update phase2c.ts to use dynamic never_say');
console.log('2. Remove hardcoded FORBUDTE VENDINGER');
console.log('3. Test with get-weekly-strategy');
console.log('4. Deploy updated edge functions\n');
