#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --env-file=.env

/**
 * Execute Phase 0 migration: 20260508_integrate_voice_v5.sql
 * Drops do_not_say column and adds V5 metadata columns
 */

const migrationSQL = await Deno.readTextFile('supabase/migrations/20260508_integrate_voice_v5.sql')

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  Deno.exit(1)
}

console.log('🔄 Executing Phase 0 migration...')
console.log('📄 File: supabase/migrations/20260508_integrate_voice_v5.sql')
console.log('')

try {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ query: migrationSQL })
  })

  if (!response.ok) {
    // Try alternative: execute via SQL endpoint
    const altResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.pgrst.object+json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation',
      },
      body: migrationSQL
    })
    
    if (!altResponse.ok) {
      console.error('❌ Migration failed:', await response.text())
      console.error('Alternative attempt:', await altResponse.text())
      Deno.exit(1)
    }
  }

  console.log('✅ Migration executed successfully!')
  console.log('')
  console.log('Changes applied:')
  console.log('  - ❌ Dropped column: do_not_say')
  console.log('  - ✅ Added column: voice_v5_migrated (BOOLEAN)')
  console.log('  - ✅ Added column: voice_v5_generated_at (TIMESTAMPTZ)')
  console.log('  - ✅ Added column: voice_v5_version (TEXT)')
  console.log('  - 📝 Added protection comments to: typical_openings, typical_closings, tone_keywords, never_say, signature_phrases')
  console.log('')
  console.log('Next step: Regenerate TypeScript types')
  console.log('  supabase gen types typescript --local > src/types/database.ts')

} catch (error) {
  console.error('❌ Error executing migration:', error)
  Deno.exit(1)
}
