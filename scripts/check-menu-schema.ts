import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

const { data, error } = await supabase
  .from("menu_items_normalized")
  .select("*")
  .eq("business_id", businessId)
  .limit(5);

if (error) {
  console.error("Error:", error);
  Deno.exit(1);
}

console.log("\n📋 Menu Items Normalized Schema:\n");
console.log("Fields:", Object.keys(data![0] || {}));
console.log("\n\nSample Data:");
console.log(JSON.stringify(data, null, 2));
