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
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

console.log('📋 Checking Persona Storage Location\n')

// Check schema
const { data: columns, error } = await supabase
  .rpc('get_column_info', {
    table_schema: 'public',
    table_name: 'business_brand_profile'
  })

if (error) {
  // Fallback: Direct query
  console.log('Using direct query...\n')
  
  const { data, error: dataError } = await supabase
    .from('business_brand_profile')
    .select('business_id, business_identity_persona')
    .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
    .single()
  
  if (dataError) {
    console.error('Error:', dataError)
    Deno.exit(1)
  }
  
  console.log('✅ Found business_identity_persona')
  console.log('─'.repeat(60))
  console.log(`Table: business_brand_profile`)
  console.log(`Column: business_identity_persona`)
  console.log(`Type: TEXT`)
  console.log(`Length: ${data.business_identity_persona?.length || 0} characters`)
  console.log('')
  console.log('Sample (first 200 chars):')
  console.log(data.business_identity_persona?.substring(0, 200) + '...')
} else {
  const personaColumn = columns.find(c => c.column_name === 'business_identity_persona')
  
  if (personaColumn) {
    console.log('✅ Found business_identity_persona column')
    console.log('─'.repeat(60))
    console.log(`Table: ${personaColumn.table_name}`)
    console.log(`Column: ${personaColumn.column_name}`)
    console.log(`Type: ${personaColumn.data_type}`)
    console.log(`Nullable: ${personaColumn.is_nullable}`)
  }
}
