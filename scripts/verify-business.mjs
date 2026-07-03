import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

const { data: business } = await supabase
  .from('businesses')
  .select('id, name')
  .eq('id', '2037d63c-a138-4247-89c5-5b6b8cef9f3f')
  .single()

console.log('Business:', business?.name || 'NOT FOUND')
console.log('ID:', business?.id || 'N/A')

if (business) {
  // Check if they have any brand profile
  const { data: profile } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5_generated_at')
    .eq('business_id', business.id)
    .single()
  
  console.log('V5 Profile:', profile?.brand_profile_v5_generated_at ? '✅ Yes' : '❌ No')
}
