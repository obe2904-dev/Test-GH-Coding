import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f"; // Café Faust

console.log("\n🔍 Debugging Location Data Flow...\n");

// Get business data
const { data: business, error: bizError } = await supabase
  .from("businesses")
  .select("*")
  .eq("id", businessId)
  .single();

if (bizError) {
  console.error("Error:", bizError);
  Deno.exit(1);
}

// Get business operations for city
const { data: ops, error: opsError } = await supabase
  .from("business_operations")
  .select("city, country")
  .eq("business_id", businessId)
  .single();

console.log("━".repeat(80));
console.log("\n📍 Business Data:");
console.log("  Name:", business.name);
console.log("  City:", ops?.city || "N/A");
console.log("  Country:", ops?.country || "N/A");
console.log("  Business has these fields:", Object.keys(business).join(", "));

// Get location intelligence
const { data: location, error: locError } = await supabase
  .from("business_location_intelligence")
  .select("*")
  .eq("business_id", businessId)
  .single();

if (locError) {
  console.error("Error:", locError);
  Deno.exit(1);
}

console.log("\n\n📊 Location Intelligence Data:");
console.log("  Area Type:", location.area_type);
console.log("  Neighborhood:", location.neighborhood);
console.log("  Tourist Context:", location.tourist_context);
console.log("  Local Reference:", location.local_location_reference || "NOT SET");
console.log("  Landmarks:", location.landmarks);

console.log("\n\n🤔 AI Receives This Data:");
console.log("  BUSINESS: Café Faust");
console.log("  CATEGORY: restaurant");
console.log("  LOCATION: Aarhus, Danmark");
console.log("  NEIGHBORHOOD:", location.neighborhood || "N/A");
console.log("  LOCAL REFERENCE:", location.local_location_reference || "N/A");
console.log("  AREA TYPE:", location.area_type || "N/A");

console.log("\n\n⚠️  ROOT CAUSE ANALYSIS:");
console.log("\n1. DATA PROVIDED TO AI:");
console.log("   - City name: 'Aarhus'");
console.log("   - Neighborhood:", location.neighborhood || "none");
console.log("   - Local reference:", location.local_location_reference || "NOT SET");
console.log("   - Area type:", location.area_type);

console.log("\n2. CURRENT PROMPT STRUCTURE:");
console.log("   ✅ Shows 'LOCAL REFERENCE: ved åen' in prompt");
console.log("   ❌ But SYSTEM_PROMPT doesn't explicitly say 'ALWAYS use LOCAL REFERENCE'");
console.log("   ❌ AI sees multiple location signals and constructs its own references");

console.log("\n3. WHY 'ved Aarhus Å' appears:");
console.log("   - AI knows Aarhus (from LOCATION field)");
console.log("   - AI infers river context from data");
console.log("   - AI constructs 'ved Aarhus Å' (combining city + river knowledge)");
console.log("   - MISSING: Explicit instruction that LOCAL REFERENCE is the ONLY way to describe location");

console.log("\n4. SOLUTION (non-hardcoded):");
console.log("   Add to SYSTEM_PROMPT rule:");
console.log("   'When LOCAL REFERENCE exists, use ONLY that phrase for location descriptions.'");
console.log("   'Do NOT construct alternative location names from city/neighborhood/area_type.'");

console.log("\n" + "━".repeat(80));
