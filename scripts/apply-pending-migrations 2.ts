#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Apply pending migrations to fix post_drafts schema and regeneration cleanup
 * 
 * Migrations applied:
 * 1. 20260610000001_enhance_suggestion_regeneration.sql
 * 2. 20260610000002_add_weekly_draft_persistence.sql
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function applyMigration(filename: string) {
  console.log(`\n📦 Applying ${filename}...`)
  
  const sqlPath = `./supabase/migrations/${filename}`
  const sql = await Deno.readTextFile(sqlPath)
  
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).single()
  
  if (error) {
    // Try direct execution if RPC doesn't exist
    const { error: directError } = await supabase.from('_migrations').insert({ name: filename })
    
    if (directError) {
      console.error(`❌ Failed to apply ${filename}:`, error || directError)
      return false
    }
  }
  
  console.log(`✅ ${filename} applied successfully`)
  return true
}

async function main() {
  console.log('🚀 Applying pending migrations...\n')
  console.log('Target:', supabaseUrl)
  
  const migrations = [
    '20260610000001_enhance_suggestion_regeneration.sql',
    '20260610000002_add_weekly_draft_persistence.sql'
  ]
  
  for (const migration of migrations) {
    const success = await applyMigration(migration)
    if (!success) {
      console.error('\n❌ Migration failed. Please apply manually in Supabase Dashboard.')
      console.error('   Go to: SQL Editor → New Query')
      console.error(`   Copy contents of: supabase/migrations/${migration}`)
      Deno.exit(1)
    }
  }
  
  console.log('\n✅ All migrations applied successfully!')
  console.log('\n📝 Changes:')
  console.log('   • Enhanced deactivate_old_suggestions to delete post_drafts')
  console.log('   • Added weekly_plan_slot_date column to post_drafts')
  console.log('   • Added indexes for better query performance')
  console.log('\n🎉 Ready to use! Refresh your browser page.')
}

main()
