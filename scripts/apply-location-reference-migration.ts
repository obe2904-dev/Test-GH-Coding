import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("📦 Applying local_location_reference migration...\n");
console.log("⚠️  Note: Run the SQL migration file in Supabase Dashboard first:");
console.log("   supabase/migrations/20260507000000_add_local_location_reference.sql\n");

// Update Café Faust with the correct local reference
console.log("📍 Updating Café Faust with 'ved åen'...");

const { error: updateError } = await supabase
  .from("business_location_intelligence")
  .update({
    local_location_reference: "ved åen",
    local_location_reference_source: "user_provided",
    local_location_reference_updated_at: new Date().toISOString()
  })
  .eq("business_id", "2037d63c-a138-4247-89c5-5b6b8cef9f3f");

if (updateError) {
  console.error("❌ Update error:", updateError.message);
  console.log("\n💡 If columns don't exist, run this SQL in Supabase Dashboard:\n");
  console.log(`ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS local_location_reference text,
ADD COLUMN IF NOT EXISTS local_location_reference_source text,
ADD COLUMN IF NOT EXISTS local_location_reference_updated_at timestamptz;
`);
  Deno.exit(1);
}

console.log("✅ Update successful\n");

// Verify
console.log("📍 Verifying Café Faust location reference...");

const { data, error } = await supabase
  .from("business_location_intelligence")
  .select("local_location_reference, local_location_reference_source, local_location_reference_updated_at")
  .eq("business_id", "2037d63c-a138-4247-89c5-5b6b8cef9f3f")
  .single();

if (error) {
  console.error("❌ Error:", error);
} else {
  console.log("\n✅ Café Faust:");
  console.log(`   local_location_reference: "${data.local_location_reference}"`);
  console.log(`   source: ${data.local_location_reference_source}`);
  console.log(`   updated_at: ${data.local_location_reference_updated_at}`);
}
