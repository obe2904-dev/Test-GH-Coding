// ============================================================
// COMMERCIAL VALIDATION SYSTEM
// ============================================================
// Validates generated weekly strategies against commercial requirements.
// Ensures ideas meet quotas, have clear CTAs, and drive business outcomes.
//
// Priority Issue 1: Commercial Objective Governance
// Generated: 5. maj 2026
// ============================================================

import type {
  CommercialMode,
  CommercialIntent,
  CommercialValidationResult,
  IdeaValidationResult,
  CommercialModeDirective,
  PostIdeaWithCommercial
} from '../types/commercial-mode-types.ts';

/**
 * Validates a generated weekly strategy against commercial requirements.
 * Call this AFTER strategy generation, BEFORE saving to database.
 *
 * @param post_ideas - Array of generated post ideas
 * @param directive - Commercial mode directive used for generation
 * @param strict - If true, fails on any quota miss. If false, issues warnings.
 * @returns Validation result with pass/fail and detailed feedback
 */
export function validateCommercialStrategy(
  post_ideas: any[], // Array of PostIdea objects (may not have commercial fields yet)
  directive: CommercialModeDirective,
  strict: boolean = true
): CommercialValidationResult {
  
  // Step 1: Validate each individual idea
  const ideaScores: IdeaValidationResult[] = post_ideas.map((idea, index) => 
    validatePostIdea(idea, index + 1)
  );
  
  // Step 2: Count ideas by commercial intent
  const intentCounts = countByIntent(ideaScores);
  
  // Step 3: Check quota requirements
  const quotaMet = checkQuotas(intentCounts, directive);
  
  // Step 4: Calculate average commercial clarity score
  const avgScore = calculateAverageScore(ideaScores);
  
  // Step 5: Collect issues and warnings
  const { issues, warnings } = collectFeedback(
    ideaScores,
    intentCounts,
    directive,
    quotaMet,
    avgScore
  );
  
  // Step 6: Determine pass/fail
  const passed = strict 
    ? quotaMet && avgScore >= 3.5 && issues.length === 0
    : avgScore >= 3.0;
  
  return {
    passed,
    score: avgScore,
    idea_scores: ideaScores,
    booking_ideas_count: intentCounts.booking,
    footfall_ideas_count: intentCounts.footfall,
    brand_ideas_count: intentCounts.brand,
    loyalty_ideas_count: intentCounts.loyalty,
    quota_met: quotaMet,
    quota_requirements: {
      min_booking_ideas: directive.min_booking_ideas,
      min_footfall_ideas: directive.min_footfall_ideas,
      actual_booking_ideas: intentCounts.booking,
      actual_footfall_ideas: intentCounts.footfall
    },
    issues,
    warnings
  };
}

/**
 * Validates a single post idea for commercial clarity.
 * Scores 1-5 based on:
 * - Has clear commercial_intent
 * - Has specific CTA
 * - Has timing urgency
 * - Has conversion hook
 * - Hook quality
 */
function validatePostIdea(idea: any, ideaId: number): IdeaValidationResult {
  const score = calculateIdeaScore(idea);
  const intent = extractCommercialIntent(idea);
  
  // Check required fields
  const has_cta = !!(idea.cta_type || idea.cta_intent);
  const has_timing = !!(idea.timing_window);
  const has_hook = !!(idea.conversion_hook && idea.conversion_hook.length > 10);
  
  // Collect issues
  const issues: string[] = [];
  if (!intent || intent === 'unknown') {
    issues.push("Missing or invalid commercial_intent");
  }
  if (!has_cta) {
    issues.push("Missing CTA type");
  }
  if (!has_timing) {
    issues.push("Missing timing window");
  }
  if (!has_hook) {
    issues.push("Missing or weak conversion hook");
  }
  if (idea.timing_window === 'ongoing' && (intent === 'booking' || intent === 'footfall')) {
    issues.push("Commercial ideas cannot have 'ongoing' timing - needs urgency");
  }
  
  return {
    idea_id: ideaId,
    commercial_intent: intent || 'unknown' as CommercialIntent,
    commercial_clarity_score: score,
    has_cta,
    has_timing,
    has_conversion_hook: has_hook,
    passes_threshold: score >= 3,
    issues
  };
}

/**
 * Calculates commercial clarity score (1-5) for a single idea.
 */
function calculateIdeaScore(idea: any): number {
  let score = 1;
  
  // +1: Has commercial intent defined
  if (idea.commercial_intent) {
    score += 1;
  }
  
  // +1: Has specific CTA
  if (idea.cta_type && idea.cta_type !== 'browse_offerings') {
    score += 1;
  }
  
  // +1: Has timing urgency (not ongoing)
  if (idea.timing_window && idea.timing_window !== 'ongoing') {
    score += 1;
  }
  
  // +1: Has strong conversion hook
  if (idea.conversion_hook) {
    if (idea.conversion_hook.length > 20 && 
        (idea.conversion_hook.includes('kun') || 
         idea.conversion_hook.includes('limited') ||
         idea.conversion_hook.includes('nu') ||
         idea.conversion_hook.includes('i dag') ||
         idea.conversion_hook.includes('denne uge'))) {
      score += 1;
    } else if (idea.conversion_hook.length > 10) {
      score += 0.5;
    }
  }
  
  // Cap at 5
  return Math.min(Math.round(score * 2) / 2, 5); // Round to nearest 0.5
}

/**
 * Extracts commercial intent from idea object.
 * Handles multiple possible field names for backwards compatibility.
 */
function extractCommercialIntent(idea: any): CommercialIntent | 'unknown' {
  // Direct field
  if (idea.commercial_intent) {
    return idea.commercial_intent as CommercialIntent;
  }
  
  // Infer from CTA intent (legacy field)
  if (idea.cta_intent) {
    const cta = idea.cta_intent.toLowerCase();
    if (cta === 'booking') return 'booking';
    if (cta === 'traffic') return 'footfall';
    if (cta === 'awareness') return 'brand';
    if (cta === 'engagement') return 'loyalty';
  }
  
  // Infer from CTA type
  if (idea.cta_type) {
    const cta = idea.cta_type.toLowerCase();
    if (cta.includes('reserve') || cta.includes('book')) return 'booking';
    if (cta.includes('visit') || cta.includes('try')) return 'footfall';
    if (cta.includes('share') || cta.includes('community')) return 'loyalty';
    return 'brand'; // Weak CTAs default to brand
  }
  
  // Infer from content_type (last resort)
  if (idea.content_type) {
    const type = idea.content_type.toLowerCase();
    if (type === 'promotional' || type === 'event') return 'footfall';
    if (type === 'behind_scenes' || type === 'team_people') return 'brand';
    return 'brand';
  }
  
  return 'unknown';
}

/**
 * Counts ideas by commercial intent.
 */
function countByIntent(ideas: IdeaValidationResult[]): Record<CommercialIntent | 'unknown', number> {
  const counts = {
    booking: 0,
    footfall: 0,
    brand: 0,
    loyalty: 0,
    unknown: 0
  };
  
  for (const idea of ideas) {
    counts[idea.commercial_intent]++;
  }
  
  return counts;
}

/**
 * Checks if idea distribution meets quota requirements.
 */
function checkQuotas(
  counts: Record<CommercialIntent | 'unknown', number>,
  directive: CommercialModeDirective
): boolean {
  const bookingMet = counts.booking >= directive.min_booking_ideas;
  const footfallMet = counts.footfall >= directive.min_footfall_ideas;
  return bookingMet && footfallMet;
}

/**
 * Calculates average commercial clarity score across all ideas.
 */
function calculateAverageScore(ideas: IdeaValidationResult[]): number {
  if (ideas.length === 0) return 0;
  const sum = ideas.reduce((acc, idea) => acc + idea.commercial_clarity_score, 0);
  return Math.round((sum / ideas.length) * 10) / 10; // Round to 1 decimal
}

/**
 * Collects all issues and warnings.
 */
function collectFeedback(
  ideaScores: IdeaValidationResult[],
  intentCounts: Record<CommercialIntent | 'unknown', number>,
  directive: CommercialModeDirective,
  quotaMet: boolean,
  avgScore: number
): { issues: string[]; warnings: string[] } {
  
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Quota issues
  if (intentCounts.booking < directive.min_booking_ideas) {
    const diff = directive.min_booking_ideas - intentCounts.booking;
    issues.push(
      `Insufficient booking ideas: need ${directive.min_booking_ideas}, have ${intentCounts.booking} (missing ${diff})`
    );
  }
  
  if (intentCounts.footfall < directive.min_footfall_ideas) {
    const diff = directive.min_footfall_ideas - intentCounts.footfall;
    issues.push(
      `Insufficient footfall ideas: need ${directive.min_footfall_ideas}, have ${intentCounts.footfall} (missing ${diff})`
    );
  }
  
  // Score issues
  if (avgScore < 3.5) {
    issues.push(
      `Average commercial clarity score ${avgScore} is below threshold (need 3.5+)`
    );
  }
  
  // Individual idea issues
  const lowScoringIdeas = ideaScores.filter(idea => idea.commercial_clarity_score < 3);
  if (lowScoringIdeas.length > 0) {
    warnings.push(
      `${lowScoringIdeas.length} ideas have low commercial clarity (score < 3): ${lowScoringIdeas.map(i => `#${i.idea_id}`).join(', ')}`
    );
  }
  
  // Unknown intent warnings
  if (intentCounts.unknown > 0) {
    warnings.push(
      `${intentCounts.unknown} ideas have unclear commercial intent`
    );
  }
  
  // At least one high-quality commercial idea
  const hasTopScorer = ideaScores.some(idea => idea.commercial_clarity_score >= 4.5);
  if (!hasTopScorer && directive.commercial_mode !== 'balanced') {
    warnings.push(
      `No standout commercial idea (score 4.5+) - consider adding one strong conversion-focused post`
    );
  }
  
  // Mode-specific checks
  if (directive.commercial_mode === 'booking_push') {
    const urgentBooking = ideaScores.filter(
      idea => idea.commercial_intent === 'booking' && 
      ideaScores.find(i => i.idea_id === idea.idea_id) // Get full idea
    ).length;
    
    if (urgentBooking === 0 && intentCounts.booking > 0) {
      warnings.push(
        "Booking Push week but no ideas with immediate booking urgency"
      );
    }
  }
  
  return { issues, warnings };
}

/**
 * Generates human-readable validation summary for logging/UI.
 */
export function formatValidationSummary(result: CommercialValidationResult): string {
  const status = result.passed ? '✓ PASSED' : '✗ FAILED';
  const lines: string[] = [
    `Commercial Validation: ${status}`,
    `Average Score: ${result.score.toFixed(1)}/5.0`,
    ``,
    `Idea Distribution:`,
    `  Booking:  ${result.booking_ideas_count} (need ${result.quota_requirements.min_booking_ideas})`,
    `  Footfall: ${result.footfall_ideas_count} (need ${result.quota_requirements.min_footfall_ideas})`,
    `  Brand:    ${result.brand_ideas_count}`,
    `  Loyalty:  ${result.loyalty_ideas_count}`,
  ];
  
  if (result.issues.length > 0) {
    lines.push(``);
    lines.push(`Issues:`);
    result.issues.forEach(issue => lines.push(`  - ${issue}`));
  }
  
  if (result.warnings.length > 0) {
    lines.push(``);
    lines.push(`Warnings:`);
    result.warnings.forEach(warning => lines.push(`  - ${warning}`));
  }
  
  return lines.join('\n');
}

/**
 * Quick validation check - returns just pass/fail.
 * Useful for control flow without detailed results.
 */
export function quickValidate(
  post_ideas: any[],
  directive: CommercialModeDirective
): boolean {
  const result = validateCommercialStrategy(post_ideas, directive, true);
  return result.passed;
}

/**
 * Exports for testing
 */
export const __testing = {
  validatePostIdea,
  calculateIdeaScore,
  extractCommercialIntent,
  countByIntent,
  checkQuotas
};
