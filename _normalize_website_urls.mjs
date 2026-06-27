#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔧 Normalizing website URLs in database...\n')

// Get all businesses with website URLs
const { data: businesses, error: fetchError } = await supabase
  .from('businesses')
  .select('id, name, website_url')
  .not('website_url', 'is', null)

if (fetchError) {
  console.error('❌ Error fetching businesses:', fetchError)
  process.exit(1)
}

console.log(`Found ${businesses.length} businesses with website URLs\n`)

let updatedCount = 0
let alreadyCorrectCount = 0

for (const business of businesses) {
  const url = business.website_url.trim()
  
  // Check if URL needs normalization
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const normalizedUrl = `https://${url}`
    
    console.log(`📝 Updating ${business.name}:`)
    console.log(`   From: ${url}`)
    console.log(`   To:   ${normalizedUrl}`)
    
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ website_url: normalizedUrl })
      .eq('id', business.id)
    
    if (updateError) {
      console.error(`   ❌ Failed to update: ${updateError.message}`)
    } else {
      console.log(`   ✅ Updated successfully`)
      updatedCount++
    }
    console.log()
  } else {
    alreadyCorrectCount++
  }
}

console.log('\n📊 Summary:')
console.log(`   Updated: ${updatedCount}`)
console.log(`   Already correct: ${alreadyCorrectCount}`)
console.log(`   Total: ${businesses.length}`)
