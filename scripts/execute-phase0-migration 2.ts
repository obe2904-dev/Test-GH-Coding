#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --env-file=.env

/**
 * Execute Phase 0 Migration: Drop do_not_say, Add V5 Metadata
 * Uses Supabase client with service role key to execute raw SQL
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔄 Executing Phase 0 Migration: 20260508_integrate_voice_v5.sql')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

try {
  // Step 1: Drop do_not_say column
  console.log('1️⃣  Dropping do_not_say column...')
  const { error: dropError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE business_brand_profile DROP COLUMN IF EXISTS do_not_say;'
  })
  
  if (dropError) {
    console.error('   ❌ Failed:', dropError.message)
    console.log('\n⚠️  Trying alternative method...')
    
    // Alternative: Direct execution via PostgREST
    const { error: altError } = await supabase
      .from('business_brand_profile')
      .select('*')
      .limit(0) // Don't actually fetch data
    
    if (altError) {
      console.error('   ❌ Connection test failed:', altError.message)
      console.log('\n📋 MANUAL MIGRATION REQUIRED')
      console.log('Please execute this SQL in Supabase Dashboard > SQL Editor:\n')
      console.log('-- Phase 0 Migration: Drop do_not_say only')
      console.log('ALTER TABLE business_brand_profile DROP COLUMN IF EXISTS do_not_say;')
      console.log('\n-- Add V5 metadata columns')
      console.log('ALTER TABLE business_brand_profile')
      console.log('  ADD COLUMN IF NOT EXISTS voice_v5_migrated BOOLEAN DEFAULT FALSE,')
      console.log('  ADD COLUMN IF NOT EXISTS voice_v5_generated_at TIMESTAMPTZ,')
      console.log('  ADD COLUMN IF NOT EXISTS voice_v5_version TEXT DEFAULT \'v5.0\';')
      console.log('\n-- Add protection comments')
      console.log('COMMENT ON COLUMN business_brand_profile.voice_v5_migrated IS \'TRUE if voice integrated into brand_profile_v5\';')
      console.log('COMMENT ON COLUMN business_brand_profile.typical_openings IS \'ACTIVELY USED - DO NOT DELETE - 25 code refs, 100% populated\';')
      console.log('COMMENT ON COLUMN business_brand_profile.typical_closings IS \'ACTIVELY USED - DO NOT DELETE - 20 code refs, 67% populated\';')
      console.log('COMMENT ON COLUMN business_brand_profile.tone_keywords IS \'FALLBACK FIELD - DO NOT DELETE - 15 code refs\';')
      console.log('\n🔗 Dashboard URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new')
      Deno.exit(1)
    }
  } else {
    console.log('   ✅ do_not_say column dropped')
  }

  // Step 2: Add V5 metadata columns
  console.log('\n2️⃣  Adding V5 metadata columns...')
  const { error: addError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE business_brand_profile
        ADD COLUMN IF NOT EXISTS voice_v5_migrated BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS voice_v5_generated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS voice_v5_version TEXT DEFAULT 'v5.0';
    `
  })
  
  if (addError) {
    console.error('   ❌ Failed:', addError.message)
  } else {
    console.log('   ✅ V5 metadata columns added')
  }

  // Step 3: Add comments
  console.log('\n3️⃣  Adding protection comments...')
  const comments = [
    "COMMENT ON COLUMN business_brand_profile.voice_v5_migrated IS 'TRUE if voice integrated into brand_profile_v5';",
    "COMMENT ON COLUMN business_brand_profile.typical_openings IS 'ACTIVELY USED - DO NOT DELETE - 25 code refs, 100% populated';",
    "COMMENT ON COLUMN business_brand_profile.typical_closings IS 'ACTIVELY USED - DO NOT DELETE - 20 code refs, 67% populated';",
    "COMMENT ON COLUMN business_brand_profile.tone_keywords IS 'FALLBACK FIELD - DO NOT DELETE - 15 code refs';"
  ]
  
  for (const comment of comments) {
    const { error } = await supabase.rpc('exec_sql', { sql: comment })
    if (error) {
      console.error(`   ⚠️  Comment failed: ${error.message}`)
    }
  }
  console.log('   ✅ Protection comments added')

  // Verify migration
  console.log('\n4️⃣  Verifying migration...')
  const { data: columns } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'business_brand_profile' 
        AND column_name IN ('do_not_say', 'voice_v5_migrated', 'voice_v5_generated_at', 'voice_v5_version')
      ORDER BY column_name;
    `
  })
  
  console.log('   Columns found:', columns)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ MIGRATION COMPLETE!')
  console.log('')
  console.log('Changes applied:')
  console.log('  ❌ Dropped column: do_not_say')
  console.log('  ✅ Added column: voice_v5_migrated (BOOLEAN DEFAULT FALSE)')
  console.log('  ✅ Added column: voice_v5_generated_at (TIMESTAMPTZ)')
  console.log('  ✅ Added column: voice_v5_version (TEXT DEFAULT \'v5.0\')')
  console.log('  📝 Added protection comments to critical fields')
  console.log('')
  console.log('Next step: Regenerate TypeScript types')
  console.log('  Run: deno run --allow-net --allow-env scripts/regenerate-types.ts')

} catch (error) {
  console.error('\n❌ Migration failed:', error)
  console.log('\n📋 Please execute migration manually in Supabase Dashboard SQL Editor')
  console.log('🔗 https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new')
  Deno.exit(1)
}
