#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLocationCoverage() {
  console.log('🔍 Checking location intelligence coverage...\n');

  // Get all businesses
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('*');

  if (bizError) {
    console.error('❌ Error fetching businesses:', bizError);
    process.exit(1);
  }

  console.log(`📊 Total businesses: ${businesses.length}`);

  // Get all location intelligence records
  const { data: locations, error: locError } = await supabase
    .from('business_location_intelligence')
    .select('*');

  if (locError) {
    console.error('❌ Error fetching location data:', locError);
    process.exit(1);
  }

  console.log(`\n📍 Sample location record:`, locations[0]);

  const locationMap = new Map(locations.map(l => [l.business_id, l]));

  const withLocation = [];
  const withoutLocation = [];

  for (const biz of businesses) {
    if (locationMap.has(biz.id)) {
      withLocation.push(biz);
    } else {
      withoutLocation.push(biz);
    }
  }

  console.log(`✅ With location data: ${withLocation.length}`);
  console.log(`❌ WITHOUT location data: ${withoutLocation.length}\n`);

  if (withoutLocation.length > 0) {
    console.log('🚨 Businesses missing location intelligence:');
    withoutLocation.forEach(biz => {
      console.log(`  - ${biz.name} (ID: ${biz.id})`);
    });
  }

  // Check data quality for existing records
  console.log('\n📍 Location data quality check:');
  
  let missingDemographics = 0;
  let missingCategoryScores = 0;
  
  for (const loc of locations) {
    if (!loc.demographic_proximity || Object.keys(loc.demographic_proximity).length === 0) {
      missingDemographics++;
    }
  }

  console.log(`  - Missing demographic_proximity: ${missingDemographics}/${locations.length}`);
}

checkLocationCoverage().catch(console.error);
