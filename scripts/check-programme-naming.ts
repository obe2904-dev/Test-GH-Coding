import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

console.log("\n📋 Checking Programme Data\n");
console.log("━".repeat(80));

// Check what programmes are stored
const { data: programmes } = await supabase
  .from("business_programme_profiles")
  .select("programme_type, programme_name, time_window_start, time_window_end")
  .eq("business_id", businessId);

console.log("\n🕐 Stored Programmes:\n");
programmes?.forEach(p => {
  console.log(`   Type: ${p.programme_type}`);
  console.log(`   Name: ${p.programme_name}`);
  console.log(`   Time: ${p.time_window_start} - ${p.time_window_end}`);
  console.log();
});

// Check brand profile
const { data: profile } = await supabase
  .from("business_brand_profile")
  .select("brand_essence, positioning")
  .eq("business_id", businessId)
  .single();

console.log("━".repeat(80));
console.log("\n📝 Current Brand Profile:\n");
console.log("Brand Essence:");
console.log(`   ${profile?.brand_essence}\n`);
console.log("Positioning:");
console.log(`   ${profile?.positioning}\n`);

console.log("━".repeat(80));

// Highlight the issue
if (profile?.brand_essence?.includes("morgenmad")) {
  console.log("\n❌ ISSUE FOUND: Brand profile says 'morgenmad'");
  console.log("   But Café Faust serves 'brunch', not morgenmad!");
}

if (programmes?.some(p => p.programme_type === "morning")) {
  console.log("\n💡 Root cause: Programme type is 'morning'");
  console.log("   But programme NAME is 'Morgenmad/Brunch' or 'Brunch'");
  console.log("   Layer 3 needs to use the NAME, not translate the TYPE");
}

console.log("\n");
