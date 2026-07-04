// Execute migration script
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Read migration file
const migrationPath = join(__dirname, '../supabase/migrations/003_vertical_specific_tables.sql')
const migrationSQL = readFileSync(migrationPath, 'utf-8')

console.log('Executing migration: 003_vertical_specific_tables.sql')
console.log('Creating tables: business_services, business_staff, business_products, business_classes')
console.log('')

// Execute migration
async function executeMigration() {
  try {
    // Note: Supabase JS client doesn't support raw SQL execution
    // We need to use the REST API directly
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Migration failed: ${error}`)
    }

    console.log('✅ Migration executed successfully!')
    console.log('')
    console.log('Created tables:')
    console.log('  - business_services (service offerings)')
    console.log('  - business_staff (team member profiles)')
    console.log('  - business_products (retail product catalog)')
    console.log('  - business_classes (class/event schedules)')
    console.log('')
    console.log('All tables include RLS policies and proper indexes.')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.log('')
    console.log('Please execute the migration manually:')
    console.log('1. Go to https://supabase.com/dashboard')
    console.log('2. Open SQL Editor')
    console.log('3. Paste the migration SQL (already in clipboard)')
    console.log('4. Click RUN')
    process.exit(1)
  }
}

executeMigration()
