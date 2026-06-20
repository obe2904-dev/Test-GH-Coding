import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f"; // Café Faust

const { data, error } = await supabase
  .from("business_brand_profile")
  .select("brand_essence, positioning, core_values, what_makes_us_different")
  .eq("business_id", businessId)
  .single();

if (error) {
  console.error("Error:", error);
  Deno.exit(1);
}

console.log("\n🎯 Brand Identity for Café Faust:\n");
console.log("━".repeat(80));
console.log("\n📝 Brand Essence:");
console.log(data.brand_essence);

console.log("\n\n📍 Positioning:");
console.log(data.positioning);

console.log("\n\n💎 Core Values:");
data.core_values.forEach((value: string, i: number) => {
  console.log(`  ${i + 1}. ${value}`);
});

console.log("\n\n✨ What Makes Us Different:");
console.log(data.what_makes_us_different);

console.log("\n" + "━".repeat(80));

// Check for improvements
console.log("\n\n✅ IMPROVEMENT CHECKS:\n");

const allText = `${data.brand_essence} ${data.positioning} ${data.core_values.join(' ')} ${data.what_makes_us_different}`.toLowerCase();

// Check 1: Location reference
const hasAaen = allText.includes("ved åen");
const hasHavnefront = allText.includes("havnefront") || allText.includes("havnen");
console.log(`Location: ${hasAaen ? '✅ "ved åen"' : '❌ Missing "ved åen"'} ${hasHavnefront ? '⚠️  Still says "havnefront/havnen"' : ''}`);

// Check 2: Geographic terms
const hasLokal = allText.includes("lokal");
const hasRegional = allText.includes("regional");
const hasDansk = allText.includes("dansk");
console.log(`Geographic: ${hasLokal ? '⚠️  Uses "lokal"' : ''} ${hasRegional ? '✅ Uses "regional"' : ''} ${hasDansk ? '✅ Uses "dansk"' : ''}`);

// Check 3: Hallucinations
const hasBarnevogne = allText.includes("barnevogn");
const hasWheelchair = allText.includes("wheelchair") || allText.includes("tilgængelig");
const hasSenNat = allText.includes("sen nat") && allText.includes("mad");
console.log(`Hallucinations: ${hasBarnevogne ? '❌ Still mentions "barnevogne"' : '✅ No "barnevogne"'}`);
console.log(`                ${hasSenNat ? '❌ Still claims "sen nat mad"' : '✅ No "sen nat mad"'}`);

// Check 4: Homemade claims
const hasHjemmelavet = allText.includes("hjemmelavet");
const hasHjemmelavedeCocktails = allText.includes("hjemmelavede cocktail");
console.log(`Homemade: ${hasHjemmelavet ? '✅ Mentions "hjemmelavet"' : ''} ${hasHjemmelavedeCocktails ? '❌ Still claims "hjemmelavede cocktails"' : '✅ No overgeneralization'}`);
