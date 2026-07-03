import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv(filename) {
  try {
    const envContent = readFileSync(filename, 'utf-8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    });
    return envVars;
  } catch (e) {
    return {};
  }
}

const envLocal = loadEnv('.env.local');
const env = loadEnv('.env');
const allEnv = { ...env, ...envLocal };

const supabaseUrl = allEnv.VITE_SUPABASE_URL;
const supabaseKey = allEnv.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('business_location_intelligence')
  .select('*')
  .eq('business_id', '1a285371-64f7-4def-b248-2e8cdfbba106')
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('\n🏛️  Landmarks nearby:');
  if (data.landmarks_nearby) {
    data.landmarks_nearby.forEach(l => {
      const dist = l.distance_meters || l.walking_distance_meters || l.distance || 'unknown';
      console.log(`   - ${l.name} (${l.type}) - ${dist}m`);
    });
  }
  
  console.log('\n🔍 Checking physical_context for POI data:');
  if (data.physical_context?.nearby_places) {
    console.log(`   Found ${data.physical_context.nearby_places.length} nearby places`);
    const universities = data.physical_context.nearby_places.filter(p => 
      p.type === 'university' || (p.types && p.types.includes('university'))
    );
    if (universities.length > 0) {
      console.log('\n   🎓 Universities found:');
      universities.forEach(u => {
        const dist = u.distance_meters || u.distance || 'unknown';
        const withinRange = typeof dist === 'number' && dist < 600;
        console.log(`   - ${u.name}: ${dist}m ${withinRange ? '✅ WITHIN 600m' : '❌ OUTSIDE 600m'}`);
      });
    } else {
      console.log('   ℹ️  No universities found in physical_context');
    }
  } else {
    console.log('   ⚠️  physical_context.nearby_places not available');
  }
  
  console.log('\n📊 Category scores:');
  if (data.category_scores) {
    console.log(`   university_campus: ${data.category_scores.university_campus || 0}`);
    console.log(`   city_centre: ${data.category_scores.city_centre || 0}`);
    console.log(`   shopping_district: ${data.category_scores.shopping_district || 0}`);
  }
  
  console.log('\n👥 WHO analysis:');
  if (data.who) {
    console.log(`   Primary: ${JSON.stringify(data.who.primary)}`);
    console.log(`   Secondary: ${JSON.stringify(data.who.secondary)}`);
    if (data.who.notes) {
      console.log(`   Notes: ${data.who.notes}`);
    }
  }
}
