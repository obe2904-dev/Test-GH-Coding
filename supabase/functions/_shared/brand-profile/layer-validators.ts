/**
 * Layer Validation Functions
 * 
 * Validates output from each layer in the brand profile generation pipeline.
 * Each validator throws ValidationError if output doesn't meet requirements.
 * 
 * @version 1.0.0
 * @date 2026-06-23
 */

import type {
  Layer0Output,
  Layer1Output,
  Layer2Output,
  Layer4Output,
  Layer5Output,
  Layer5_5Output,
  Layer6Output,
  EnrichedProgramme,
  ValidationError
} from './types-v5-pipeline.ts';

// ============================================================================
// LAYER 0: BUSINESS INTELLIGENCE VALIDATION
// ============================================================================

export function validateLayer0Output(
  output: Layer0Output,
  requestId: string
): void {
  // Business Identity Persona
  if (!output.businessIdentityPersona?.system_persona) {
    throw new Error(`[Layer 0] Validation failed: businessIdentityPersona.system_persona cannot be empty`);
  }
  
  if (output.businessIdentityPersona.system_persona.length < 100) {
    throw new Error(`[Layer 0] Validation failed: businessIdentityPersona.system_persona too short (${output.businessIdentityPersona.system_persona.length} chars, minimum 100)`);
  }
  
  // Menu Overview - validate only if menuOverview exists
  if (output.menuOverview) {
    if (!output.menuOverview.signature_themes?.length) {
      throw new Error(`[Layer 0] Validation failed: menuOverview.signature_themes must have at least 1 theme`);
    }
    
    // Gastronomic profile is optional but warn if missing
    if (!output.menuOverview.gastronomic_profile) {
      console.warn(`[${requestId}] ⚠️  Layer 0: menuOverview.gastronomic_profile is empty (single-menu or AI generation failed)`);
    }
  } else {
    console.warn(`[${requestId}] ⚠️  Layer 0: menuOverview is undefined (menu-overview-summary not run or no menus)`);
  }
  
  // Extracted USPs
  if (!output.extractedUSPs?.primary_usp?.text) {
    throw new Error(`[Layer 0] Validation failed: extractedUSPs.primary_usp.text cannot be empty`);
  }
  
  if (output.extractedUSPs.primary_usp.score < 0 || output.extractedUSPs.primary_usp.score > 1) {
    throw new Error(`[Layer 0] Validation failed: extractedUSPs.primary_usp.score must be 0-1 (got ${output.extractedUSPs.primary_usp.score})`);
  }
  
  console.log(`[${requestId}] ✅ Layer 0 validation passed`);
}

// ============================================================================
// LAYER 1: PROGRAMME DETECTION VALIDATION
// ============================================================================

export function validateLayer1Output(
  output: Layer1Output,
  requestId: string
): void {
  // Must have at least 1 programme
  if (!output.programmes?.length) {
    throw new Error(`[Layer 1] Validation failed: programmes array cannot be empty`);
  }
  
  // Validate each programme
  for (const programme of output.programmes) {
    if (!programme.type) {
      throw new Error(`[Layer 1] Validation failed: programme.type cannot be empty`);
    }
    
    if (!programme.timeWindow?.start || !programme.timeWindow?.end) {
      throw new Error(`[Layer 1] Validation failed: programme ${programme.type} missing timeWindow.start or .end`);
    }
    
    if (!['high', 'medium', 'low'].includes(programme.confidence)) {
      throw new Error(`[Layer 1] Validation failed: programme ${programme.type} has invalid confidence: ${programme.confidence}`);
    }
  }
  
  console.log(`[${requestId}] ✅ Layer 1 validation passed - ${output.programmes.length} programmes`);
}

// ============================================================================
// LAYER 2: COMMERCIAL ORIENTATION VALIDATION
// ============================================================================

export function validateLayer2Output(
  enrichedProgrammes: EnrichedProgramme[],
  requestId: string
): void {
  // All programmes must have commercial orientation
  for (const enriched of enrichedProgrammes) {
    if (!enriched.commercialOrientation) {
      throw new Error(`[Layer 2] Validation failed: programme ${enriched.programme.type} missing commercialOrientation`);
    }
    
    const co = enriched.commercialOrientation;
    
    // Baseline goal split must sum to 100
    const total = co.baseline_goal_split.booking_push + co.baseline_goal_split.footfall_push;
    if (Math.abs(total - 100) > 0.01) {  // Allow tiny floating point errors
      throw new Error(`[Layer 2] Validation failed: programme ${enriched.programme.type} baseline_goal_split must sum to 100 (got ${total})`);
    }
    
    // Price positioning must be valid
    if (!['budget', 'value', 'moderate', 'upscale', 'premium'].includes(co.price_positioning)) {
      throw new Error(`[Layer 2] Validation failed: programme ${enriched.programme.type} has invalid price_positioning: ${co.price_positioning}`);
    }
    
    // Decision timing must be valid
    if (!['last_minute', 'planned', 'hybrid'].includes(co.decision_timing)) {
      throw new Error(`[Layer 2] Validation failed: programme ${enriched.programme.type} has invalid decision_timing: ${co.decision_timing}`);
    }
  }
  
  console.log(`[${requestId}] ✅ Layer 2 validation passed - ${enrichedProgrammes.length} programmes oriented`);
}

// ============================================================================
// LAYER 4: AUDIENCE SEGMENTATION VALIDATION
// ============================================================================

export function validateLayer4Output(
  enrichedProgrammes: EnrichedProgramme[],
  requestId: string
): void {
  // All programmes must have audience segments
  for (const enriched of enrichedProgrammes) {
    if (!enriched.audienceSegments) {
      throw new Error(`[Layer 4] Validation failed: programme ${enriched.programme.type} missing audienceSegments`);
    }
    
    if (enriched.audienceSegments.length === 0) {
      throw new Error(`[Layer 4] Validation failed: programme ${enriched.programme.type} has empty audienceSegments array`);
    }
    
    // Validate each segment
    for (const segment of enriched.audienceSegments) {
      if (!segment.segment_name) {
        throw new Error(`[Layer 4] Validation failed: programme ${enriched.programme.type} has segment with empty segment_name`);
      }
      
      if (segment.confidence < 0 || segment.confidence > 1) {
        throw new Error(`[Layer 4] Validation failed: segment ${segment.segment_name} has invalid confidence: ${segment.confidence}`);
      }
    }
  }
  
  const totalSegments = enrichedProgrammes.reduce(
    (sum, p) => sum + (p.audienceSegments?.length || 0),
    0
  );
  
  console.log(`[${requestId}] ✅ Layer 4 validation passed - ${totalSegments} total segments across ${enrichedProgrammes.length} programmes`);
}

// ============================================================================
// LAYER 5: VOICE PROFILE VALIDATION
// ============================================================================

export function validateLayer5Output(
  output: Layer5Output,
  requestId: string
): void {
  // Voice Profile
  if (!output.voiceProfile) {
    throw new Error(`[Layer 5] Validation failed: voiceProfile cannot be null`);
  }
  
  if (!output.voiceProfile.formality_level) {
    throw new Error(`[Layer 5] Validation failed: voiceProfile.formality_level cannot be empty`);
  }
  
  if (!output.voiceProfile.tone_rules || output.voiceProfile.tone_rules.length < 3) {
    throw new Error(`[Layer 5] Validation failed: voiceProfile.tone_rules must have at least 3 rules (got ${output.voiceProfile.tone_rules?.length || 0})`);
  }
  
  // Guardrails
  if (!output.guardrails?.never_say || output.guardrails.never_say.length < 5) {
    throw new Error(`[Layer 5] Validation failed: guardrails.never_say must have at least 5 items (got ${output.guardrails?.never_say?.length || 0})`);
  }
  
  // Writing Examples
  if (!output.writingExamples?.typical_openings || output.writingExamples.typical_openings.length < 3) {
    throw new Error(`[Layer 5] Validation failed: writingExamples.typical_openings must have at least 3 examples (got ${output.writingExamples?.typical_openings?.length || 0})`);
  }
  
  console.log(`[${requestId}] ✅ Layer 5 validation passed - ${output.voiceProfile.tone_rules.length} tone rules, ${output.guardrails.never_say.length} never_say items`);
}

// ============================================================================
// LAYER 5.5: STRATEGIC TONE DNA VALIDATION
// ============================================================================

export function validateLayer5_5Output(
  output: Layer5_5Output,
  requestId: string
): void {
  // Tone DNA
  if (!output.toneDNA) {
    throw new Error(`[Layer 5.5] Validation failed: toneDNA cannot be null`);
  }
  
  if (!output.toneDNA.tone_positioning) {
    throw new Error(`[Layer 5.5] Validation failed: toneDNA.tone_positioning cannot be empty`);
  }
  
  // Enhanced Examples
  if (!output.enhancedExamples?.social_examples || output.enhancedExamples.social_examples.length < 8) {
    throw new Error(`[Layer 5.5] Validation failed: enhancedExamples.social_examples must have at least 8 examples (got ${output.enhancedExamples?.social_examples?.length || 0})`);
  }
  
  if (!output.enhancedExamples?.avoid_examples || output.enhancedExamples.avoid_examples.length < 5) {
    throw new Error(`[Layer 5.5] Validation failed: enhancedExamples.avoid_examples must have at least 5 examples (got ${output.enhancedExamples?.avoid_examples?.length || 0})`);
  }
  
  // Validate example structure
  for (const example of output.enhancedExamples.social_examples) {
    if (!example.text || !example.rationale) {
      throw new Error(`[Layer 5.5] Validation failed: social_example missing text or rationale`);
    }
  }
  
  for (const example of output.enhancedExamples.avoid_examples) {
    if (!example.text || !example.why_avoid) {
      throw new Error(`[Layer 5.5] Validation failed: avoid_example missing text or why_avoid`);
    }
  }
  
  console.log(`[${requestId}] ✅ Layer 5.5 validation passed - ${output.enhancedExamples.social_examples.length} social examples, ${output.enhancedExamples.avoid_examples.length} avoid examples`);
}

// ============================================================================
// LAYER 6: MARKETING MANAGER BRIEF VALIDATION
// ============================================================================

export function validateLayer6Output(
  output: Layer6Output,
  requestId: string
): void {
  if (!output.marketingManagerBrief?.marketing_manager_brief) {
    throw new Error(`[Layer 6] Validation failed: marketingManagerBrief.marketing_manager_brief cannot be empty`);
  }
  
  const wordCount = output.marketingManagerBrief.metadata.word_count;
  if (wordCount < 150 || wordCount > 300) {
    console.warn(`[${requestId}] ⚠️ Layer 6: Marketing Manager Brief has ${wordCount} words (recommended: 150-250)`);
  }
  
  console.log(`[${requestId}] ✅ Layer 6 validation passed - ${wordCount} words`);
}
