import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

const { data: programmes } = await supabase
  .from("business_programme_profiles")
  .select("programme_type, programme_name, audience_segments")
  .eq("business_id", businessId)
  .order("programme_type");

console.log("\n📊 LAYER 4 AUDIENCE SEGMENTS - COMPLETE ANALYSIS\n");
console.log("━".repeat(80) + "\n");

for (const programme of programmes || []) {
  const isBrunch = programme.programme_name?.includes("Morgenmad/Brunch");
  
  console.log(`🍽️  ${programme.programme_name} (${programme.programme_type})`);
  if (isBrunch) {
    console.log(`   ⚠️  BRUNCH PROGRAMME - must use brunch behavior, not morgenmad/breakfast\n`);
  } else {
    console.log("");
  }
  
  const segments = programme.audience_segments;
  
  if (!segments || !Array.isArray(segments)) {
    console.log("   No segments\n");
    continue;
  }
  
  for (const segment of segments) {
    console.log(`   📍 ${segment.label}`);
    console.log(`      Size: ${segment.segment_size} | Motivation: ${segment.motivation} | Decision: ${segment.decision_timing}`);
    console.log(`      Goal: ${segment.goal_contribution}`);
    
    if (Array.isArray(segment.timing_windows)) {
      console.log(`      ⏰ Timing: ${segment.timing_windows.join(", ")}`);
    }
    
    if (Array.isArray(segment.content_angles)) {
      console.log(`      💡 Content Angles:`);
      segment.content_angles.forEach((angle: string) => {
        console.log(`         - ${angle}`);
      });
    }
    
    // Validation for brunch programme
    if (isBrunch) {
      const warnings = [];
      
      // Check for breakfast-like timing (before 10:00) with convenience motivation
      if (segment.motivation === "convenience" && segment.timing_windows) {
        segment.timing_windows.forEach((window: string) => {
          const match = window.match(/(\d{2}):(\d{2})/);
          if (match && parseInt(match[1]) < 10) {
            warnings.push("⚠️  Convenience motivation with early timing (<10:00) suggests breakfast behavior");
          }
        });
      }
      
      // Check for morgenmad in text
      const textToCheck = [
        segment.label,
        ...(segment.content_angles || []),
        ...(segment.evidence || [])
      ].join(" ").toLowerCase();
      
      if (textToCheck.includes("morgenmad")) {
        warnings.push("❌ Contains 'morgenmad' - should use 'brunch'");
      }
      
      if (warnings.length > 0) {
        console.log(`      🚨 Issues:`);
        warnings.forEach(w => console.log(`         ${w}`));
      } else {
        console.log(`      ✅ Brunch behavior correct`);
      }
    }
    
    console.log("");
  }
}

console.log("━".repeat(80) + "\n");
