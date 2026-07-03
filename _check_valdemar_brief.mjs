#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const envContent = await Deno.readTextFile('.env');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

const businessId = '07a5a2c7-4aa8-49b3-a125-6f687caf0f28';

console.log('🔍 CHECKING RESTAURANT VALDEMAR MARKETING BRIEF\n');
console.log('='.repeat(80));

const { data: profile } = await supabase
  .from('business_brand_profile')
  .select('marketing_manager_brief, voice_guardrails')
  .eq('business_id', businessId)
  .single();

if (!profile) {
  console.log('❌ No brand profile found');
  Deno.exit(1);
}

console.log('\n📋 MARKETING MANAGER BRIEF:\n');
console.log(profile.marketing_manager_brief);

console.log('\n\n🚫 VOICE GUARDRAILS (Forbidden Words):\n');
const guardrails = profile.voice_guardrails;

if (guardrails.never_say) {
  console.log('Never Say:', guardrails.never_say.join(', '));
}
if (guardrails.generic_marketing) {
  console.log('\nGeneric Marketing:', guardrails.generic_marketing.join(', '));
}
if (guardrails.superlatives) {
  console.log('\nSuperlatives:', guardrails.superlatives.join(', '));
}

console.log('\n\n🔍 CHECKING FOR VIOLATIONS IN BRIEF:\n');

const briefLower = profile.marketing_manager_brief.toLowerCase();
const violations = [];

// Check never_say
if (guardrails.never_say) {
  guardrails.never_say.forEach(word => {
    if (briefLower.includes(word.toLowerCase())) {
      violations.push(`❌ Uses forbidden word: "${word}"`);
    }
  });
}

// Check generic_marketing
if (guardrails.generic_marketing) {
  guardrails.generic_marketing.forEach(phrase => {
    if (briefLower.includes(phrase.toLowerCase())) {
      violations.push(`❌ Uses generic marketing: "${phrase}"`);
    }
  });
}

// Check superlatives
if (guardrails.superlatives) {
  guardrails.superlatives.forEach(word => {
    if (briefLower.includes(word.toLowerCase())) {
      violations.push(`❌ Uses superlative: "${word}"`);
    }
  });
}

if (violations.length > 0) {
  console.log('⚠️  FOUND VIOLATIONS:\n');
  violations.forEach(v => console.log(`   ${v}`));
  console.log(`\n   Total: ${violations.length} violations`);
} else {
  console.log('✅ NO VIOLATIONS FOUND - Brief is clean!');
}
