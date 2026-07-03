#!/usr/bin/env node
/**
 * Regenerate K-BBQ brand profile to test demographic guard
 */

const BUSINESS_ID = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c'; // K-BBQ
const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';

async function regenerateBrandProfile() {
  console.log('🔄 Regenerating K-BBQ brand profile...\n');

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/brand-profile-generator-v5`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: BUSINESS_ID,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Error:', result);
    process.exit(1);
  }

  console.log('\n✅ Brand profile regenerated!\n');
  
  console.log('Full response keys:', Object.keys(result));
  console.log('\nBrand profile keys:', result.brand_profile ? Object.keys(result.brand_profile) : 'N/A');
  
  // Show audience segments
  const audienceProfile = result.brand_profile?.brand_profile_v5?.layer_4_audience_profile;
  if (audienceProfile) {
    console.log('👥 AUDIENCE SEGMENTS:');
    console.log('Primary:', audienceProfile.primary_audience?.segment_name || 'None');
    console.log('Secondary:', audienceProfile.secondary_audience?.segment_name || 'None');
    console.log('\nSegment details:');
    if (audienceProfile.primary_audience) {
      console.log(`  - ${audienceProfile.primary_audience.segment_name}`);
      console.log(`    Demographics: ${audienceProfile.primary_audience.demographics}`);
    }
    if (audienceProfile.secondary_audience) {
      console.log(`  - ${audienceProfile.secondary_audience.segment_name}`);
      console.log(`    Demographics: ${audienceProfile.secondary_audience.demographics}`);
    }
  }

  // Check if student/tourist were filtered
  console.log('\n🔍 Check logs above for demographic filtering results');
}

regenerateBrandProfile().catch(console.error);
