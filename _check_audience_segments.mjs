#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAudienceSegments() {
  const BUSINESS_ID = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';
  
  console.log('🔍 Checking K-BBQ audience segments...\n');

  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5')
    .eq('business_id', BUSINESS_ID)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  const audienceProfile = data?.brand_profile_v5?.layer_4_audience_profile;
  
  if (!audienceProfile) {
    console.log('❌ No audience profile found');
    return;
  }

  console.log('👥 AUDIENCE SEGMENTS:\n');
  
  if (audienceProfile.primary_audience) {
    console.log('PRIMARY AUDIENCE:');
    console.log(`  Name: ${audienceProfile.primary_audience.segment_name}`);
    console.log(`  Demographics: ${audienceProfile.primary_audience.demographics}`);
    console.log(`  Psychographics: ${audienceProfile.primary_audience.psychographics}`);
    console.log('');
  }
  
  if (audienceProfile.secondary_audience) {
    console.log('SECONDARY AUDIENCE:');
    console.log(`  Name: ${audienceProfile.secondary_audience.segment_name}`);
    console.log(`  Demographics: ${audienceProfile.secondary_audience.demographics}`);
    console.log(`  Psychographics: ${audienceProfile.secondary_audience.psychographics}`);
    console.log('');
  }
  
  // Check for tourist/student keywords
  const primaryDemo = audienceProfile.primary_audience?.demographics?.toLowerCase() || '';
  const secondaryDemo = audienceProfile.secondary_audience?.demographics?.toLowerCase() || '';
  const primaryName = audienceProfile.primary_audience?.segment_name?.toLowerCase() || '';
  const secondaryName = audienceProfile.secondary_audience?.segment_name?.toLowerCase() || '';
  
  const hasTourist = primaryDemo.includes('turist') || secondaryDemo.includes('turist') ||
                     primaryName.includes('turist') || secondaryName.includes('turist');
  const hasStudent = primaryDemo.includes('student') || secondaryDemo.includes('student') ||
                     primaryName.includes('student') || secondaryName.includes('student');
  
  console.log('🚨 GUARD CHECK:');
  console.log(`  Tourist segment present: ${hasTourist ? '❌ FAILED' : '✅ BLOCKED'}`);
  console.log(`  Student segment present: ${hasStudent ? '❌ FAILED' : '✅ BLOCKED'}`);
}

checkAudienceSegments().catch(console.error);
