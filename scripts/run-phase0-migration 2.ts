/**
 * Phase 0: Execute Voice V5 Integration Migration
 * Deletes do_not_say column, adds V5 metadata tracking
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🚀 Phase 0: Voice V5 Integration Migration')
console.log('=' .repeat(60))

// Read migration SQL
const migrationSql = await Deno.readTextFile('/tmp/voice_v5_migration.sql')

console.log('\n📄 Migration SQL:')
console.log(migrationSql)
console.log('\n' + '='.repeat(60))

console.log('\n⚠️  WARNING: This will DELETE the do_not_say column!')
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n')

// Wait 3 seconds
await new Promise(resolve => setTimeout(resolve, 3000))

console.log('▶️  Executing migration...\n')

// Execute migration using rpc to run raw SQL
try {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: migrationSql 
  })
  
  if (error) {
    console.error('❌ Migration failed:', error)
    Deno.exit(1)
  }
  
  console.log('✅ Migration executed successfully!')
  console.log('\nResult:', data)
} catch (err) {
  // RPC might not exist, try alternative approach
  console.log('ℹ️  exec_sql RPC not available, trying direct approach...\n')
  
  // Split into individual statements and execute
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  console.log(`Executing ${statements.length} statements...`)
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    console.log(`\n[${i + 1}/${statements.length}] ${stmt.slice(0, 60)}...`)
    
    // Use POST to execute SQL via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: stmt })
    })
    
    if (!response.ok) {
      console.error(`❌ Statement ${i + 1} failed:`, await response.text())
    } else {
      console.log(`✅ Statement ${i + 1} executed`)
    }
  }
}

// Verify migration
console.log('\n' + '='.repeat(60))
console.log('🔍 Verifying migration...\n')

const { data: columns, error: colError } = await supabase
  .from('information_schema.columns')
  .select('column_name')
  .eq('table_name', 'business_brand_profile')
  .in('column_name', [
    'do_not_say',
    'voice_v5_migrated', 
    'voice_v5_generated_at',
    'voice_v5_version',
    'typical_openings',
    'typical_closings',
    'tone_keywords'
  ])

if (colError) {
  console.error('❌ Verification failed:', colError)
} else {
  console.log('Column status:')
  
  const hasDoNotSay = columns?.some(c => c.column_name === 'do_not_say')
  const hasV5Migrated = columns?.some(c => c.column_name === 'voice_v5_migrated')
  const hasTypicalOpenings = columns?.some(c => c.column_name === 'typical_openings')
  const hasTypicalClosings = columns?.some(c => c.column_name === 'typical_closings')
  const hasToneKeywords = columns?.some(c => c.column_name === 'tone_keywords')
  
  console.log(`  do_not_say: ${hasDoNotSay ? '❌ STILL EXISTS (ERROR!)' : '✅ DELETED'}`)
  console.log(`  voice_v5_migrated: ${hasV5Migrated ? '✅ ADDED' : '❌ MISSING'}`)
  console.log(`  typical_openings: ${hasTypicalOpenings ? '✅ PRESERVED' : '❌ DELETED (ERROR!)'}`)
  console.log(`  typical_closings: ${hasTypicalClosings ? '✅ PRESERVED' : '❌ DELETED (ERROR!)'}`)
  console.log(`  tone_keywords: ${hasToneKeywords ? '✅ PRESERVED' : '❌ DELETED (ERROR!)'}`)
  
  if (!hasDoNotSay && hasV5Migrated && hasTypicalOpenings && hasTypicalClosings && hasToneKeywords) {
    console.log('\n🎉 Migration successful!')
    console.log('   - do_not_say column deleted')
    console.log('   - V5 metadata columns added')
    console.log('   - Critical fields preserved')
  } else {
    console.log('\n⚠️  Migration incomplete - manual intervention needed')
  }
}

console.log('\n' + '='.repeat(60))
console.log('Phase 0 migration complete!')
