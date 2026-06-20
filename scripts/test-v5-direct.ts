import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openAiKey = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

console.log("\n🎨 Generating Brand Profile with Supplier Analysis...\n");
console.log("━".repeat(80));

const response = await fetch(`${supabaseUrl}/functions/v1/brand-profile-generator-v5`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify({
    businessId: businessId,  // Use camelCase
    forceRegenerate: true  // Force regeneration to test supplier analysis
  })
});

const responseText = await response.text();
console.log("\n📋 Response Status:", response.status);
console.log("Response Headers:", Object.fromEntries(response.headers.entries()));

if (!response.ok) {
  console.log("\n❌ Error Response:");
  console.log(responseText);
  Deno.exit(1);
}

const data = JSON.parse(responseText);
console.log("\n✅ Success!");
console.log(JSON.stringify(data, null, 2));
