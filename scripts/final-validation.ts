import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

const { data: profile } = await supabase
  .from("business_brand_profile")
  .select("*")
  .eq("business_id", businessId)
  .single();

console.log("\n🎯 FINAL VALIDATION - 100% FACTUAL ACCURACY CHECK\n");
console.log("━".repeat(80) + "\n");

// Test 1: Location Consistency
console.log("1️⃣  LOCATION CONSISTENCY (should use ONLY 'ved åen'):\n");
const locationChecks = [
  { field: "Brand Essence", text: profile?.brand_essence, pass: !profile?.brand_essence?.toLowerCase().includes("aarhus å") },
  { field: "Positioning", text: profile?.positioning, pass: !profile?.positioning?.toLowerCase().includes("aarhus å") },
  { field: "What Makes Us Different", text: profile?.what_makes_us_different, pass: !profile?.what_makes_us_different?.toLowerCase().includes("aarhus å") }
];

locationChecks.forEach(check => {
  console.log(`   ${check.pass ? '✅' : '❌'} ${check.field}`);
});

const locationPassed = locationChecks.every(c => c.pass);
console.log(`\n   Result: ${locationPassed ? '✅ PASS' : '❌ FAIL'} - ${locationChecks.filter(c => c.pass).length}/3 correct\n`);

// Test 2: Geographic Accuracy
console.log("2️⃣  GEOGRAPHIC ACCURACY (should be 'Regional forankring - regionale råvarer'):\n");
const regionalValue = profile?.core_values?.find((v: string) => 
  v.toLowerCase().includes('regional') || 
  v.toLowerCase().includes('lokal') || 
  v.toLowerCase().includes('dansk')
);

console.log(`   Value: "${regionalValue}"\n`);

const geographicPassed = regionalValue?.toLowerCase().includes('regional') && 
                        regionalValue?.toLowerCase().includes('regionale') &&
                        !regionalValue?.toLowerCase().includes('lokal forankring') &&
                        !regionalValue?.toLowerCase().includes('danske');

console.log(`   ${geographicPassed ? '✅' : '❌'} Uses "Regional forankring" (not "Lokal")`);
console.log(`   ${geographicPassed ? '✅' : '❌'} Uses "regionale råvarer" (not "danske")`);
console.log(`\n   Result: ${geographicPassed ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Brunch Naming
console.log("3️⃣  BRUNCH NAMING (should say 'brunch', NEVER 'morgenmad'):\n");

const hasMorgenmad = [
  profile?.brand_essence?.toLowerCase().includes('morgenmad'),
  profile?.positioning?.toLowerCase().includes('morgenmad'),
  profile?.core_values?.some((v: string) => v.toLowerCase().includes('morgenmad')),
  profile?.what_makes_us_different?.toLowerCase().includes('morgenmad')
].some(x => x);

const hasBrunch = [
  profile?.brand_essence?.toLowerCase().includes('brunch'),
  profile?.core_values?.some((v: string) => v.toLowerCase().includes('brunch'))
].some(x => x);

console.log(`   ${!hasMorgenmad ? '✅' : '❌'} No 'morgenmad' found`);
console.log(`   ${hasBrunch ? '✅' : '❌'} Uses 'brunch' correctly`);
console.log(`\n   Result: ${!hasMorgenmad && hasBrunch ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: Day-Specific Opening Hours
console.log("4️⃣  DAY-SPECIFIC OPENING HOURS (should mention exact times):\n");

const hourValue = profile?.core_values?.find((v: string) => 
  v.toLowerCase().includes('åbent') || 
  v.toLowerCase().includes('tilgængelig')
);

console.log(`   Value: "${hourValue}"\n`);

const hasExactTimes = hourValue?.includes('09:30') && hourValue?.includes('09:00');
const hasDaySpecific = hourValue?.toLowerCase().includes('hverdage') && hourValue?.toLowerCase().includes('weekend');

console.log(`   ${hasExactTimes ? '✅' : '❌'} Includes exact times (09:30, 09:00)`);
console.log(`   ${hasDaySpecific ? '✅' : '❌'} Distinguishes weekdays vs weekends`);
console.log(`\n   Result: ${hasExactTimes && hasDaySpecific ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 5: No Hallucinations
console.log("5️⃣  NO HALLUCINATIONS (no invented facilities/features):\n");

const allText = [
  profile?.brand_essence,
  profile?.positioning,
  profile?.what_makes_us_different,
  ...(profile?.core_values || [])
].join(' ').toLowerCase();

const hallucinations = [
  { term: 'terrasse', found: allText.includes('terrasse') },
  { term: 'udendørs', found: allText.includes('udendørs') },
  { term: 'have', found: allText.includes('have') },
  { term: 'koncert', found: allText.includes('koncert') },
  { term: 'live musik', found: allText.includes('live musik') }
];

hallucinations.forEach(h => {
  console.log(`   ${!h.found ? '✅' : '❌'} No mention of '${h.term}'`);
});

const noHallucinations = hallucinations.every(h => !h.found);
console.log(`\n   Result: ${noHallucinations ? '✅ PASS' : '❌ FAIL'}\n`);

// Overall Result
console.log("━".repeat(80) + "\n");
const allPassed = locationPassed && geographicPassed && !hasMorgenmad && hasBrunch && hasExactTimes && hasDaySpecific && noHallucinations;

if (allPassed) {
  console.log("🎉 FINAL RESULT: ✅ 100% FACTUAL ACCURACY ACHIEVED!\n");
  console.log("All improvements working correctly:");
  console.log("  ✅ Location naming consistent (ved åen)");
  console.log("  ✅ Geographic claims accurate (Regional forankring - regionale råvarer)");
  console.log("  ✅ Brunch naming correct (no morgenmad)");
  console.log("  ✅ Day-specific opening hours (09:30 hverdage, 09:00 weekend)");
  console.log("  ✅ No hallucinated facilities\n");
} else {
  console.log("❌ FINAL RESULT: ISSUES REMAINING\n");
  if (!locationPassed) console.log("  ❌ Location naming inconsistent");
  if (!geographicPassed) console.log("  ❌ Geographic claims inaccurate");
  if (hasMorgenmad || !hasBrunch) console.log("  ❌ Brunch naming incorrect");
  if (!hasExactTimes || !hasDaySpecific) console.log("  ❌ Opening hours not day-specific");
  if (!noHallucinations) console.log("  ❌ Hallucinated facilities present");
  console.log();
}

console.log("━".repeat(80) + "\n");
