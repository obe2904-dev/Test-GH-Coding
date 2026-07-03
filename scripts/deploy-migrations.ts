// Check migration status and provide deployment instructions
// Run: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/deploy-migrations.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Checking database migration status...\n');

// Check if table exists
console.log('1️⃣  Checking business_programme_profiles table...');
const { error: tableCheckError } = await supabase
  .from('business_programme_profiles')
  .select('id')
  .limit(1);

if (!tableCheckError) {
  console.log('   ✅ Table exists');
} else if (tableCheckError.code === 'PGRST116' || tableCheckError.code === '42P01') {
  console.log('   ❌ Table does NOT exist - migration needed');
} else {
  console.log('   ⚠️  Cannot verify:', tableCheckError.message);
}

// Check if column exists
console.log('\n2️⃣  Checking positioning column...');
const { error: columnCheckError } = await supabase
  .from('business_brand_profile')
  .select('positioning')
  .limit(1);

if (!columnCheckError) {
  console.log('   ✅ Column exists');
} else if (columnCheckError.message?.includes('column') && columnCheckError.message?.includes('does not exist')) {
  console.log('   ❌ Column does NOT exist - migration needed');
} else {
  console.log('   ⚠️  Cannot verify:', columnCheckError.message);
}

console.log('\n' + '='.repeat(70));
console.log('\n📋 DEPLOYMENT INSTRUCTIONS:\n');
console.log('The Supabase client cannot execute DDL (CREATE TABLE, ALTER TABLE) directly.');
console.log('Please deploy migrations using one of these methods:\n');

console.log('METHOD 1: Supabase Dashboard SQL Editor (RECOMMENDED)');
console.log('─'.repeat(70));
console.log('1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn');
console.log('2. Click "SQL Editor" in the left sidebar');
console.log('3. Click "New query"');
console.log('4. Copy SQL from: supabase/migrations/20260506_create_business_programme_profiles.sql');
console.log('5. Paste and click "Run"');
console.log('6. Repeat for: supabase/migrations/20260506_add_positioning_column.sql\n');

console.log('METHOD 2: psql Command Line');
console.log('─'.repeat(70));
console.log('Get your database password from Supabase Dashboard:');
console.log('  Settings → Database → Database Settings → Password\n');
console.log('Then run:');
console.log('  psql "postgresql://postgres.kvqdkohdpvmdylqgujpn:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \\');
console.log('    -f supabase/migrations/20260506_create_business_programme_profiles.sql\n');
console.log('  psql "postgresql://postgres.kvqdkohdpvmdylqgujpn:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \\');
console.log('    -f supabase/migrations/20260506_add_positioning_column.sql\n');

console.log('METHOD 3: Read Full Guide');
console.log('─'.repeat(70));
console.log('See: DATABASE-MIGRATION-DEPLOYMENT-GUIDE.md\n');

console.log('='.repeat(70));
console.log('\n✅ After deployment, run this script again to verify.');

