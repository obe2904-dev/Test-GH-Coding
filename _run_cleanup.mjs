#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
import { createClient } from 'npm:@supabase/supabase-js@2'
import { load } from 'jsr:@std/dotenv'

// Load environment variables
let env = {}
try {
  env = await load({ envPath: '.env.local', export: false })
} catch {
  try {
    env = await load({ envPath: '.env', export: false })
  } catch {
    console.log('No env file found')
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://oadwluspjlsnxhgakral.supabase.co'
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

const businessId = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b'

console.log('🧹 Cleaning up Café Faust contamination...\n')

// 1. Clear business_profile fields
console.log('1️⃣ Clearing business_profile fields...')
const { error: profileError } = await supabase
  .from('business_profile')
  .update({
    key_offerings: null,
    booking_url: null,
    menu_description: null,
    user_about_text: null,
    long_description: null
  })
  .eq('business_id', businessId)

if (profileError) {
  console.error('❌ Profile update failed:', profileError)
  Deno.exit(1)
}
console.log('✅ Profile cleared')

// 2. Clear business_locations
console.log('\n2️⃣ Clearing business_locations fields...')
const { error: locationError } = await supabase
  .from('business_locations')
  .update({
    phone: null,
    email: null,
    address_line1: null,
    postal_code: null,
    city: null
  })
  .eq('business_id', businessId)

if (locationError) {
  console.error('❌ Location update failed:', locationError)
  Deno.exit(1)
}
console.log('✅ Location cleared')

// 3. Update business name and type
console.log('\n3️⃣ Updating business name and type...')
const { error: businessError } = await supabase
  .from('businesses')
  .update({
    name: 'Souk Aarhus',
    website_url: 'https://soukaarhus.dk/da',
    business_type_hybrid: {
      primary: 'restaurant',
      secondary: ['middle eastern'],
      hybridLabel: 'Middle Eastern Restaurant'
    },
    updated_at: new Date().toISOString()
  })
  .eq('id', businessId)

if (businessError) {
  console.error('❌ Business update failed:', businessError)
  Deno.exit(1)
}
console.log('✅ Business updated: Souk Aarhus - restaurant')

// 4. Delete old website_analyses
console.log('\n4️⃣ Deleting old website analyses...')
const { error: analysisError, count } = await supabase
  .from('website_analyses')
  .delete({ count: 'exact' })
  .eq('business_id', businessId)

if (analysisError) {
  console.error('❌ Analysis deletion failed:', analysisError)
  Deno.exit(1)
}
console.log(`✅ Deleted ${count || 0} old analyses`)

// Verify cleanup
console.log('\n📋 Verifying cleanup...')
const { data, error } = await supabase
  .from('businesses')
  .select(`
    name,
    website_url,
    business_type_hybrid,
    business_profile(key_offerings, booking_url, user_about_text),
    business_locations!business_locations_business_id_fkey(phone, email, address_line1, city)
  `)
  .eq('id', businessId)
  .single()

if (error) {
  console.error('❌ Verification failed:', error)
  Deno.exit(1)
}

console.log('\n✅ Cleanup complete! Current state:')
console.log('Name:', data.name)
console.log('URL:', data.website_url)
console.log('Type:', data.business_type_hybrid?.primary)
console.log('Profile cleared:', !data.business_profile?.[0]?.key_offerings && !data.business_profile?.[0]?.user_about_text)
console.log('Location cleared:', !data.business_locations?.[0]?.phone && !data.business_locations?.[0]?.email)
console.log('\n🎯 Ready for fresh website analysis!')
