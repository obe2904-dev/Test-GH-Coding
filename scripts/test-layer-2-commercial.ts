/**
 * Test Layer 2: Commercial Orientation
 * 
 * Purpose: Test the standalone Layer 2 Edge Function with real Café Faust data
 * Validates that competition data flows correctly to AI
 * 
 * Usage:
 * deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-layer-2-commercial.ts
 */

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BUSINESS_ID = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

console.log("🧪 Testing Layer 2: Commercial Orientation\n");
console.log("=" .repeat(60));

// Fetch REAL location data using service role key to bypass RLS
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const adminClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

const { data: realLocation } = await adminClient
  .from("business_location_intelligence")
  .select("*")
  .eq("business_id", BUSINESS_ID)
  .single();

console.log("\n📊 Real location data from database:");
if (realLocation?.nearby_hospitality) {
  console.log(`   Competition: ${realLocation.nearby_hospitality.density_label} (${realLocation.nearby_hospitality.total_count} within ${realLocation.nearby_hospitality.radius_meters}m)`);
  console.log(`   Breakdown: ${JSON.stringify(realLocation.nearby_hospitality.breakdown)}`);
} else {
  console.log("   ⚠️ No nearby_hospitality data");
}

// Use REAL data from database
const testProgramme = {
  name: "Brunch",
  type: "morning" as const,
  timeWindow: { start: "10:00", end: "14:00" },
  operatingDays: ["Lørdag", "Søndag"],
  confidence: "high" as const,
  languageVariants: ["da", "en"]
};

const testLocation = {
  area_type: realLocation?.area_type || "waterfront",
  neighborhood: realLocation?.neighborhood || "Aarhus",
  nearby_hospitality: realLocation?.nearby_hospitality || {
    density_label: "high",
    total_count: 16,
    radius_meters: 300,
    breakdown: {
      restaurant: 12,
      cafe: 2,
      bar: 2
    }
  }
};

const testBusiness = {
  name: "Café Faust",
  category: "cafe",
  price_level: 2,
  establishment_type: "cafe"
};

const testMenu = {
  price_range: "45-125 DKK",
  item_count: 42,
  categories: ["Breakfast", "Brunch", "Lunch", "Drinks", "Desserts"]
};

console.log(`\n🔬 Test Data:`);
console.log(`   Programme: ${testProgramme.name} (${testProgramme.type})`);
console.log(`   Time: ${testProgramme.timeWindow.start}–${testProgramme.timeWindow.end}`);
console.log(`   Days: ${testProgramme.operatingDays.join(", ")}`);
console.log(`   Competition: ${testLocation.nearby_hospitality.density_label} (${testLocation.nearby_hospitality.total_count} within ${testLocation.nearby_hospitality.radius_meters}m)`);

// Prepare request
const requestBody = {
  programme: testProgramme,
  location: testLocation,
  business: testBusiness,
  menu: testMenu
};

console.log("\n" + "=".repeat(60));
console.log("🚀 Calling Layer 2 Edge Function...\n");

try {
  const { data, error } = await supabase.functions.invoke(
    "brand-profile-layer-2-commercial",
    {
      body: requestBody
    }
  );

  if (error) {
    console.error("❌ Function error:", error);
    Deno.exit(1);
  }

  if (!data.success) {
    console.error("❌ Function returned error:", data.error);
    Deno.exit(1);
  }

  console.log("✅ Layer 2 Response:");
  console.log(`   Baseline Goal Split: ${JSON.stringify(data.data.baseline_goal_split)}`);
  console.log(`\n📝 Commercial Reasoning:`);
  console.log("─".repeat(60));
  console.log(data.data.commercial_reasoning);
  console.log("─".repeat(60));

  // Validate competition data made it through
  const reasoning = data.data.commercial_reasoning.toLowerCase();
  const hasCompetitionMention = 
    reasoning.includes("konkurrence") || 
    reasoning.includes("competition") ||
    reasoning.includes("høj") ||
    reasoning.includes("high") ||
    reasoning.includes("16");

  console.log(`\n🔍 Validation:`);
  if (hasCompetitionMention) {
    console.log(`   ✅ Competition context appears in reasoning`);
  } else {
    console.log(`   ⚠️  Competition context NOT found in reasoning`);
  }

  // Check if it mentions the correct density
  const hasHighDensity = 
    reasoning.includes("høj konkurrence") ||
    reasoning.includes("high competition") ||
    (reasoning.includes("konkurrence") && (reasoning.includes("høj") || reasoning.includes("high")));

  if (hasHighDensity) {
    console.log(`   ✅ Correctly identifies HIGH competition density`);
  } else {
    console.log(`   ⚠️  Does not mention HIGH competition density`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test complete!\n");

} catch (err) {
  console.error("❌ Error:", err);
  Deno.exit(1);
}
