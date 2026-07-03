import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 CHECKING DATABASE ACCESS & RLS')
console.log('=' .repeat(60))

// Try different table names
const tablesToTry = [
  'businesses',
  'business',
  'business_profile',
  'business_type_defaults'
]

for (const tableName of tablesToTry) {
  console.log(`\n📋 Testing table: ${tableName}`)
  
  const { data, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: false })
    .limit(1)
  
  if (error) {
    console.log(`   ❌ Error: ${error.message}`)
  } else {
    console.log(`   ✅ Accessible`)
    console.log(`   Rows found: ${count || 0}`)
    if (data && data.length > 0) {
      console.log(`   Sample columns:`, Object.keys(data[0]).join(', '))
    }
  }
}

// Try the specific business ID
console.log('\n' + '='.repeat(60))
console.log('🔍 DIRECT SEARCH FOR CAFE FAUST')
console.log('=' .repeat(60))

const businessId = '840347de-9ba7-4275-8aa3-4553417fc2af'

// Try with different ID column names
const idColumns = ['id', 'business_id', 'uuid']

for (const idCol of idColumns) {
  console.log(`\n📍 Trying businesses.${idCol} = ${businessId.substring(0, 8)}...`)
  
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq(idCol, businessId)
    .limit(1)
  
  if (!error && data && data.length > 0) {
    console.log('   ✅ FOUND!')
    console.log('   Business:', JSON.stringify(data[0], null, 2))
    break
  } else if (error) {
    console.log(`   ❌ Error: ${error.message}`)
  } else {
    console.log('   ⚠️  Not found with this column')
  }
}
