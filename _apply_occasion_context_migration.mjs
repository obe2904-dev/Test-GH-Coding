#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const envContent = await Deno.readTextFile('.env')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/)
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
})

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' }
  }
)

console.log('🚀 Adding occasion_context column...\n')

// Try to insert a test row to check if column exists
const testBusinessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'
const testDate = '2026-06-13'

// First check if column already exists by trying a select
const { data: testSelect, error: selectError } = await supabase
  .from('daily_suggestions')
  .select('occasion_context')
  .limit(1)

if (selectError) {
  if (selectError.message.includes('column') && selectError.message.includes('does not exist')) {
    console.log('⚠️  Column does not exist - migration needed')
    console.log('Please run the migration manually in Supabase Dashboard:')
    console.log('')
    console.log('1. Go to https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/editor')
    console.log('2. Open SQL Editor')
    console.log('3. Copy and paste this SQL:')
    console.log('')
    console.log('ALTER TABLE daily_suggestions ADD COLUMN IF NOT EXISTS occasion_context TEXT;')
    console.log('')
    console.log("COMMENT ON COLUMN daily_suggestions.occasion_context IS 'Creative occasion brief for Stage 2';")
    console.log('')
    Deno.exit(1)
  } else {
    console.error('Unexpected error:', selectError)
    Deno.exit(1)
  }
}

console.log('✅ Column occasion_context already exists or is accessible')
console.log('')

// Try to update a row with occasion_context to verify write access
const { error: updateError } = await supabase
  .from('daily_suggestions')
  .update({ occasion_context: 'Test occasion context' })
  .eq('business_id', testBusinessId)
  .eq('date', testDate)
  .limit(1)

if (updateError) {
  console.warn('⚠️  Could not test write access:', updateError.message)
} else {
  console.log('✅ Write access verified')
}

console.log('')
console.log('Migration complete!')
