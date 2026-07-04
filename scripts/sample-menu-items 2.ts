import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

const { data, error } = await supabase
  .from("menu_items_normalized")
  .select("name, description, category")
  .eq("business_id", businessId)
  .limit(20);

if (error) {
  console.error("Error:", error);
  Deno.exit(1);
}

console.log("\n📋 Sample Menu Items from Café Faust:\n");
console.log("━".repeat(80));

data?.forEach((item, i) => {
  console.log(`\n${i + 1}. ${item.name}`);
  console.log(`   Category: ${item.category || "N/A"}`);
  console.log(`   Description: ${item.description || "N/A"}`);
});

console.log("\n" + "━".repeat(80));

// Search for specific mentions
const { data: searchResults, error: searchError } = await supabase
  .from("menu_items_normalized")
  .select("*")
  .eq("business_id", businessId)
  .or("description.ilike.%højer%,description.ilike.%tange%,name.ilike.%højer%,name.ilike.%tange%");

console.log("\n\n🔍 Items mentioning Højer or Tange:");
if (searchResults && searchResults.length > 0) {
  searchResults.forEach(item => {
    console.log(`\n  - ${item.name}`);
    console.log(`    ${item.description}`);
  });
} else {
  console.log("  None found");
}

console.log("\n");
