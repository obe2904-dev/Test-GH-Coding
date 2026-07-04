/**
 * Diagnostic: Check what location data is actually in the database
 */

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing environment variables: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUSINESS_ID = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

console.log("🔍 Fetching location data from database...\n");

// Try without .single() first to see if any rows exist
const { data: allLocations, error: listError } = await supabase
  .from("business_location_intelligence")
  .select("*")
  .eq("business_id", BUSINESS_ID);

console.log(`Found ${allLocations?.length || 0} location records`);

if (allLocations && allLocations.length > 0) {
  const location = allLocations[0];
  console.log("\n📊 Full location object:");
  console.log(JSON.stringify(location, null, 2));
  
  console.log("\n" + "=".repeat(60));
  console.log("🎯 nearby_hospitality field specifically:");
  console.log("=".repeat(60));
  
  if (location?.nearby_hospitality) {
    console.log(JSON.stringify(location.nearby_hospitality, null, 2));
    console.log("\n✅ nearby_hospitality exists in database");
    console.log(`   Density: ${location.nearby_hospitality.density_label}`);
    console.log(`   Count: ${location.nearby_hospitality.total_count}`);
    console.log(`   Radius: ${location.nearby_hospitality.radius_meters}m`);
  } else {
    console.log("❌ nearby_hospitality is null or undefined");
    console.log(`   Available fields: ${Object.keys(location || {}).join(", ")}`);
  }
} else {
  console.error("\n❌ No location records found!");
  console.error("This could be due to:");
  console.error("  1. Row Level Security (RLS) blocking access");
  console.error("  2. No data exists for this business_id");
  console.error("  3. Using wrong credentials");
  
  if (listError) {
    console.error("\nError:", listError);
  }
}
