#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// Quick check of Café Faust brand profile data

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('Checking Café Faust brand profile...\n')

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('*')
  .eq('business_id', CAFE_FAUST_ID)
  .maybeSingle()

if (error) {
  console.error('Error:', error)
  Deno.exit(1)
}

if (!data) {
  console.log('❌ No brand profile found')
  Deno.exit(1)
}

console.log('✅ Brand profile found')
console.log('Columns present:', Object.keys(data).join(', '))
console.log()
console.log('brand_essence:', data.brand_essence ? '✅' : '❌')
console.log('positioning:', data.positioning ? '✅' : '❌')
console.log('core_values:', data.core_values ? '✅' : '❌')
console.log('what_makes_us_different:', data.what_makes_us_different ? '✅' : '❌')
console.log('identity_confidence:', data.identity_confidence || 0)
console.log('local_location_reference:', data.local_location_reference || 'N/A')
