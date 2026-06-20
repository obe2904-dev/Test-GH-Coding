/**
 * ACTIVATION VALIDATION LAYER
 * 
 * Validates that Phase 1 output correctly implements activation engine guidance.
 * Catches errors before they ship to users.
 * 
 * Key checks:
 * 1. Angles map to activated segments
 * 2. Timing windows respect activation boundaries
 * 3. Goal distribution follows allocation guidance
 * 4. Deactivated segments are not used
 */

import type { ActivationEngineOutput } from '../types/activation-types.ts';
import type { StrategicBrief } from '../types/strategy-types.ts';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  metadata: {
    angles_validated: number;
    segments_matched: number;
    timing_violations: number;
    goal_distribution: Record<string, number>;
  };
}

/**
 * Validate that strategic brief follows activation engine guidance.
 */
export function validateActivationCompliance(
  strategicBrief: StrategicBrief,
  activationOutput: ActivationEngineOutput
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const activatedSegmentNames = activationOutput.activated_segments.map(s => s.segment_name);
  const deactivatedSegmentNames = activationOutput.deactivated_segments || [];
  const recommendedSegments = activationOutput.allocation_guidance.recommended_segments;
  
  let segmentsMatched = 0;
  let timingViolations = 0;
  const goalDistribution: Record<string, number> = {
    drive_footfall: 0,
    build_brand: 0,
    retain_loyalty: 0,
  };
  
  // ═══════════════════════════════════════════════════════════════
  // CHECK 1: Angles should map to activated segments
  // ═══════════════════════════════════════════════════════════════
  
  for (const angle of strategicBrief.angles) {
    // Count goal distribution
    if (angle.goal_mode) {
      goalDistribution[angle.goal_mode] = (goalDistribution[angle.goal_mode] || 0) + 1;
    }
    
    // Check if angle references an activated segment
    const matchesActivatedSegment = activatedSegmentNames.some(segmentName => {
      // Fuzzy match - angle focus should contain segment keywords
      const angleLower = angle.focus.toLowerCase();
      const segmentLower = segmentName.toLowerCase();
      
      // Extract key words from segment name
      const segmentWords = segmentLower.split(/[-\s]/);
      
      // Check if angle contains segment keywords
      return segmentWords.some(word => 
        word.length > 3 && angleLower.includes(word)
      );
    });
    
    if (matchesActivatedSegment) {
      segmentsMatched++;
    } else {
      warnings.push(
        `Angle "${angle.focus}" does not clearly map to activated segments: [${activatedSegmentNames.join(', ')}]`
      );
    }
    
    // Check if angle references a deactivated segment
    const referencesDeactivated = deactivatedSegmentNames.some(segmentName => {
      const angleLower = angle.focus.toLowerCase();
      const segmentLower = segmentName.toLowerCase();
      const segmentWords = segmentLower.split(/[-\s]/);
      return segmentWords.some(word => 
        word.length > 3 && angleLower.includes(word)
      );
    });
    
    if (referencesDeactivated) {
      errors.push(
        `Angle "${angle.focus}" references DEACTIVATED segment (should be avoided)`
      );
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // CHECK 2: Timing windows should align with activation guidance
  // ═══════════════════════════════════════════════════════════════
  
  for (const angle of strategicBrief.angles) {
    if (!angle.timing_window || angle.timing_window === 'any') {
      continue;
    }
    
    // Parse timing window (e.g., "Wed-Thu 10:00")
    const timeMatch = angle.timing_window.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : null;
    
    if (!time) {
      warnings.push(`Angle "${angle.focus}" has invalid timing_window format: "${angle.timing_window}"`);
      timingViolations++;
      continue;
    }
    
    // Extract days
    const daysText = angle.timing_window.replace(/\d{1,2}:\d{2}/, '').trim();
    
    // Validate against recommended segments
    const matchingRecommendation = recommendedSegments.find(rec => {
      // Check if angle's timing aligns with any recommended segment's timing
      const recTimingWindow = rec.timing_window || '';
      return recTimingWindow.includes(time) || angle.focus.toLowerCase().includes(rec.segment_name.toLowerCase().split('-')[0]);
    });
    
    if (!matchingRecommendation) {
      warnings.push(
        `Angle "${angle.focus}" timing "${angle.timing_window}" doesn't match recommended segments`
      );
      timingViolations++;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // CHECK 3: Goal distribution follows allocation guidance
  // ═══════════════════════════════════════════════════════════════
  
  const totalAngles = strategicBrief.angles.length;
  const goalBlend = activationOutput.allocation_guidance.goal_blend;
  
  if (goalBlend) {
    const expectedFootfall = Math.round(totalAngles * goalBlend.drive_footfall);
    const expectedBrand = Math.round(totalAngles * goalBlend.strengthen_brand);
    
    const actualFootfall = goalDistribution.drive_footfall || 0;
    const actualBrand = goalDistribution.build_brand || 0;
    
    // Allow ±1 tolerance for small angle counts
    if (Math.abs(actualFootfall - expectedFootfall) > 1) {
      warnings.push(
        `Goal distribution: Expected ${expectedFootfall} drive_footfall angles, got ${actualFootfall}`
      );
    }
    
    if (Math.abs(actualBrand - expectedBrand) > 1) {
      warnings.push(
        `Goal distribution: Expected ${expectedBrand} build_brand angles, got ${actualBrand}`
      );
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // CHECK 4: Recommended segments are actually used
  // ═══════════════════════════════════════════════════════════════
  
  for (const recommended of recommendedSegments) {
    const isUsed = strategicBrief.angles.some(angle => {
      const angleLower = angle.focus.toLowerCase();
      const segmentWords = recommended.segment_name.toLowerCase().split(/[-\s]/);
      return segmentWords.some(word => 
        word.length > 3 && angleLower.includes(word)
      );
    });
    
    if (!isUsed) {
      warnings.push(
        `Recommended segment "${recommended.segment_name}" (priority ${recommended.this_week_priority}, score ${recommended.activation_score}) was not used`
      );
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  
  const valid = errors.length === 0 && warnings.length < 3; // Max 2 warnings allowed
  
  return {
    valid,
    warnings,
    errors,
    metadata: {
      angles_validated: strategicBrief.angles.length,
      segments_matched: segmentsMatched,
      timing_violations: timingViolations,
      goal_distribution: goalDistribution,
    },
  };
}

/**
 * Log validation results to console.
 */
export function logValidationResults(result: ValidationResult): void {
  console.log('[Activation Validator] ═══════════════════════════════════════');
  console.log(`[Activation Validator] Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`[Activation Validator] Angles validated: ${result.metadata.angles_validated}`);
  console.log(`[Activation Validator] Segments matched: ${result.metadata.segments_matched}/${result.metadata.angles_validated}`);
  console.log(`[Activation Validator] Timing violations: ${result.metadata.timing_violations}`);
  console.log(`[Activation Validator] Goal distribution:`, result.metadata.goal_distribution);
  
  if (result.errors.length > 0) {
    console.error('[Activation Validator] ❌ ERRORS:');
    result.errors.forEach(err => console.error(`  - ${err}`));
  }
  
  if (result.warnings.length > 0) {
    console.warn('[Activation Validator] ⚠️  WARNINGS:');
    result.warnings.forEach(warn => console.warn(`  - ${warn}`));
  }
  
  console.log('[Activation Validator] ═══════════════════════════════════════');
}
