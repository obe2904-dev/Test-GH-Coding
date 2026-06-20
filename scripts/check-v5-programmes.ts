import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openAiKey = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);
const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

// Invoke V5 to see what programmes are detected
const response = await fetch(`${supabaseUrl}/functions/v1/brand-profile-generator-v5`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify({
    businessId: businessId
  })
});

const data = await response.json();

console.log("\n📋 Programme Names from V5:\n");
if (data.programmes) {
  data.programmes.forEach((p: any) => {
    console.log(`   Type: ${p.type}`);
    console.log(`   Name: "${p.name}"`);
    console.log(`   Time: ${p.timeWindow.start} - ${p.timeWindow.end}`);
    console.log();
  });
} else {
  console.log("No programmes in response");
}
