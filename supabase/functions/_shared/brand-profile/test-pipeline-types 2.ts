/**
 * Test file for V5 Pipeline Types and Validators
 * 
 * Run this to verify:
 * 1. TypeScript types compile correctly
 * 2. Validators catch invalid data
 * 3. Auditors detect quality issues
 * 
 * Usage: deno run --allow-all test-pipeline-types.ts
 */

import {
  validateLayer0Output,
  validateLayer1Output,
  validateLayer2Output,
  validateLayer4Output,
  validateLayer5Output,
  validateLayer5_5Output,
  validateLayer6Output
} from './layer-validators.ts';

import {
  auditVoiceProfileInternal,
  auditToneDNAAgainstVoice,
  auditCrossLayerConsistency
} from './layer-auditors.ts';

import type {
  Layer0Output,
  Layer1Output,
  Layer5Output,
  Layer5_5Output,
  Layer6Output,
  EnrichedProgramme
} from './types-v5-pipeline.ts';

// ============================================================================
// TEST DATA - Valid Outputs
// ============================================================================

const validLayer0: Layer0Output = {
  businessIdentityPersona: {
    system_persona: "Du er Marketing ekspert for Café Faust. FORRETNING: Italiensk restaurant med fokus på sourdough pizza og cocktails. LOKATION: Ved åen i Aarhus midtby med udsigt til vandet. TILBUD: Brunch 09-14, Frokost 12-16, Aften 17-22, Cocktails til 02:00. KULINARISK KARAKTER: Fusion af italiensk pizza-tradition med nordiske råvarer.",
    metadata: {
      word_count: 150,
      generated_at: new Date().toISOString(),
      om_os_length: 200,
      has_location_intelligence: true,
      has_menu_overview: true,
      location_dimensions: 2,
      signature_themes_count: 3
    }
  },
  geographicContext: {
    neighborhood: "Aarhus Midtby",
    area_type: "city_center",
    category_scores: {
      waterfront: 95,
      city_centre: 90,
      tourist: 60
    },
    location_marketing_hooks: ["ved åen", "waterfront dining"],
    is_strategy_driver: "waterfront",
    local_location_reference: "ved åen"
  },
  menuOverview: {
    signature_themes: ["Sourdough pizza specialist", "Italian-Nordic fusion", "Waterfront cocktails"],
    gastronomic_profile: "Contemporary Italian cuisine with Nordic ingredients focus.",
    total_items: 45,
    total_menus: 3,
    overall_avg_price: 125
  },
  extractedUSPs: {
    primary_usp: {
      text: "Sourdough pizza ved åen",
      score: 0.92,
      source: 'hybrid'
    },
    secondary_usps: [
      { text: "Cocktails til 02:00", score: 0.85, source: 'menu' }
    ],
    synthesis_reasoning: "Waterfront location + specialty pizza = strong differentiation"
  },
  metadata: {
    generated_at: new Date().toISOString(),
    model_version: "5.0",
    business_id: "test-123"
  }
};

const validLayer1: Layer1Output = {
  programmes: [
    {
      type: "brunch",
      label: "Brunch",
      timeWindow: { start: "09:00", end: "14:00" },
      daysOfWeek: ["saturday", "sunday"],
      menuEvidence: ["Brunch Menu"],
      confidence: "high"
    },
    {
      type: "cocktails",
      label: "Cocktails",
      timeWindow: { start: "17:00", end: "02:00" },
      daysOfWeek: ["friday", "saturday"],
      menuEvidence: ["Bar Menu"],
      confidence: "high"
    }
  ],
  metadata: {
    detection_method: "v2_extraction",
    total_programmes_detected: 2,
    generated_at: new Date().toISOString()
  }
};

const validEnrichedProgrammes: EnrichedProgramme[] = [
  {
    programme: validLayer1.programmes[0],
    commercialOrientation: {
      baseline_goal_split: { booking_push: 70, footfall_push: 30 },
      decision_timing: "planned",
      content_type_affinity: {
        visual_content_importance: "high",
        menu_detail_emphasis: "high"
      },
      price_positioning: "mid_range",
      reasoning: "Brunch is typically planned, needs booking"
    },
    audienceSegments: [
      {
        segment_name: "Families with kids",
        motivation: "Weekend family meal",
        timing_preference: "10-12",
        content_angle: "Kid-friendly, relaxed atmosphere",
        confidence: 0.85
      }
    ]
  },
  {
    programme: validLayer1.programmes[1],
    commercialOrientation: {
      baseline_goal_split: { booking_push: 30, footfall_push: 70 },
      decision_timing: "last_minute",
      content_type_affinity: {
        visual_content_importance: "high",
        menu_detail_emphasis: "medium"
      },
      price_positioning: "mid_range",
      reasoning: "Cocktails are spontaneous, walk-in friendly"
    },
    audienceSegments: [
      {
        segment_name: "Date night couples",
        motivation: "Romantic evening",
        timing_preference: "19-23",
        content_angle: "Intimate, atmospheric",
        confidence: 0.90
      }
    ]
  }
];

const validLayer5: Layer5Output = {
  voiceProfile: {
    formality_level: "casual-warm",
    emoji_usage: "selective",
    tone_rules: [
      "Brug aldrig imperativer - ingen 'kom', 'prøv', 'nyd'",
      "Skriv kortfattet - max 2 sætninger",
      "Fokuser på fakta, ikke salgsfraser"
    ],
    humor_level: "subtle"
  },
  guardrails: {
    never_say: [
      "lækker",
      "hyggelig",
      "unik",
      "autentisk",
      "passion"
    ],
    avoid_patterns: {
      strip_from_output: {
        brochure_language: ["oplev", "nyd", "lad dig friste"],
        superlatives: ["bedste", "mest"]
      },
      generation_constraints: {
        compound_sentences: ["når", "da", "fordi"]
      }
    }
  },
  writingExamples: {
    typical_openings: [
      "Vi har...",
      "I dag serverer vi...",
      "Vores [...] er klar"
    ],
    typical_closings: ["Book bord 👆", "Vi ses 🍕"]
  },
  metadata: {
    generated_at: new Date().toISOString(),
    model_used: "gpt-4o"
  }
};

const validLayer5_5: Layer5_5Output = {
  toneDNA: {
    tone_positioning: "Casual-varm med waterfront-fokus"
  },
  enhancedExamples: {
    social_examples: [
      {
        text: "Vores sourdough pizza er klar ved åen 🍕",
        rationale: "Declarative, mentions signature theme + location"
      },
      {
        text: "Brunch serveres fra kl. 09 i weekenden",
        rationale: "Factual, specific timing"
      },
      {
        text: "Cocktails til kl. 02:00 fredag og lørdag 🍹",
        rationale: "Clear offering, specific days"
      },
      {
        text: "Vi har udsigt til åen fra alle borde",
        rationale: "Location USP, declarative"
      },
      {
        text: "I dag bager vi 30 pizzaer med Tange Sø tomater",
        rationale: "Specific, craft signal"
      },
      {
        text: "Vores happy hour starter kl. 17",
        rationale: "Time-specific, clear"
      },
      {
        text: "Bord til 4 personer er ledigt i aften",
        rationale: "Availability, no imperative"
      },
      {
        text: "Vi er åbne til midnat i aften",
        rationale: "Hours, factual"
      }
    ],
    avoid_examples: [
      {
        text: "Kom og nyd vores lækre pizza! 😍",
        why_avoid: "Multiple imperatives + banned words (nyd, lækker)"
      },
      {
        text: "Den bedste italienske restaurant i Aarhus",
        why_avoid: "Superlative (bedste)"
      },
      {
        text: "Oplev autentisk italiensk madlavning",
        why_avoid: "Brochure language + banned word (autentisk)"
      },
      {
        text: "Lad dig friste af vores unikke menu",
        why_avoid: "Imperative (lad) + banned words"
      },
      {
        text: "Prøv vores cocktails i hyggelige omgivelser",
        why_avoid: "Imperative (prøv) + banned word (hyggelige)"
      }
    ]
  },
  metadata: {
    generated_at: new Date().toISOString(),
    examples_count: 13
  }
};

const validLayer6: Layer6Output = {
  marketingManagerBrief: {
    marketing_manager_brief: "Café Faust er en italiensk restaurant ved åen i Aarhus med fokus på sourdough pizza og cocktails. Primære segmenter: familier til brunch (weekend 09-14), par til cocktails (17-02:00 fredag/lørdag). Tone: casual-varm, aldrig imperativer. Nøglebudskaber: sourdough pizza-specialitet, waterfront-placering, cocktails til sent. Kommerciel strategi: brunch kræver booking (70% push), cocktails er walk-in (70% footfall). Content skal være visuel (pizza-craft, waterfront-udsigt), kortfattet (max 2 sætninger), fokuseret på konkrete tilbud frem for stemning.",
    metadata: {
      word_count: 87,
      generated_at: new Date().toISOString()
    }
  }
};

// ============================================================================
// TEST SUITE
// ============================================================================

function runTests() {
  console.log("🧪 Testing V5 Pipeline Types and Validators\n");
  console.log("=" .repeat(70));
  
  let passed = 0;
  let failed = 0;
  const requestId = "test-run";
  
  // Test 1: Layer 0 Validation (Valid)
  try {
    validateLayer0Output(validLayer0, requestId);
    console.log("✅ Test 1: Layer 0 validation (valid data) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 1 FAILED:", error.message);
    failed++;
  }
  
  // Test 2: Layer 0 Validation (Invalid - empty persona)
  try {
    const invalidLayer0 = { ...validLayer0 };
    invalidLayer0.businessIdentityPersona = {
      ...validLayer0.businessIdentityPersona,
      system_persona: ""
    };
    validateLayer0Output(invalidLayer0, requestId);
    console.error("❌ Test 2: Should have thrown error for empty persona");
    failed++;
  } catch (error) {
    console.log("✅ Test 2: Layer 0 validation catches empty persona - PASSED");
    passed++;
  }
  
  // Test 3: Layer 1 Validation (Valid)
  try {
    validateLayer1Output(validLayer1, requestId);
    console.log("✅ Test 3: Layer 1 validation (valid data) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 3 FAILED:", error.message);
    failed++;
  }
  
  // Test 4: Layer 2 Validation (Valid)
  try {
    validateLayer2Output(validEnrichedProgrammes, requestId);
    console.log("✅ Test 4: Layer 2 validation (valid data) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 4 FAILED:", error.message);
    failed++;
  }
  
  // Test 5: Layer 2 Validation (Invalid - goal split != 100)
  try {
    const invalidProgrammes = [...validEnrichedProgrammes];
    invalidProgrammes[0] = {
      ...validEnrichedProgrammes[0],
      commercialOrientation: {
        ...validEnrichedProgrammes[0].commercialOrientation!,
        baseline_goal_split: { booking_push: 60, footfall_push: 30 } // Sum = 90, not 100
      }
    };
    validateLayer2Output(invalidProgrammes, requestId);
    console.error("❌ Test 5: Should have thrown error for invalid goal split");
    failed++;
  } catch (error) {
    console.log("✅ Test 5: Layer 2 validation catches invalid goal split - PASSED");
    passed++;
  }
  
  // Test 6: Layer 4 Validation (Valid)
  try {
    validateLayer4Output(validEnrichedProgrammes, requestId);
    console.log("✅ Test 6: Layer 4 validation (valid data) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 6 FAILED:", error.message);
    failed++;
  }
  
  // Test 7: Layer 5 Validation (Valid)
  try {
    validateLayer5Output(validLayer5, requestId);
    console.log("✅ Test 7: Layer 5 validation (valid data) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 7 FAILED:", error.message);
    failed++;
  }
  
  // Test 8: Layer 5 Internal Audit (Valid - no contradictions)
  try {
    auditVoiceProfileInternal(validLayer5, requestId);
    console.log("✅ Test 8: Layer 5 internal audit (no contradictions) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 8 FAILED:", error.message);
    failed++;
  }
  
  // Test 9: Layer 5.5 Validation (Valid)
  try {
    validateLayer5_5Output(validLayer5_5, requestId);
    console.log("✅ Test 9: Layer 5.5 validation (valid data) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 9 FAILED:", error.message);
    failed++;
  }
  
  // Test 10: Layer 5.5 Audit (Valid - no imperative violations)
  try {
    auditToneDNAAgainstVoice(validLayer5_5, validLayer5, requestId);
    console.log("✅ Test 10: Layer 5.5 audit (no imperative violations) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 10 FAILED:", error.message);
    failed++;
  }
  
  // Test 11: Layer 5.5 Audit (Invalid - HAS imperative violations)
  try {
    const invalidLayer5_5 = { ...validLayer5_5 };
    invalidLayer5_5.enhancedExamples = {
      ...validLayer5_5.enhancedExamples,
      social_examples: [
        ...validLayer5_5.enhancedExamples.social_examples,
        {
          text: "Prøv vores pizza ved åen!", // IMPERATIVE VIOLATION
          rationale: "Bad example with imperative"
        }
      ]
    };
    auditToneDNAAgainstVoice(invalidLayer5_5, validLayer5, requestId);
    console.error("❌ Test 11: Should have caught imperative violation");
    failed++;
  } catch (error) {
    console.log("✅ Test 11: Layer 5.5 audit catches imperative violations - PASSED");
    console.log(`   (Detected: ${error.message.substring(0, 80)}...)`);
    passed++;
  }
  
  // Test 12: Layer 6 Validation (Valid)
  try {
    validateLayer6Output(validLayer6, requestId);
    console.log("✅ Test 12: Layer 6 validation (valid data) - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 12 FAILED:", error.message);
    failed++;
  }
  
  // Test 13: Cross-Layer Consistency Audit (Valid)
  try {
    auditCrossLayerConsistency(
      validLayer0,
      validLayer1,
      validEnrichedProgrammes,
      validLayer5,
      validLayer5_5,
      validLayer6,
      requestId
    );
    console.log("✅ Test 13: Cross-layer consistency audit - PASSED");
    passed++;
  } catch (error) {
    console.error("❌ Test 13 FAILED:", error.message);
    failed++;
  }
  
  // Final Summary
  console.log("\n" + "=".repeat(70));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED - Types and validators working correctly!\n");
    return 0;
  } else {
    console.log("⚠️  SOME TESTS FAILED - Review errors above\n");
    return 1;
  }
}

// Run tests
const exitCode = runTests();
Deno.exit(exitCode);
