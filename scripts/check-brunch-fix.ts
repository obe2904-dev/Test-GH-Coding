import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

const { data: profile } = await supabase
  .from("business_brand_profile")
  .select("brand_essence, positioning, core_values, what_makes_us_different")
  .eq("business_id", businessId)
  .single();

console.log("\n✨ Updated Brand Profile\n");
console.log("━".repeat(80));

console.log("\n📋 Brand Essence:");
console.log(`   ${profile?.brand_essence}\n`);

console.log("📍 Positioning:");
console.log(`   ${profile?.positioning}\n`);

console.log("💎 Core Values:");
profile?.core_values?.forEach((v: string, i: number) => {
  console.log(`   ${i + 1}. ${v}`);
});

console.log("\n🎯 What Makes Us Different:");
console.log(`   ${profile?.what_makes_us_different}\n`);

console.log("━".repeat(80));

// Check for morgenmad
const hasProblems = [];
if (profile?.brand_essence?.toLowerCase().includes("morgenmad")) {
  hasProblems.push("❌ Brand Essence says 'morgenmad'");
}
if (profile?.positioning?.toLowerCase().includes("morgenmad")) {
  hasProblems.push("❌ Positioning says 'morgenmad'");
}
if (profile?.core_values?.some((v: string) => v.toLowerCase().includes("morgenmad"))) {
  hasProblems.push("❌ Core Values say 'morgenmad'");
}
if (profile?.what_makes_us_different?.toLowerCase().includes("morgenmad")) {
  hasProblems.push("❌ What Makes Us Different says 'morgenmad'");
}

if (hasProblems.length > 0) {
  console.log("\n⚠️  Issues Found:\n");
  hasProblems.forEach(p => console.log(`   ${p}`));
} else {
  console.log("\n✅ No 'morgenmad' found - using 'brunch' correctly!\n");
}

// Check for brunch mentions
const hasBrunch = [];
if (profile?.brand_essence?.toLowerCase().includes("brunch")) {
  hasBrunch.push("✓ Brand Essence mentions brunch");
}
if (profile?.positioning?.toLowerCase().includes("brunch")) {
  hasBrunch.push("✓ Positioning mentions brunch");
}
if (profile?.core_values?.some((v: string) => v.toLowerCase().includes("brunch"))) {
  hasBrunch.push("✓ Core Values mention brunch");
}
if (profile?.what_makes_us_different?.toLowerCase().includes("brunch")) {
  hasBrunch.push("✓ What Makes Us Different mentions brunch");
}

if (hasBrunch.length > 0) {
  console.log("📝 Brunch mentions:\n");
  hasBrunch.forEach(b => console.log(`   ${b}`));
  console.log();
}

console.log("━".repeat(80) + "\n");
