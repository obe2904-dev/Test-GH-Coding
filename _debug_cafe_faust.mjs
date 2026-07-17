#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oadwluspjlsnxhgakral.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZHdsdXNwamxzbnhoZ2FrcmFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTU5NzE5NCwiZXhwIjoyMDQ3MTczMTk0fQ.R3fYPaJYWLcIv0EwMjmSr8h66dUVpzLxLXwvNqGxkJA'
);

const businessId = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

// Check businesses table
const { data: business, error: bizError } = await supabase
  .from('businesses')
  .select('business_name, local_location_reference, website_url')
  .eq('id', businessId)
  .single();

if (bizError) {
  console.error('❌ businesses error:', bizError);
} else {
  console.log('\n📊 BUSINESSES:');
  console.log('  business_name:', business.business_name);
  console.log('  local_location_reference:', business.local_location_reference);
  console.log('  website_url:', business.website_url);
}

// Check business_profile table
const { data: profile, error: profError } = await supabase
  .from('business_profile')
  .select('user_about_text, key_offerings')
  .eq('business_id', businessId)
  .single();

if (profError) {
  console.error('❌ business_profile error:', profError);
} else {
  console.log('\n📋 BUSINESS_PROFILE:');
  console.log('  user_about_text:', profile.user_about_text?.slice(0, 200));
  console.log('  key_offerings:', profile.key_offerings);
}

// Check business_locations table
const { data: location, error: locError } = await supabase
  .from('business_locations')
  .select('address_line1, postal_code, phone, email')
  .eq('business_id', businessId)
  .single();

if (locError) {
  console.error('❌ business_locations error:', locError);
} else {
  console.log('\n📍 BUSINESS_LOCATIONS:');
  console.log('  address_line1:', location.address_line1);
  console.log('  postal_code:', location.postal_code);
  console.log('  phone:', location.phone);
  console.log('  email:', location.email);
}
