import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

const { data, error } = await supabase
  .from("business_brand_profile")
  .select("brand_essence, positioning, what_makes_us_different, core_values")
  .eq("business_id", businessId)
  .single();

if (error) {
  console.error("Error:", error);
  Deno.exit(1);
}

console.log("\n🔍 CONSISTENCY CHECK:\n");
console.log("━".repeat(80));

// Check 1: Location naming consistency
console.log("\n📍 LOCATION NAMING (should be ONLY 'ved åen'):\n");

const locationChecks = [
  { field: "Brand Essence", text: data.brand_essence },
  { field: "Positioning", text: data.positioning },
  { field: "What Makes Us Different", text: data.what_makes_us_different }
];

let locationPasses = 0;
locationChecks.forEach(check => {
  const hasVedAaen = check.text.includes("ved åen");
  const hasAarhusAa = check.text.includes("Aarhus Å");
  const hasVedAaenIAarhus = check.text.includes("ved åen i Aarhus");
  
  let status = "❌";
  let note = "";
  
  if (hasVedAaen && !hasAarhusAa && !hasVedAaenIAarhus) {
    status = "✅";
    locationPasses++;
  } else if (hasVedAaenIAarhus) {
    note = " (has 'ved åen i Aarhus' - adding city name)";
  } else if (hasAarhusAa) {
    note = " (has 'Aarhus Å' - using world knowledge)";
  } else if (!hasVedAaen) {
    note = " (missing 'ved åen')";
  }
  
  console.log(`  ${status} ${check.field}${note}`);
});

console.log(`\n  Result: ${locationPasses}/3 correct`);

// Check 2: Value title/description consistency
console.log("\n\n💎 GEOGRAPHIC CONSISTENCY IN CORE VALUES:\n");

const valueText = data.core_values.join(" | ");
const hasLokalTitle = valueText.toLowerCase().includes("lokal forankring");
const hasLokalDesc = valueText.toLowerCase().includes("lokale produkter");
const hasDanskTitle = valueText.toLowerCase().includes("dansk kvalitet");
const hasDanskDesc = valueText.toLowerCase().includes("danske");

console.log("  Value text includes:");
console.log(`    ${hasLokalTitle ? "✓" : "✗"} 'Lokal forankring' (title)`);
console.log(`    ${hasLokalDesc ? "✓" : "✗"} 'lokale produkter' (description)`);
console.log(`    ${hasDanskTitle ? "✓" : "✗"} 'Dansk kvalitet' (title)`);
console.log(`    ${hasDanskDesc ? "✓" : "✗"} 'danske' (description)`);

console.log("\n  Analysis:");
if (hasLokalTitle && (hasLokalDesc || hasDanskDesc)) {
  if (hasDanskDesc) {
    console.log("    ❌ MISMATCH: Title says 'Lokal' but description says 'danske'");
  } else {
    console.log("    ⚠️  Uses 'lokal' - but suppliers are 90-160km away");
    console.log("    ℹ️  AI doesn't know supplier distances (no distance metadata)");
  }
} else if (hasDanskTitle && hasDanskDesc) {
  console.log("    ✅ CONSISTENT: Both title and description use 'dansk'");
} else {
  console.log("    ❓ No geographic value found");
}

// Check 3: Detailed location references
console.log("\n\n📝 LOCATION REFERENCES IN DETAIL:\n");

locationChecks.forEach(check => {
  console.log(`  ${check.field}:`);
  const matches = check.text.match(/ved [^,.]*/gi) || [];
  if (matches.length > 0) {
    matches.forEach(m => console.log(`    - "${m}"`));
  } else {
    console.log(`    - (no 'ved' reference found)`);
  }
});

console.log("\n" + "━".repeat(80));

console.log("\n\n💡 SUMMARY:\n");
console.log(`  Location consistency: ${locationPasses}/3 fields use ONLY 'ved åen'`);
console.log(`  Geographic values: ${hasLokalTitle && hasDanskDesc ? "Mismatch (lokal title + danske desc)" : hasLokalTitle ? "Uses 'lokal' (can't verify accuracy without distance data)" : "OK"}`);

console.log("\n");
