import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00'

const supabase = createClient(supabaseUrl, serviceKey)

const { data, error } = await supabase
  .from('businesses')
  .select('name, plan, subscription_tier')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('Error:', error)
} else {
  console.log('Cafe Faust Tier Info:')
  console.log(`  Name: ${data.name}`)
  console.log(`  Plan: ${data.plan}`)
  console.log(`  Subscription Tier: ${data.subscription_tier}`)
}
