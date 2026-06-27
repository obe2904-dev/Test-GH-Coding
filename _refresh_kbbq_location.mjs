#!/usr/bin/env node
/**
 * Refresh K-BBQ location intelligence with force_refresh
 * to populate demographic_proximity field
 */

const BUSINESS_ID = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c'; // K-BBQ

async function refreshLocation() {
  console.log('🔄 Refreshing K-BBQ location intelligence...\n');

  const response = await fetch(
    'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_id: BUSINESS_ID,
        force_refresh: true, // Bypass cache
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Error:', result);
    process.exit(1);
  }

  console.log('\n✅ Location intelligence refreshed!\n');
  
  // Show key fields
  const intel = result.location_intelligence;
  console.log('📍 Neighborhood:', intel.neighborhood);
  console.log('🗺️  Area type:', intel.area_type);
  console.log('\n🏛️  Category scores (geographic):');
  console.log(JSON.stringify(intel.category_scores, null, 2));
  console.log('\n👥 Demographic proximity (WHO nearby):');
  console.log(JSON.stringify(intel.demographic_proximity, null, 2));
  console.log('\n🏢 Physical context:');
  console.log(JSON.stringify(intel.physical_context, null, 2));
  console.log('\n🏪 Raw competitive venues:', intel.raw_competitive_venues?.length || 0);
}

refreshLocation().catch(console.error);
