import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

console.log("\n🔍 Analyzing Menu Data for Supplier Information...\n");
console.log("━".repeat(80));

// Get menu items
const { data: menuItems, error } = await supabase
  .from("menu_items_normalized")
  .select("*")
  .eq("business_id", businessId);

if (error) {
  console.error("Error:", error);
  Deno.exit(1);
}

if (!menuItems || menuItems.length === 0) {
  console.log("No menu items found");
  Deno.exit(1);
}

console.log("\n📋 Menu Items:");
console.log("  Total items:", menuItems.length);

// Analyze items for supplier mentions
const supplierMentions: Array<{item: string, description: string, suppliers: string[]}> = [];

menuItems.forEach((item: any) => {
  const desc = (item.description || "").toLowerCase();
  const name = (item.name || "").toLowerCase();
  const text = `${name} ${desc}`;
  
  const suppliers: string[] = [];
  
  // Look for known Danish supplier patterns
  if (text.includes("højer")) suppliers.push("Højer");
  if (text.includes("tange sø") || text.includes("tange")) suppliers.push("Tange Sø");
  if (text.includes("thise")) suppliers.push("Thise");
  if (text.includes("fanø")) suppliers.push("Fanø");
  if (text.includes("bornholm")) suppliers.push("Bornholm");
  
  // Generic patterns
  if (text.match(/fra \w+/)) {
    const match = text.match(/fra (\w+)/);
    if (match) suppliers.push(match[1]);
  }
  
  if (suppliers.length > 0) {
    supplierMentions.push({
      item: item.name,
      description: item.description || "",
      suppliers
    });
  }
});

console.log("\n\n🏭 Supplier Mentions Found:");
console.log(`  Total items with suppliers: ${supplierMentions.length}\n`);

supplierMentions.forEach(mention => {
  console.log(`  📦 ${mention.item}`);
  console.log(`     Description: ${mention.description.substring(0, 80)}...`);
  console.log(`     Suppliers: ${mention.suppliers.join(", ")}`);
  console.log();
});

console.log("\n" + "━".repeat(80));

console.log("\n\n💡 DATA ENRICHMENT PLAN:\n");
console.log("  Option 1: Extract suppliers during menu processing");
console.log("    - Parse menu item descriptions for location names");
console.log("    - Store in menu_items table: supplier_name, supplier_location");
console.log("    - Calculate distance from business location");
console.log("");
console.log("  Option 2: Add to location intelligence");
console.log("    - Aggregate supplier locations per business");
console.log("    - Store in business_location_intelligence.supplier_analysis JSONB");
console.log("    - Structure: {name, location, distance_km, category}[]");
console.log("");
console.log("  RECOMMENDATION: Option 2");
console.log("    - Business-level aggregation (matches Layer 3 scope)");
console.log("    - Single source of truth");
console.log("    - No menu schema changes needed");

console.log("\n");
