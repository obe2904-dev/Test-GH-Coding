#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = '69fabd28-83cd-4b60-859e-b1f80c387df9'

console.log('🔍 Checking website URL for business:', businessId)

const { data, error } = await supabase
  .from('businesses')
  .select('id, name, website_url')
  .eq('id', businessId)
  .single()

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

console.log('\n📊 Business data:')
console.log('  Name:', data.name)
console.log('  Website URL:', data.website_url)
console.log('  URL type:', typeof data.website_url)
console.log('  URL length:', data.website_url?.length)
console.log('  Is empty?', !data.website_url)
console.log('  Is whitespace?', data.website_url?.trim() === '')
console.log('  Raw value:', JSON.stringify(data.website_url))

// Try to parse it
if (data.website_url) {
  try {
    const parsed = new URL(data.website_url)
    console.log('\n✅ URL is valid!')
    console.log('  Protocol:', parsed.protocol)
    console.log('  Hostname:', parsed.hostname)
    console.log('  Pathname:', parsed.pathname)
  } catch (e) {
    console.error('\n❌ URL parsing failed:', e.message)
  }
}
