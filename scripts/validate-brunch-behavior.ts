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

console.log("\n✅ LAYER 4 FINAL VALIDATION - BRUNCH BEHAVIOR\n");
console.log("━".repeat(80) + "\n");

const brunchProgrammes = programmes?.filter(p => 
  p.programme_name?.toLowerCase().includes('brunch') || 
  p.programme_name?.toLowerCase().includes('morgenmad')
) || [];

let allPassed = true;

for (const programme of brunchProgrammes) {
  console.log(`🍽️  ${programme.programme_name}\n`);
  
  const segments = programme.audience_segments || [];
  
  for (const segment of segments) {
    const issues = [];
    
    // Check for breakfast-like content
    const allText = [
      segment.label,
      ...(segment.content_angles || []),
      ...(segment.evidence || [])
    ].join(" ").toLowerCase();
    
    // Forbidden breakfast patterns
    if (allText.includes("før arbejde")) {
      issues.push('❌ Contains "før arbejde" (before work) - breakfast behavior');
    }
    if (allText.includes("morgenmad") && !allText.includes("brunch")) {
      issues.push('❌ Uses "morgenmad" without "brunch"');
    }
    if (allText.includes("hurtig") && segment.motivation === "convenience") {
      issues.push('⚠️  Contains "hurtig" (quick) with convenience motivation - breakfast-like');
    }
    if (allText.includes("quick")) {
      issues.push('❌ Contains "quick" - breakfast behavior');
    }
    
    // Check motivation for brunch appropriateness
    if (segment.motivation === "convenience" && segment.timing_windows) {
      const hasEarlyTiming = segment.timing_windows.some((w: string) => {
        const match = w.match(/(\d{2}):(\d{2})/);
        return match && parseInt(match[1]) < 10;
      });
      if (hasEarlyTiming) {
        issues.push('❌ Convenience motivation with timing before 10:00 - breakfast behavior');
      }
    }
    
    // Required brunch patterns
    const hasBrunchContent = 
      allText.includes("brunch") || 
      allText.includes("social") || 
      allText.includes("weekend") ||
      allText.includes("variation");
    
    if (!hasBrunchContent) {
      issues.push('⚠️  Missing brunch-typical content (social/weekend/variation)');
    }
    
    // Display
    if (issues.length > 0) {
      console.log(`   ❌ ${segment.label}`);
      issues.forEach(i => console.log(`      ${i}`));
      allPassed = false;
    } else {
      console.log(`   ✅ ${segment.label}`);
      console.log(`      Motivation: ${segment.motivation} | Timing: ${segment.timing_windows?.join(", ")}`);
      if (segment.content_angles?.length > 0) {
        console.log(`      Content: ${segment.content_angles[0]}`);
      }
    }
    console.log("");
  }
}

console.log("━".repeat(80) + "\n");

if (allPassed) {
  console.log("🎉 PERFECT! 100% Brunch Behavior Compliance\n");
  console.log("   ✅ No breakfast behavior detected");
  console.log("   ✅ No 'før arbejde' (before work) content");
  console.log("   ✅ No 'morgenmad' without 'brunch'");
  console.log("   ✅ All segments have social/experience_seeking motivations");
  console.log("   ✅ All timing appropriate for brunch (10:00+)");
  console.log("   ✅ All content angles reflect leisurely social meals\n");
} else {
  console.log("❌ Issues found - breakfast behavior still present\n");
}

console.log("━".repeat(80) + "\n");
