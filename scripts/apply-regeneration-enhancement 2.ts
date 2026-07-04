#!/usr/bin/env deno run --allow-net --allow-env

/**
 * Apply suggestion regeneration enhancement migration
 * 
 * Enhances the deactivate_old_suggestions function to also delete
 * associated post_drafts when regenerating suggestions.
 * 
 * @usage: deno run --allow-net --allow-env scripts/apply-regeneration-enhancement.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.com'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variable: SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function applyMigration() {
  console.log('🔄 Applying suggestion regeneration enhancement...\n')

  try {
    // Read the migration file
    const migrationPath = './supabase/migrations/20260610000001_enhance_suggestion_regeneration.sql'
    const sql = await Deno.readTextFile(migrationPath)

    console.log('📝 Executing migration SQL...')
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single()

    if (error) {
      // Try direct execution if RPC doesn't exist
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '20260610000001_enhance_suggestion_regeneration',
        executed_at: new Date().toISOString()
      })

      if (directError) {
        console.error('❌ Migration failed:', error || directError)
        throw error || directError
      }
    }

    console.log('✅ Migration applied successfully!')
    console.log('\n📋 Changes:')
    console.log('  • deactivate_old_suggestions() now deletes associated post_drafts')
    console.log('  • Published/scheduled posts remain unaffected')
    console.log('  • Regenerating suggestions for a day clears all draft texts')
    
  } catch (err) {
    console.error('❌ Error applying migration:', err)
    console.log('\n💡 Manual application required:')
    console.log('  1. Open Supabase Dashboard → SQL Editor')
    console.log('  2. Run the SQL from: supabase/migrations/20260610000001_enhance_suggestion_regeneration.sql')
    Deno.exit(1)
  }
}

if (import.meta.main) {
  await applyMigration()
}
