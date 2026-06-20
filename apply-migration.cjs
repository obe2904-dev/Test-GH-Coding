const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4ODc2MCwiZXhwIjoyMDc2NTY0NzYwfQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'
);

async function main() {
  const sql = fs.readFileSync('supabase/migrations/20260516000000_fix_daily_reset_in_stats.sql', 'utf8');
  
  console.log('Applying migration: fix_daily_reset_in_stats.sql');
  console.log('='.repeat(60));
  
  // Since we can't exec arbitrary SQL via RPC, we'll use psql via exec
  const { execSync } = require('child_process');
  
  try {
    // Write to temp file to avoid shell escaping issues
    fs.writeFileSync('/tmp/migration.sql', sql);
    
    const result = execSync(
      `psql "postgresql://postgres.kvqdkohdpvmdylqgujpn:Ole020469@kvqdkohdpvmdylqgujpn.supabase.co:5432/postgres" -f /tmp/migration.sql`,
      { encoding: 'utf8', timeout: 30000 }
    );
    
    console.log(result);
    console.log('\n✅ Migration applied successfully!\n');
  } catch (error) {
    console.error('Migration error:', error.message);
    console.error('Trying via Supabase REST API...\n');
    
    // Fallback: Try to at least test if function exists
    const { data, error: testError } = await supabase.rpc('get_daily_usage_stats', {
      p_business_id: 'f4679fa9-3120-4a59-9506-d059b010c34a'
    });
    
    if (testError) {
      console.error('Function test failed:', testError);
      process.exit(1);
    } else {
      console.log('Function test result:', JSON.stringify(data, null, 2));
    }
  }
  
  // Test the updated function
  console.log('Testing updated function...');
  const { data: testData, error: testError } = await supabase.rpc('get_daily_usage_stats', {
    p_business_id: 'f4679fa9-3120-4a59-9506-d059b010c34a'
  });
  
  if (testError) {
    console.error('❌ Test error:', testError);
  } else {
    console.log('✅ Function returns:', JSON.stringify(testData, null, 2));
  }
  
  // Check business table to verify reset
  const { data: bizData } = await supabase
    .from('businesses')
    .select('quick_suggestions_today, last_quick_suggestions_reset')
    .eq('id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
    .single();
  
  console.log('\n📊 Business counter state:', JSON.stringify(bizData, null, 2));
}

main();
