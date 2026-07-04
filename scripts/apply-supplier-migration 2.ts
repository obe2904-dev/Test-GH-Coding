import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("\n📝 Applying Migration: Add supplier_analysis column\n");
console.log("━".repeat(80));

const migrationSQL = `
ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS supplier_analysis JSONB DEFAULT NULL;

COMMENT ON COLUMN business_location_intelligence.supplier_analysis IS 
'Supplier location and distance analysis extracted from menu items. Used for factual geographic claims in brand profile.';
`;

const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

if (error) {
  console.error("❌ Migration failed:", error);
  
  // Fallback: Try direct query (if RPC doesn't exist)
  console.log("\n🔄 Trying alternative method...\n");
  
  const { error: altError } = await supabase
    .from("business_location_intelligence")
    .select("supplier_analysis")
    .limit(1);
  
  if (altError && altError.message.includes("column")) {
    console.log("❌ Column doesn't exist yet. Please run migration SQL in Supabase Dashboard:");
    console.log("\n" + migrationSQL);
    console.log("\nGo to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new");
  } else {
    console.log("✅ Column already exists!");
  }
} else {
  console.log("✅ Migration applied successfully!");
}

console.log("\n" + "━".repeat(80) + "\n");
