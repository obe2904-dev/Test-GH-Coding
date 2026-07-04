import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

const { data, error } = await supabase
  .from("business_location_intelligence")
  .select("*")
  .eq("business_id", businessId)
  .single();

if (error) {
  console.error("Error:", error);
  Deno.exit(1);
}

console.log("\n📋 Location Intelligence Schema:\n");
console.log("Fields:", Object.keys(data || {}));
console.log("\n\nData:");
console.log(JSON.stringify(data, null, 2));
