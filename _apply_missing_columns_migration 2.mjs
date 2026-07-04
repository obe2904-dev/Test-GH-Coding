#!/usr/bin/env node

/**
 * Apply Missing Columns Migration
 * Run: node _apply_missing_columns_migration.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment
const envFile = readFileSync(join(__dirname, '.env'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('='))
)

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('🔧 Applying missing columns migration...\n')
  
  // Part 1: Add columns
  console.log('📋 Part 1: Adding missing columns to daily_suggestions...')
  
  const { error: col1Error } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE daily_suggestions 
      ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;
    `
  })
  
  if (col1Error && !col1Error.message.includes('already exists')) {
    console.error('❌ Error adding inferred_content_type:', col1Error)
  } else {
    console.log('✅ Added inferred_content_type column')
  }
  
  const { error: col2Error } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE daily_suggestions 
      ADD COLUMN IF NOT EXISTS validation_result JSONB;
    `
  })
  
  if (col2Error && !col2Error.message.includes('already exists')) {
    console.error('❌ Error adding validation_result:', col2Error)
  } else {
    console.log('✅ Added validation_result column')
  }
  
  // Part 2: Create indexes
  console.log('\n📋 Part 2: Creating indexes...')
  
  const { error: idx1Error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE INDEX IF NOT EXISTS idx_daily_suggestions_validation 
        ON daily_suggestions USING GIN (validation_result);
    `
  })
  
  if (idx1Error) {
    console.error('❌ Error creating validation index:', idx1Error)
  } else {
    console.log('✅ Created validation_result index')
  }
  
  const { error: idx2Error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE INDEX IF NOT EXISTS idx_daily_suggestions_content_type 
        ON daily_suggestions(inferred_content_type);
    `
  })
  
  if (idx2Error) {
    console.error('❌ Error creating content_type index:', idx2Error)
  } else {
    console.log('✅ Created inferred_content_type index')
  }
  
  // Part 3: Verify columns
  console.log('\n📋 Part 3: Verifying columns exist...')
  
  const { data: columns, error: verifyError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'daily_suggestions')
    .in('column_name', ['inferred_content_type', 'validation_result'])
  
  if (verifyError) {
    console.error('❌ Error verifying columns:', verifyError)
  } else if (columns && columns.length > 0) {
    console.log('✅ Columns verified:')
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`)
    })
  }
  
  // Part 4: Check content_strategy
  console.log('\n📋 Part 4: Checking content_strategy for Café Faust...')
  
  const { data: brandProfile, error: profileError } = await supabase
    .from('business_brand_profile')
    .select('business_name, brand_voice')
    .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
    .single()
  
  if (profileError) {
    console.error('❌ Error fetching brand profile:', profileError)
  } else if (brandProfile) {
    const hasContentStrategy = brandProfile.brand_voice?.content_strategy !== undefined
    const hasGoalBlend = brandProfile.brand_voice?.content_strategy?.goal_blend !== undefined
    
    console.log(`   Business: ${brandProfile.business_name}`)
    console.log(`   Has content_strategy: ${hasContentStrategy ? '✅' : '❌'}`)
    
    if (hasContentStrategy) {
      console.log(`   Has goal_blend: ${hasGoalBlend ? '✅' : '❌'}`)
      
      if (hasGoalBlend) {
        console.log('   Goal blend:', brandProfile.brand_voice.content_strategy.goal_blend)
        console.log('   Content weights:', brandProfile.brand_voice.content_strategy.content_category_weights)
      } else {
        console.log('   ⚠️  content_strategy exists but goal_blend is missing')
      }
    } else {
      console.log('   ⚠️  No content_strategy found - brand profile needs regeneration')
      console.log('   Run: Regenerate brand profile in dashboard to fix this')
    }
  }
  
  console.log('\n✨ Migration complete!')
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
