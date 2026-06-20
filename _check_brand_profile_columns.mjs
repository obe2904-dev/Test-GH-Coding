import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA4MzExNSwiZXhwIjoyMDUxNjU5MTE1fQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'
);

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a';

// Check what's actually in the table
const { data, error } = await supabase
  .from('business_brand_profile')
  .select(`
    brand_profile_v5,
    brand_essence,
    business_character,
    target_type_mix,
    revenue_drivers
  `)
  .eq('business_id', businessId)
  .single();

if (error) {
  console.error('❌ Query error:', error);
} else {
  console.log('✅ Query successful');
  console.log('Has brand_profile_v5:', !!data.brand_profile_v5);
  console.log('Has brand_essence:', !!data.brand_essence);
  console.log('Has business_character:', !!data.business_character);
  console.log('Has target_type_mix:', !!data.target_type_mix);
  console.log('Has revenue_drivers:', !!data.revenue_drivers);
  
  if (data.revenue_drivers) {
    console.log('\n📊 Revenue Drivers:');
    console.log(JSON.stringify(data.revenue_drivers, null, 2));
  } else {
    console.log('\n⚠️  revenue_drivers is null or undefined');
  }
}
