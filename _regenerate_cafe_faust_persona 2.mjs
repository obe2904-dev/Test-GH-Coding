#!/usr/bin/env node
/**
 * Regenerate Business Identity Persona for Café Faust
 * After prompt improvements to enforce VERBATIM segments and EVIDENCE requirements
 * 
 * Date: June 12, 2026
 */

import { readFileSync } from 'fs';

// Read .env manually
const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'; // Café Faust

console.log('🔄 Regenerating Business Identity Persona for Café Faust...\n');
console.log('📝 This will fix:');
console.log('   - Remove hallucinated "bæredygtighed" and "lokale råvarer" (no evidence)');
console.log('   - Ensure strategic segment labels match JSONB structure exactly');
console.log('   - Apply new VERBATIM SEGMENTS and EVIDENCE REQUIREMENT rules\n');

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/brand-profile-generator-v5`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      businessId: businessId,
      forceRegenerate: true
    })
  }
);

if (!response.ok) {
  const errorText = await response.text();
  console.error('❌ Error:', response.status, response.statusText);
  console.error('Details:', errorText);
  process.exit(1);
}

const result = await response.json();
console.log('✅ Brand profile regenerated successfully!\n');
console.log('📊 Result:', JSON.stringify(result, null, 2));

console.log('\n🎯 Next steps:');
console.log('   Run: node _verify_strategic_segments_fix.mjs');
console.log('   This will validate that the persona is now correct.\n');
