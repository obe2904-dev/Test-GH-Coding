#!/usr/bin/env -S deno run --allow-env --allow-net

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA4MzExNSwiZXhwIjoyMDUxNjU5MTE1fQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Checking revenue_drivers in database...\n');

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('revenue_drivers')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single();

if (error) {
  console.error('❌ Error:', error);
  Deno.exit(1);
}

console.log('✅ Query successful');
console.log('Has revenue_drivers:', data.revenue_drivers !== null);

if (data.revenue_drivers) {
  console.log('\nRevenue Drivers Data:');
  console.log('  Confidence:', data.revenue_drivers.confidence_score);
  console.log('  Analyzed from:', data.revenue_drivers.analyzed_from);
  console.log('  Primary moment:', data.revenue_drivers.primary_revenue_moment?.service_type);
  console.log('\nFull data:', JSON.stringify(data.revenue_drivers, null, 2));
} else {
  console.log('\n⚠️  revenue_drivers is NULL or missing');
}
