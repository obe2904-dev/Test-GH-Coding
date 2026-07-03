import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = "2037d63c-a138-4247-89c5-5b6b8cef9f3f";

// Fetch programme profiles with audience segments
const { data: programmes } = await supabase
  .from("business_programme_profiles")
  .select("programme_type, programme_name, audience_segments")
  .eq("business_id", businessId);

console.log("\n🎯 LAYER 4 AUDIENCE SEGMENTS - BRUNCH NAMING CHECK\n");
console.log("━".repeat(80) + "\n");

let totalIssues = 0;
let totalSegments = 0;

for (const programme of programmes || []) {
  const segments = programme.audience_segments;
  
  console.log(`📋 Programme: ${programme.programme_name} (${programme.programme_type})`);
  console.log("");
  
  if (!segments || !Array.isArray(segments)) {
    console.log("   ⚠️  No segments found\n");
    continue;
  }
  
  const isBrunchProgramme = programme.programme_name?.includes("Morgenmad/Brunch");
  
  for (const segment of segments) {
    totalSegments++;
    const issues = [];
    
    // Check label
    if (segment.label?.toLowerCase().includes("morgen")) {
      if (isBrunchProgramme) {
        issues.push(`❌ Label contains "morgen": "${segment.label}"`);
      }
    }
    
    // Check content_angles
    if (Array.isArray(segment.content_angles)) {
      segment.content_angles.forEach((angle: string) => {
        if (angle.toLowerCase().includes("morgenmad")) {
          issues.push(`❌ Content angle mentions "morgenmad": "${angle}"`);
        }
      });
    }
    
    // Check timing windows for breakfast hours (before 10:00)
    if (isBrunchProgramme && Array.isArray(segment.timing_windows)) {
      segment.timing_windows.forEach((window: string) => {
        const match = window.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
        if (match) {
          const startHour = parseInt(match[1]);
          if (startHour < 10 && segment.motivation === "convenience") {
            issues.push(`⚠️  Early timing (${window}) with "convenience" motivation suggests breakfast behavior (brunch should be social_gathering)`);
          }
        }
      });
    }
    
    // Display segment
    const icon = issues.length > 0 ? "❌" : "✅";
    console.log(`   ${icon} ${segment.label}`);
    
    if (issues.length > 0) {
      totalIssues += issues.length;
      issues.forEach(issue => console.log(`      ${issue}`));
    } else if (segment.label?.toLowerCase().includes("brunch")) {
      console.log(`      ✓ Uses "brunch" correctly`);
    }
    
    console.log("");
  }
}

console.log("━".repeat(80) + "\n");

if (totalIssues === 0) {
  console.log("🎉 RESULT: ✅ ALL SEGMENTS PASS - No morgenmad in brunch programmes!\n");
  console.log(`   Checked ${totalSegments} segments across ${programmes?.length || 0} programmes`);
} else {
  console.log(`❌ RESULT: ${totalIssues} issues found in ${totalSegments} segments\n`);
  console.log("   Issues to fix:");
  console.log("   - Remove 'morgen' from segment labels in Morgenmad/Brunch programmes");
  console.log("   - Replace 'morgenmad' with 'brunch' in content angles");
  console.log("   - Align timing and motivation with brunch behavior (social, 10:00+)");
}

console.log("\n" + "━".repeat(80) + "\n");
