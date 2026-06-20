/**
 * Quick migration: Add commercial_reasoning column
 * Run with: deno run --allow-net --allow-env --env-file=.env scripts/quick-add-column.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🔧 Adding commercial_reasoning column...\n');

// Use the REST API to execute raw SQL
const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `
      ALTER TABLE business_programme_profiles
      ADD COLUMN IF NOT EXISTS commercial_reasoning text;
    `
  })
});

if (!response.ok) {
  const error = await response.text();
  console.error('❌ Failed:', error);
  console.error('\n📋 Please run this SQL manually in Supabase Dashboard:');
  console.error('   https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new');
  console.error('\n   ALTER TABLE business_programme_profiles');
  console.error('   ADD COLUMN IF NOT EXISTS commercial_reasoning text;');
  Deno.exit(1);
}

console.log('✅ Column added successfully!');
console.log('\n🔄 Now regenerate the brand profile to populate the reasoning field.');
