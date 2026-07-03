/**
 * Apply Layer 3 Migration
 * Adds missing columns to business_brand_profile table
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY')!

console.log('🔧 Applying Layer 3 Migration...')
console.log('📊 Adding missing columns to business_brand_profile table\n')

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

try {
  // Execute each ALTER TABLE statement separately
  console.log('Adding core_values column...')
  await executeSQL(`
    ALTER TABLE business_brand_profile 
    ADD COLUMN IF NOT EXISTS core_values JSONB;
  `)
  console.log('✅ core_values added')
  
  console.log('Adding what_makes_us_different column...')
  await executeSQL(`
    ALTER TABLE business_brand_profile 
    ADD COLUMN IF NOT EXISTS what_makes_us_different TEXT;
  `)
  console.log('✅ what_makes_us_different added')
  
  console.log('Adding identity_confidence column...')
  await executeSQL(`
    ALTER TABLE business_brand_profile 
    ADD COLUMN IF NOT EXISTS identity_confidence DECIMAL(3,2);
  `)
  console.log('✅ identity_confidence added')
  
  console.log('Adding identity_reasoning column...')
  await executeSQL(`
    ALTER TABLE business_brand_profile 
    ADD COLUMN IF NOT EXISTS identity_reasoning TEXT;
  `)
  console.log('✅ identity_reasoning added\n')
  
  // Add comments
  console.log('Adding column comments...')
  await executeSQL(`
    COMMENT ON COLUMN business_brand_profile.core_values IS 'Layer 3: AI-generated core values array (e.g. ["Kvalitet", "Nærhed"])';
    COMMENT ON COLUMN business_brand_profile.what_makes_us_different IS 'Layer 3: AI-generated differentiation statement';
    COMMENT ON COLUMN business_brand_profile.identity_confidence IS 'Layer 3: AI confidence score 0.00-1.00 for identity generation';
    COMMENT ON COLUMN business_brand_profile.identity_reasoning IS 'Layer 3: AI reasoning/explanation for identity decisions';
  `)
  console.log('✅ Comments added\n')
  
  console.log('✅ Migration applied successfully!')
  console.log('💡 All 6 Layer 3 fields are now ready:')
  console.log('   • brand_essence (already existed)')
  console.log('   • positioning (already existed)')
  console.log('   • core_values (just added)')
  console.log('   • what_makes_us_different (just added)')
  console.log('   • identity_confidence (just added)')
  console.log('   • identity_reasoning (just added)')
  console.log('\n💡 Next: Regenerate V5 profile to save all Layer 3 data')
  
} catch (err) {
  console.error('❌ Migration failed:', err.message)
  console.error('\n📝 Manual steps required:')
  console.error('   1. Open https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new')
  console.error('   2. Copy/paste content from APPLY_LAYER3_MIGRATION.sql')
  console.error('   3. Click "Run"')
  Deno.exit(1)
}
