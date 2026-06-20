/**
 * Apply Menu Normalization Migration
 * 
 * Directly applies the migration SQL to the database
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/apply-menu-normalization-migration.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

console.log('='['repeat'](70))
console.log('  APPLY MENU NORMALIZATION MIGRATION')
console.log('='['repeat'](70))
console.log('')

// Execute raw SQL queries using fetch to Supabase PostgREST API
const executeSQL = async (sql: string) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ query: sql })
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SQL execution failed: ${error}`)
  }
  
  return response.json()
}

// Read and execute migration
const migrationPath = './supabase/migrations/20260507000001_create_menu_normalization_worker.sql'
console.log(`Reading migration: ${migrationPath}`)

let migrationSQL: string
try {
  migrationSQL = await Deno.readTextFile(migrationPath)
  console.log(`✅ Migration file loaded (${migrationSQL.length} bytes)\n`)
} catch (error) {
  console.error(`❌ Failed to read migration file: ${error.message}`)
  Deno.exit(1)
}

try {
  console.log('Applying migration to database...\n')
  
  // Execute the entire migration in one go
  await executeSQL(migrationSQL)
  
  console.log('✅ Migration applied successfully!\n')
  console.log('='['repeat'](70))
  console.log('  MIGRATION COMPLETE')
  console.log('='['repeat'](70))
  console.log('')
  console.log('Created:')
  console.log('  • sync_menu_items_to_normalized() function')
  console.log('  • trigger_sync_menu_items_on_extraction trigger')
  console.log('  • backfill_menu_normalization() helper')
  console.log('  • menu_normalization_stats view')
  console.log('')
  console.log('Next steps:')
  console.log('  1. Run backfill: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/backfill-menu-normalization.ts')
  console.log('  2. Run tests: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-menu-normalization.ts')
  
} catch (err) {
  console.error('❌ Migration failed:', err.message)
  console.error('\n📝 Manual alternative:')
  console.error('   1. Open https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new')
  console.error('   2. Copy/paste content from supabase/migrations/20260507000001_create_menu_normalization_worker.sql')
  console.error('   3. Click "Run"')
  Deno.exit(1)
}
