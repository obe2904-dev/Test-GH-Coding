import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII'
)

async function checkTables() {
  console.log('🔍 Checking if vertical-specific tables exist...\n')
  
  const tables = [
    'business_services',
    'business_staff', 
    'business_products',
    'business_classes'
  ]
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1)
      
      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log(`❌ ${table} - NOT FOUND`)
        } else {
          console.log(`⚠️  ${table} - Error: ${error.message}`)
        }
      } else {
        console.log(`✅ ${table} - EXISTS (${data?.length || 0} rows)`)
      }
    } catch (e) {
      console.log(`❌ ${table} - Error: ${e.message}`)
    }
  }
  
  console.log('\nDone!')
}

checkTables()
