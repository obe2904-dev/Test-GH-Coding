/**
 * Quick Check: Brand Profile Geographic Claims
 * 
 * Checks existing brand profile for geographic claim accuracy.
 */

import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

console.log("\n📋 Quick Geographic Claims Check\n");
console.log("━".repeat(80));

// 1. Get supplier analysis
const { data: location } = await supabase
  .from("business_location_intelligence")
  .select("supplier_analysis")
  .eq("business_id", businessId)
  .single();

console.log("\n📊 Supplier Analysis:");
if (location?.supplier_analysis) {
  const analysis = location.supplier_analysis as any;
  console.log(`   Scope: ${analysis.geographic_scope}`);
  analysis.suppliers?.forEach((s: any) => {
    console.log(`   - ${s.name}: ${s.distance_km} km`);
  });
} else {
  console.log("   No data");
}

// 2. Get current brand profile
const { data: profile } = await supabase
  .from("business_brand_profile")
  .select("core_values")
  .eq("business_id", businessId)
  .single();

console.log("\n📝 Core Values:");
if (profile?.core_values) {
  profile.core_values.forEach((v: string, i: number) => {
    console.log(`   ${i + 1}. ${v}`);
  });
  
  // Find geographic value
  const geoValue = profile.core_values.find((v: string) => 
    v.toLowerCase().includes("lokal") || 
    v.toLowerCase().includes("dansk") || 
    v.toLowerCase().includes("regional")
  );
  
  if (geoValue) {
    console.log("\n🎯 Geographic Value:");
    console.log(`   "${geoValue}"`);
    
    const scope = location?.supplier_analysis?.geographic_scope;
    if (scope) {
      console.log(`\n   Expected (based on supplier data): "${scope}"`);
      
      if (geoValue.toLowerCase().includes("lokal") && scope !== "local") {
        console.log("   ❌ MISMATCH - Claims 'lokal' but scope is", scope);
      } else if (geoValue.toLowerCase().includes("regional") && scope === "regional") {
        console.log("   ✅ MATCH - Correctly claims 'regional'");
      } else if (geoValue.toLowerCase().includes("dansk")) {
        console.log("   ✅ SAFE - Uses 'dansk' (always factual)");
      } else {
        console.log("   ⚠️  Needs verification");
      }
    }
  }
} else {
  console.log("   No profile found");
}

console.log("\n" + "━".repeat(80) + "\n");
