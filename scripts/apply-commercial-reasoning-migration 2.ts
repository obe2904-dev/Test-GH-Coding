/**
 * Apply commercial_reasoning column migration to production database
 * Run with: deno run --allow-net --allow-env --env-file=.env scripts/apply-commercial-reasoning-migration.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log('🔧 Applying commercial_reasoning migration...\n');

try {
  // Execute the migration SQL directly
  console.log('Adding commercial_reasoning column...');
  
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE business_programme_profiles
      ADD COLUMN IF NOT EXISTS commercial_reasoning text;
      
      COMMENT ON COLUMN business_programme_profiles.commercial_reasoning IS 
      'Layer 2: AI explanation of why this baseline commercial strategy was chosen (2-3 sentences in Danish)';
    `
  });

  if (error) {
    console.error('❌ Migration failed:', error);
    Deno.exit(1);
  }

  console.log('✅ Migration complete!');
  console.log('\n📋 Next steps:');
  console.log('   1. Deploy Edge Function: supabase functions deploy brand-profile-generator-v5');
  console.log('   2. Regenerate brand profile to populate reasoning field');
} catch (err) {
  console.error('❌ Unexpected error:', err);
  Deno.exit(1);
}


