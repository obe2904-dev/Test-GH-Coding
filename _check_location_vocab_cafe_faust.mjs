#!/usr/bin/env node
/**
 * Check Café Faust location natural vocabulary
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, brand_profile_v5')
  .eq('business_id', '561f8fe8-41cb-4191-87e4-5cabf9bcdd79')
  .single();

if (error) {
  console.error('❌ Query error:', error);
  Deno.exit(1);
}

console.log('\n📍 Café Faust Location Vocabulary:\n');
console.log('Business ID:', data.business_id);

const toneDNA = data.brand_profile_v5?.voice?.tone_dna;
if (!toneDNA) {
  console.log('❌ No tone_dna found');
  Deno.exit(1);
}

console.log('\n✅ Tone DNA found');

const locationDriver = toneDNA.location_driver;
if (!locationDriver) {
  console.log('❌ No location_driver found');
} else {
  console.log('\n📍 LOCATION DRIVER:');
  console.log('Primary Dimension:', locationDriver.primary_dimension || 'NULL');
  console.log('Score:', locationDriver.score || 'NULL');

  console.log('\n🔤 Natural Vocabulary:');
  if (locationDriver.natural_vocabulary && locationDriver.natural_vocabulary.length > 0) {
    locationDriver.natural_vocabulary.forEach((phrase, idx) => {
      console.log(`  ${idx + 1}. "${phrase}"`);
    });
    console.log(`\n✅ ${locationDriver.natural_vocabulary.length} phrases found`);
  } else {
    console.log('  ❌ NULL or empty array');
  }

  console.log('\n🚫 Avoid Vocabulary:');
  if (locationDriver.avoid_vocabulary && locationDriver.avoid_vocabulary.length > 0) {
    locationDriver.avoid_vocabulary.forEach((phrase, idx) => {
      console.log(`  ${idx + 1}. "${phrase}"`);
    });
  } else {
    console.log('  (none)');
  }
}

// Check humor_character
const humorCharacter = toneDNA.humor_character;
console.log('\n\n😄 HUMOR CHARACTER:');
if (!humorCharacter || humorCharacter.permission_level === 'none') {
  console.log('  Permission: none (no humor)');
} else {
  console.log('  Permission:', humorCharacter.permission_level);
  if (humorCharacter.execution_style) {
    console.log('  Style:', humorCharacter.execution_style);
  }
  if (humorCharacter.tone_descriptors && humorCharacter.tone_descriptors.length > 0) {
    console.log('  Descriptors:', humorCharacter.tone_descriptors.join(', '));
  }
  console.log('\n✅ Humor character generated');
}

console.log();
