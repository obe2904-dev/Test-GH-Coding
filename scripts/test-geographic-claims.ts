/**
 * Test Geographic Claims with Supplier Analysis
 * 
 * Verifies that Layer 3 uses supplier_analysis data for factual geographic claims.
 */

import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

console.log("\n🔍 Testing Geographic Claims with Supplier Data\n");
console.log("━".repeat(80));

// 1. Check supplier analysis data
const { data: location, error: locationError } = await supabase
  .from("business_location_intelligence")
  .select("supplier_analysis")
  .eq("business_id", businessId)
  .single();

if (locationError) {
  console.error("❌ Error fetching location:", locationError);
  Deno.exit(1);
}

console.log("\n📊 Supplier Analysis Data:\n");
if (location?.supplier_analysis) {
  const analysis = location.supplier_analysis as any;
  console.log(`   Geographic Scope: ${analysis.geographic_scope?.toUpperCase()}`);
  console.log(`   Local suppliers (<30km): ${analysis.local_count}`);
  console.log(`   Regional suppliers (30-100km): ${analysis.regional_count}`);
  console.log(`   National suppliers (>100km): ${analysis.national_count}`);
  console.log(`\n   Verified Suppliers:`);
  analysis.suppliers?.forEach((s: any) => {
    console.log(`     - ${s.name}: ${s.distance_km} km`);
  });
} else {
  console.log("   ⚠️  No supplier analysis data found");
}

// 2. Generate brand profile
console.log("\n\n🎨 Generating Brand Profile...\n");

const { data: profileData, error: profileError } = await supabase.functions.invoke(
  "brand-profile-generator-v5",
  {
    body: { businessId: businessId }  // Use camelCase
  }
);

if (profileError) {
  console.error("❌ Error generating profile:", profileError);
  Deno.exit(1);
}

const profile = profileData?.brand_profile;
if (!profile) {
  console.error("❌ No profile data returned");
  Deno.exit(1);
}

console.log("✅ Profile generated successfully\n");
console.log("━".repeat(80));

// 3. Check geographic claims in core values
console.log("\n📋 Core Values:\n");
profile.core_values.forEach((value: string, i: number) => {
  console.log(`   ${i + 1}. ${value}`);
});

// 4. Analyze geographic accuracy
console.log("\n\n🎯 Geographic Claim Analysis:\n");

const geographicValue = profile.core_values.find((v: string) => 
  v.toLowerCase().includes("lokal") || 
  v.toLowerCase().includes("dansk") || 
  v.toLowerCase().includes("regional")
);

if (geographicValue) {
  console.log(`   Found: "${geographicValue}"\n`);
  
  const isLocalClaim = geographicValue.toLowerCase().includes("lokal forankring");
  const isRegionalClaim = geographicValue.toLowerCase().includes("regional");
  const isDanishClaim = geographicValue.toLowerCase().includes("dansk");
  
  const supplierScope = location?.supplier_analysis?.geographic_scope;
  
  console.log("   Validation:");
  if (isLocalClaim && supplierScope !== "local") {
    console.log("   ❌ MISMATCH: Claims 'lokal' but suppliers are not local (<30km)");
    console.log(`      Actual scope: ${supplierScope}`);
  } else if (isRegionalClaim && supplierScope === "regional") {
    console.log("   ✅ CORRECT: Claims 'regional' matching supplier scope");
  } else if (isDanishClaim) {
    console.log("   ✅ CORRECT: Claims 'dansk' (safe, factual)");
  } else {
    console.log("   ✅ Geographic claim matches supplier data");
  }
  
  // Check title/description consistency
  const parts = geographicValue.split(" - ");
  const title = parts[0];
  const description = parts[1] || "";
  
  console.log(`\n   Title: "${title}"`);
  console.log(`   Description: "${description}"`);
  
  const titleClaim = title.toLowerCase().includes("lokal") ? "local" 
    : title.toLowerCase().includes("regional") ? "regional" 
    : "danish";
  
  const descClaim = description.toLowerCase().includes("lokale") ? "local"
    : description.toLowerCase().includes("regionale") ? "regional"
    : "danish";
  
  if (titleClaim !== descClaim) {
    console.log(`\n   ❌ INCONSISTENCY: Title claims "${titleClaim}" but description claims "${descClaim}"`);
  } else {
    console.log(`\n   ✅ CONSISTENT: Both title and description use "${titleClaim}" scope`);
  }
} else {
  console.log("   No geographic value found in core values");
}

// 5. Show full brand essence
console.log("\n\n━".repeat(80));
console.log("\n📄 Brand Essence:\n");
console.log(`   ${profile.brand_essence}`);

console.log("\n\n━".repeat(80));
console.log("\n✅ Test complete\n");
