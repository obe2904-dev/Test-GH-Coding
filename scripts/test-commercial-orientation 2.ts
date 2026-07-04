// Test Layer 2: Commercial Orientation
// Validates AI-generated programme-specific commercial strategy

import { generateCommercialOrientation } from "../supabase/functions/_shared/brand-profile/commercial-orientation.ts";

// Test Case 1: Italian Restaurant (Dinner only, Suburban, Low competition)
const italianRestaurantProgramme = {
  name: "Aftensmad",
  type: "dinner" as const,
  timeWindow: { start: "17:00", end: "22:00" },
  operatingDays: [
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ],
  confidence: "high" as const,
};

const italianBusiness = {
  name: "Trattoria Bella",
  category: "italian_restaurant",
  price_level: 3,
  establishment_type: "restaurant",
};

const italianLocation = {
  area_type: "suburban",
  tourist_context: "low_tourist",
  neighborhood: "Valby",
  city: "København",
  competition_density: "low",
  competition_count: 2,
  top_competitors: [
    { name: "Pizza House", distance_meters: 450, rating: 4.1 },
    { name: "Café Valby", distance_meters: 600, rating: 4.3 },
  ],
};

const italianMenu = {
  price_range: { min: 95, max: 245 },
  item_count: 18,
  has_alcohol: true,
  primary_categories: ["pasta", "pizza", "risotto"],
};

// Test Case 2: Café Faust Frokost (City center, High competition, Tourist zone)
const cafeFaustFrokostProgramme = {
  name: "Frokost",
  type: "lunch" as const,
  timeWindow: { start: "11:00", end: "15:00" },
  operatingDays: [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ],
  confidence: "high" as const,
};

const cafeFaustBusiness = {
  name: "Café Faust",
  category: "café",
  price_level: 2,
  establishment_type: "café",
};

const cafeFaustLocation = {
  area_type: "urban_center",
  tourist_context: "high_tourist",
  neighborhood: "Nyhavn",
  city: "København",
  competition_density: "high",
  competition_count: 12,
  top_competitors: [
    { name: "Café Norden", distance_meters: 120, rating: 4.3 },
    { name: "Conditori La Glace", distance_meters: 200, rating: 4.7 },
    { name: "Royal Smushi Café", distance_meters: 250, rating: 4.5 },
  ],
};

const cafeFaustMenu = {
  price_range: { min: 45, max: 185 },
  item_count: 24,
  has_alcohol: true,
  primary_categories: ["brunch", "frokost", "kaffe"],
};

// Test Case 3: Café Faust Aftensmad (Same location, different programme)
const cafeFaustAftensmadProgramme = {
  name: "Aftensmad",
  type: "dinner" as const,
  timeWindow: { start: "17:00", end: "22:00" },
  operatingDays: [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ],
  confidence: "high" as const,
};

async function runTests() {
  console.log("🧪 Testing Layer 2: Commercial Orientation\n");
  console.log("=" .repeat(60));

  // Test 1: Italian Restaurant (Suburban Dinner)
  console.log("\n📍 TEST 1: Italian Restaurant - Suburban Dinner");
  console.log("-".repeat(60));
  try {
    const result1 = await generateCommercialOrientation(
      italianRestaurantProgramme,
      italianBusiness,
      italianLocation,
      italianMenu
    );

    console.log("✅ Generated successfully\n");
    console.log("Baseline Goal Split:");
    console.log(
      `  - Drive Footfall: ${result1.baseline_goal_split.drive_footfall}%`
    );
    console.log(
      `  - Strengthen Brand: ${result1.baseline_goal_split.strengthen_brand}%`
    );
    console.log(
      `  - Retain Regulars: ${result1.baseline_goal_split.retain_regulars}%`
    );
    console.log(`\nDecision Timing: ${result1.decision_timing}`);
    console.log("\nContent Type Affinity:");
    console.log(`  - Product: ${result1.content_type_affinity.product}%`);
    console.log(`  - Place: ${result1.content_type_affinity.place}%`);
    console.log(`  - Process: ${result1.content_type_affinity.process}%`);
    console.log(`  - Urgency: ${result1.content_type_affinity.urgency}%`);
    console.log(`  - Proof: ${result1.content_type_affinity.proof}%`);
    console.log(`  - Retention: ${result1.content_type_affinity.retention}%`);
    console.log(
      `\nLocation Adjustment: ${result1.location_context_applied.baseline_adjustment}`
    );
    console.log(`\nReasoning: ${result1.reasoning}`);

    // Validate expectations
    if (result1.decision_timing !== "planned_reservation") {
      console.warn(
        "⚠️  Expected decision_timing='planned_reservation' for dinner"
      );
    }
    if (result1.baseline_goal_split.drive_footfall > 50) {
      console.warn(
        "⚠️  Expected lower footfall % for suburban planned dinner"
      );
    }
    if (result1.baseline_goal_split.retain_regulars < 15) {
      console.warn(
        "⚠️  Expected higher retention % for low-competition suburb"
      );
    }
  } catch (error) {
    console.error("❌ Test 1 failed:", error.message);
  }

  // Test 2: Café Faust Frokost (City Center, High Competition)
  console.log("\n📍 TEST 2: Café Faust - City Center Lunch");
  console.log("-".repeat(60));
  try {
    const result2 = await generateCommercialOrientation(
      cafeFaustFrokostProgramme,
      cafeFaustBusiness,
      cafeFaustLocation,
      cafeFaustMenu
    );

    console.log("✅ Generated successfully\n");
    console.log("Baseline Goal Split:");
    console.log(
      `  - Drive Footfall: ${result2.baseline_goal_split.drive_footfall}%`
    );
    console.log(
      `  - Strengthen Brand: ${result2.baseline_goal_split.strengthen_brand}%`
    );
    console.log(
      `  - Retain Regulars: ${result2.baseline_goal_split.retain_regulars}%`
    );
    console.log(`\nDecision Timing: ${result2.decision_timing}`);
    console.log("\nContent Type Affinity:");
    console.log(`  - Product: ${result2.content_type_affinity.product}%`);
    console.log(`  - Place: ${result2.content_type_affinity.place}%`);
    console.log(`  - Process: ${result2.content_type_affinity.process}%`);
    console.log(`  - Urgency: ${result2.content_type_affinity.urgency}%`);
    console.log(`  - Proof: ${result2.content_type_affinity.proof}%`);
    console.log(`  - Retention: ${result2.content_type_affinity.retention}%`);
    console.log(
      `\nLocation Adjustment: ${result2.location_context_applied.baseline_adjustment}`
    );
    console.log(`\nReasoning: ${result2.reasoning}`);

    // Validate expectations
    if (result2.decision_timing !== "spontaneous_walk_in") {
      console.warn(
        "⚠️  Expected decision_timing='spontaneous_walk_in' for lunch"
      );
    }
    if (result2.baseline_goal_split.drive_footfall < 60) {
      console.warn(
        "⚠️  Expected high footfall % (60-70%) for city center lunch + high competition"
      );
    }
    if (result2.baseline_goal_split.retain_regulars > 15) {
      console.warn(
        "⚠️  Expected low retention % for tourist zone (tourists don't return)"
      );
    }
    if (result2.content_type_affinity.product < 30) {
      console.warn(
        "⚠️  Expected high Product affinity for spontaneous footfall"
      );
    }
    if (result2.content_type_affinity.urgency < 20) {
      console.warn(
        "⚠️  Expected high Urgency affinity for spontaneous footfall"
      );
    }
  } catch (error) {
    console.error("❌ Test 2 failed:", error.message);
  }

  // Test 3: Café Faust Aftensmad (Same location, different strategy)
  console.log("\n📍 TEST 3: Café Faust - City Center Dinner");
  console.log("-".repeat(60));
  try {
    const result3 = await generateCommercialOrientation(
      cafeFaustAftensmadProgramme,
      cafeFaustBusiness,
      cafeFaustLocation,
      cafeFaustMenu
    );

    console.log("✅ Generated successfully\n");
    console.log("Baseline Goal Split:");
    console.log(
      `  - Drive Footfall: ${result3.baseline_goal_split.drive_footfall}%`
    );
    console.log(
      `  - Strengthen Brand: ${result3.baseline_goal_split.strengthen_brand}%`
    );
    console.log(
      `  - Retain Regulars: ${result3.baseline_goal_split.retain_regulars}%`
    );
    console.log(`\nDecision Timing: ${result3.decision_timing}`);
    console.log("\nContent Type Affinity:");
    console.log(`  - Product: ${result3.content_type_affinity.product}%`);
    console.log(`  - Place: ${result3.content_type_affinity.place}%`);
    console.log(`  - Process: ${result3.content_type_affinity.process}%`);
    console.log(`  - Urgency: ${result3.content_type_affinity.urgency}%`);
    console.log(`  - Proof: ${result3.content_type_affinity.proof}%`);
    console.log(`  - Retention: ${result3.content_type_affinity.retention}%`);
    console.log(
      `\nLocation Adjustment: ${result3.location_context_applied.baseline_adjustment}`
    );
    console.log(`\nReasoning: ${result3.reasoning}`);

    // Validate expectations
    if (result3.decision_timing !== "planned_reservation") {
      console.warn(
        "⚠️  Expected decision_timing='planned_reservation' or 'mixed' for dinner"
      );
    }
    if (result3.baseline_goal_split.drive_footfall > 50) {
      console.warn(
        "⚠️  Expected moderate footfall % (30-40%) for planned dinner even in city center"
      );
    }
    if (result3.content_type_affinity.product > 30) {
      console.warn(
        "⚠️  Expected lower Product affinity for planned visits (focus shifts to Place/Process)"
      );
    }
    if (
      result3.content_type_affinity.place +
        result3.content_type_affinity.process <
      30
    ) {
      console.warn(
        "⚠️  Expected higher Place+Process affinity for brand-building dinner content"
      );
    }
  } catch (error) {
    console.error("❌ Test 3 failed:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ All tests completed!");
  console.log(
    "\nKEY VALIDATION: Same business (Café Faust), different programmes → OPPOSITE strategies"
  );
  console.log("  - Frokost (lunch): High footfall, spontaneous, Product+Urgency");
  console.log(
    "  - Aftensmad (dinner): Lower footfall, planned, Place+Process+Brand"
  );
}

runTests();
