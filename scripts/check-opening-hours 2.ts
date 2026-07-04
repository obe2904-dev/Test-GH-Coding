import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f"; // Café Faust

console.log("\n🕐 Checking opening_hours table for Café Faust...\n");

const { data, error } = await supabase
  .from("opening_hours")
  .select("*")
  .eq("business_id", businessId);

if (error) {
  console.error("Error:", error);
  Deno.exit(1);
}

console.log("Opening hours records:", data?.length || 0);
console.log("\n" + JSON.stringify(data, null, 2));

// Also check business_operations table
console.log("\n\n🏢 Checking business_operations table...\n");

const { data: ops, error: opsError } = await supabase
  .from("business_operations")
  .select("operating_hours")
  .eq("business_id", businessId)
  .single();

if (opsError) {
  console.error("Error:", opsError);
} else {
  console.log("Operating hours from business_operations:");
  console.log(JSON.stringify(ops?.operating_hours, null, 2));
}
