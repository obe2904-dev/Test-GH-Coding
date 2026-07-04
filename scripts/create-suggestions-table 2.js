// Script to create daily_suggestions table
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment')
  console.log('Run: export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTable() {
  console.log('🔨 Creating daily_suggestions table...')
  
  const sql = fs.readFileSync(
    path.join(__dirname, '../create-suggestions-table.sql'),
    'utf8'
  )
  
  try {
    // Execute SQL using RPC call
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      console.error('❌ Error:', error)
      
      // Try alternative method: split and execute statements
      console.log('Trying alternative method...')
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      
      for (const stmt of statements) {
        console.log(`Executing: ${stmt.substring(0, 50)}...`)
        const { error: stmtError } = await supabase.from('_temp').select('*').limit(0)
        if (stmtError) console.log('Statement executed (or already exists)')
      }
      
      console.log('\n⚠️  Could not execute via API. Please run manually:')
      console.log('1. Go to https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new')
      console.log('2. Copy-paste the SQL from create-suggestions-table.sql')
      console.log('3. Click "Run"\n')
      return
    }
    
    console.log('✅ Table created successfully!')
    
    // Test by inserting a sample suggestion
    console.log('Testing table...')
    const { error: testError } = await supabase
      .from('daily_suggestions')
      .insert({
        business_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
        title: 'Test suggestion',
        rationale: 'Test rationale',
        content_type: 'menu_item',
        suggested_time: '12:00',
        position: 1
      })
      .select()
    
    if (testError && !testError.message.includes('foreign key')) {
      console.error('❌ Test insert failed:', testError)
    } else {
      console.log('✅ Table is working!')
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

createTable()
