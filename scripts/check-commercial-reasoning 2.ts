import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f"; // Café Faust

const { data, error } = await supabase
  .from("business_programme_profiles")
  .select("programme_name, commercial_reasoning")
  .eq("business_id", businessId)
  .not("commercial_reasoning", "is", null)
  .order("programme_name");

if (error) {
  console.error("Error:", error);
  Deno.exit(1);
}

console.log("\n🔍 Commercial Reasoning for Café Faust:\n");

for (const programme of data) {
  console.log(`\n📋 ${programme.programme_name}:`);
  console.log(programme.commercial_reasoning);
  console.log("\n" + "=".repeat(80));
}

// Check for competition mentions
console.log("\n\n✅ COMPETITION MENTIONS:\n");
for (const programme of data) {
  const reasoning = programme.commercial_reasoning.toLowerCase();
  const hasHigh = reasoning.includes("høj") || reasoning.includes("high");
  const hasCount = reasoning.includes("16");
  const hasCompetition = reasoning.includes("konkurrence") || reasoning.includes("competition");
  
  console.log(`${programme.programme_name}:`);
  console.log(`  - Mentions "høj/high": ${hasHigh ? '✅' : '❌'}`);
  console.log(`  - Mentions "16": ${hasCount ? '✅' : '❌'}`);
  console.log(`  - Mentions competition: ${hasCompetition ? '✅' : '❌'}`);
}
