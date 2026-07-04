import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("\n🔍 Checking if supplier_analysis column exists...\n");

const { data, error } = await supabase
  .from("business_location_intelligence")
  .select("supplier_analysis")
  .limit(1);

if (error) {
  if (error.message.includes("column") && error.message.includes("does not exist")) {
    console.log("❌ Column 'supplier_analysis' does NOT exist yet.\n");
    console.log("━".repeat(80));
    console.log("\n📋 Please run this SQL in Supabase Dashboard:\n");
    console.log("URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new\n");
    console.log("SQL:");
    console.log("━".repeat(80));
    console.log(`
ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS supplier_analysis JSONB DEFAULT NULL;

COMMENT ON COLUMN business_location_intelligence.supplier_analysis IS 
'Supplier location and distance analysis extracted from menu items. Used for factual geographic claims in brand profile.';
`);
    console.log("━".repeat(80));
    console.log("\nAfter running the SQL, run the extraction script:");
    console.log("deno run --allow-net --allow-env --allow-read --env-file=.env scripts/extract-supplier-distances.ts\n");
    Deno.exit(1);
  } else {
    console.log("❌ Unexpected error:", error);
    Deno.exit(1);
  }
} else {
  console.log("✅ Column 'supplier_analysis' exists!\n");
  console.log("Ready to run extraction script.");
  Deno.exit(0);
}
