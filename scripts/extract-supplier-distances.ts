/**
 * Extract Supplier Distance Data from Menu Items
 * 
 * Parses menu item descriptions for supplier location mentions,
 * calculates distances, and stores in business_location_intelligence.
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read --env-file=.env \
 *     scripts/extract-supplier-distances.ts [business_id]
 */

import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import {
  DANISH_LOCATIONS,
  calculateDistance,
  findLocation,
  getGeographicScope,
  extractLocationMentions,
} from "./danish-locations.ts";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Get business ID from args or use Café Faust as default
const businessId = Deno.args[0] || "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

console.log("\n🔍 Extracting Supplier Distance Data\n");
console.log("━".repeat(80));

// 1. Get business info
const { data: business, error: businessError } = await supabase
  .from("businesses")
  .select("name")
  .eq("id", businessId)
  .single();

if (businessError || !business) {
  console.error("❌ Error fetching business:", businessError);
  Deno.exit(1);
}

// 2. Get location intelligence (has city/neighborhood info)
const { data: locationIntel, error: locationError } = await supabase
  .from("business_location_intelligence")
  .select("neighborhood, latitude, longitude")
  .eq("business_id", businessId)
  .single();

if (locationError || !locationIntel) {
  console.error("❌ Error fetching location intelligence:", locationError);
  Deno.exit(1);
}

console.log("\n📍 Business:", business.name);
console.log("   Location:", locationIntel.neighborhood || "N/A");
console.log("   Coordinates:", locationIntel.latitude || "N/A", locationIntel.longitude || "N/A");

// Use actual coordinates if available, otherwise lookup by city name
let businessLocation;
if (locationIntel.latitude && locationIntel.longitude) {
  businessLocation = {
    lat: locationIntel.latitude,
    lng: locationIntel.longitude,
    name: locationIntel.neighborhood || "Unknown"
  };
  console.log(`   Using actual coordinates from database`);
} else {
  // Fallback to location lookup
  const city = locationIntel.neighborhood || "Aarhus";
  businessLocation = findLocation(city);
  if (!businessLocation) {
    console.error(`❌ City "${city}" not found in locations database`);
    console.log("\n💡 Add this city to scripts/danish-locations.ts");
    Deno.exit(1);
  }
  console.log(`   Using coordinates from locations database`);
}

// 2. Get menu items
const { data: menuItems, error: menuError } = await supabase
  .from("menu_items_normalized")
  .select("item_name, item_description, category_name")
  .eq("business_id", businessId);

if (menuError) {
  console.error("❌ Error fetching menu items:", menuError);
  Deno.exit(1);
}

if (!menuItems || menuItems.length === 0) {
  console.log("\n⚠️  No menu items found for this business");
  Deno.exit(0);
}

console.log(`\n📋 Analyzing ${menuItems.length} menu items...\n`);

// 3. Extract supplier mentions
interface SupplierMention {
  supplierName: string;
  itemName: string;
  category: string;
  distance?: number;
  found: boolean;
}

const mentions: SupplierMention[] = [];

menuItems.forEach((item) => {
  if (!item.item_description) return;
  
  const locations = extractLocationMentions(item.item_description);
  
  locations.forEach((locationName) => {
    const location = findLocation(locationName);
    
    if (location) {
      const distance = calculateDistance(
        businessLocation.lat,
        businessLocation.lng,
        location.lat,
        location.lng
      );
      
      mentions.push({
        supplierName: locationName,
        itemName: item.item_name,
        category: item.category_name || "unknown",
        distance,
        found: true,
      });
    } else {
      // Location mentioned but not in our database
      mentions.push({
        supplierName: locationName,
        itemName: item.item_name,
        category: item.category_name || "unknown",
        found: false,
      });
    }
  });
});

console.log("🏭 Supplier Mentions:\n");

if (mentions.length === 0) {
  console.log("   No supplier locations found in menu descriptions");
  console.log("\n💡 Menu items don't mention specific locations like 'from Højer'");
  Deno.exit(0);
}

// Group by supplier
const supplierGroups = new Map<string, SupplierMention[]>();
mentions.forEach((mention) => {
  const existing = supplierGroups.get(mention.supplierName) || [];
  existing.push(mention);
  supplierGroups.set(mention.supplierName, existing);
});

// Display findings
supplierGroups.forEach((mentions, supplierName) => {
  const firstMention = mentions[0];
  
  if (firstMention.found && firstMention.distance !== undefined) {
    const scope = getGeographicScope(firstMention.distance);
    console.log(`   ✅ ${supplierName}`);
    console.log(`      Distance: ${firstMention.distance} km (${scope})`);
    console.log(`      Mentioned in: ${mentions.map(m => m.itemName).join(", ")}`);
  } else {
    console.log(`   ⚠️  ${supplierName} (not in locations database)`);
    console.log(`      Mentioned in: ${mentions.map(m => m.itemName).join(", ")}`);
  }
  console.log();
});

// 4. Aggregate supplier analysis
const suppliers = Array.from(supplierGroups.entries())
  .filter(([_, mentions]) => mentions[0].found)
  .map(([supplierName, mentions]) => {
    const mention = mentions[0];
    return {
      name: supplierName,
      type: "location" as const,
      distance_km: mention.distance!,
      verified: true,
      mentioned_in: mentions.map(m => `${m.itemName} (${m.category})`),
    };
  });

const localCount = suppliers.filter(s => s.distance_km < 30).length;
const regionalCount = suppliers.filter(s => s.distance_km >= 30 && s.distance_km < 100).length;
const nationalCount = suppliers.filter(s => s.distance_km >= 100).length;

let geographicScope: "local" | "regional" | "national";
if (localCount > 0) {
  geographicScope = "local";
} else if (regionalCount > 0) {
  geographicScope = "regional";
} else {
  geographicScope = "national";
}

const supplierAnalysis = {
  suppliers,
  geographic_scope: geographicScope,
  local_count: localCount,
  regional_count: regionalCount,
  national_count: nationalCount,
  updated_at: new Date().toISOString(),
};

console.log("━".repeat(80));
console.log("\n📊 Geographic Analysis:\n");
console.log(`   Total suppliers: ${suppliers.length}`);
console.log(`   Local (<30km): ${localCount}`);
console.log(`   Regional (30-100km): ${regionalCount}`);
console.log(`   National (>100km): ${nationalCount}`);
console.log(`   \n   Geographic Scope: ${geographicScope.toUpperCase()}`);

// 5. Store in database
console.log("\n💾 Saving to business_location_intelligence...\n");

const { error: updateError } = await supabase
  .from("business_location_intelligence")
  .update({ supplier_analysis: supplierAnalysis })
  .eq("business_id", businessId);

if (updateError) {
  console.error("❌ Error updating database:", updateError);
  Deno.exit(1);
}

console.log("✅ Supplier analysis saved successfully!\n");
console.log("━".repeat(80));

console.log("\n📝 Stored Data:\n");
console.log(JSON.stringify(supplierAnalysis, null, 2));

console.log("\n\n🎯 Impact on Brand Profile:\n");
if (geographicScope === "local") {
  console.log('   Layer 3 will use: "Lokal forankring" + "lokale produkter"');
} else if (geographicScope === "regional") {
  console.log('   Layer 3 will use: "Regional forankring" or "Dansk kvalitet" + "regionale/danske råvarer"');
} else {
  console.log('   Layer 3 will use: "Dansk kvalitet" + "danske råvarer"');
}

console.log("\n");
