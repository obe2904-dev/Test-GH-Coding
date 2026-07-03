/**
 * Run this in browser console at http://localhost:3000
 * 
 * This will trigger menu-sync to reclassify existing menu items
 * with new drinks/coffee category detection.
 */

async function resyncMenu() {
  console.log('🔄 Starting menu resync...');
  
  const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
  const BUSINESS_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';
  
  try {
    // Get auth token from local storage (if user is logged in)
    const authToken = localStorage.getItem('supabase.auth.token');
    let accessToken = null;
    
    if (authToken) {
      const parsed = JSON.parse(authToken);
      accessToken = parsed?.currentSession?.access_token;
    }
    
    if (!accessToken) {
      console.error('❌ No auth token found. Please log in first.');
      return;
    }
    
    console.log('📡 Calling menu-sync function...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/menu-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: BUSINESS_ID,
        forceResync: true
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Menu sync failed:', result);
      return;
    }
    
    console.log('✅ Menu sync complete!', result);
    console.log('');
    console.log('🔍 Run this SQL to verify:');
    console.log(`
      SELECT 
        UNNEST(service_periods) as period,
        category_type,
        COUNT(*) as count
      FROM menu_items_normalized
      WHERE business_id = '${BUSINESS_ID}'
        AND is_active = true
      GROUP BY period, category_type
      ORDER BY period, category_type;
    `);
    
  } catch (error) {
    console.error('❌ Error during resync:', error);
  }
}

// Run it
resyncMenu();
