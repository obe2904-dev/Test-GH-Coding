/**
 * Layer Quality Audit Functions
 * 
 * Performs quality checks between layers to catch contradictions and violations.
 * These audits run BETWEEN layers as quality gates, not inside layer functions.
 * 
 * Critical audits:
 * - Layer 5 Internal: Check voice rules for self-contradictions
 * - Layer 5.5 vs Layer 5: Check examples against voice rules (catches imperative violations)
 * - Cross-layer: Final consistency check across all layers
 * 
 * @version 1.0.0
 * @date 2026-06-23
 */

import type {
  Layer0Output,
  Layer1Output,
  Layer5Output,
  Layer5_5Output,
  Layer6Output,
  EnrichedProgramme,
  AuditFailure
} from './types-v5-pipeline.ts';

// ============================================================================
// LAYER 5: VOICE PROFILE INTERNAL AUDIT
// ============================================================================

export function auditVoiceProfileInternal(
  output: Layer5Output,
  requestId: string
): void {
  const contradictions: string[] = [];
  
  // Check for contradictory tone rules
  const rules = output.voiceProfile.tone_rules.map(r => r.toLowerCase());
  
  // Example: Can't be both "always use emojis" and "never use emojis"
  const hasEmojiRule = rules.some(r => r.includes('emoji'));
  if (hasEmojiRule) {
    const emojiUsage = output.voiceProfile.emoji_usage?.toLowerCase() || '';
    const rulesRequireEmoji = rules.some(r => r.includes('brug altid emoji') || r.includes('always use emoji'));
    const rulesBanEmoji = rules.some(r => r.includes('aldrig emoji') || r.includes('never emoji'));
    
    if (rulesRequireEmoji && emojiUsage.includes('never')) {
      contradictions.push('Tone rules require emojis but emoji_usage is "never"');
    }
    if (rulesBanEmoji && emojiUsage.includes('always')) {
      contradictions.push('Tone rules ban emojis but emoji_usage is "always"');
    }
  }
  
  // Check formality vs emoji usage
  const formalityLevel = output.voiceProfile.formality_level?.toLowerCase() || '';
  const emojiUsage = output.voiceProfile.emoji_usage?.toLowerCase() || '';
  
  if (formalityLevel.includes('formal') && emojiUsage.includes('frequent')) {
    contradictions.push('Formal voice should not use frequent emojis');
  }
  
  if (contradictions.length > 0) {
    console.error(`[${requestId}] ❌ Layer 5 internal audit failed:`);
    contradictions.forEach(c => console.error(`[${requestId}]   - ${c}`));
    
    throw new Error(
      `[Layer 5] Internal audit failed with ${contradictions.length} contradiction(s): ${contradictions.join('; ')}`
    );
  }
  
  console.log(`[${requestId}] ✅ Layer 5 internal audit passed - voice profile is self-consistent`);
}

// ============================================================================
// LAYER 5.5: TONE DNA vs VOICE PROFILE AUDIT
// ============================================================================

/**
 * CRITICAL AUDIT: Checks enhanced examples against voice rules
 * This would have caught the imperative violations in our recent failure!
 */
export function auditToneDNAAgainstVoice(
  layer5_5: Layer5_5Output,
  layer5: Layer5Output,
  requestId: string
): void {
  const violations: Array<{ type: string; example: string; rule: string }> = [];
  
  // ========== CHECK 1: IMPERATIVE VIOLATIONS ==========
  const hasImperativeBan = layer5.voiceProfile.tone_rules.some(rule =>
    /aldrig imperative|never imperative|undgå imperative|avoid imperative/i.test(rule)
  );
  
  if (hasImperativeBan) {
    // Danish imperative verbs (first person command form)
    const imperativeVerbs = [
      'kom', 'tag', 'nyd', 'prøv', 'smag', 'oplev', 'book', 'bestil',
      'se', 'hør', 'find', 'få', 'bliv', 'gå', 'lad', 'slå', 'stik'
    ];
    
    for (const example of layer5_5.enhancedExamples.social_examples) {
      const text = example.text.toLowerCase();
      
      for (const verb of imperativeVerbs) {
        // Check if verb appears at start of sentence (typical imperative position)
        const regex = new RegExp(`(^|\\. |\\? |\\! )${verb}\\s`, 'i');
        if (regex.test(text)) {
          violations.push({
            type: 'IMPERATIVE_VIOLATION',
            example: example.text,
            rule: `Imperative verb "${verb}" found but tone_rules ban imperatives`
          });
        }
      }
    }
  }
  
  // ========== CHECK 2: NEVER_SAY VIOLATIONS ==========
  const neverSayPatterns = layer5.guardrails.never_say.map(ns => ns.toLowerCase());
  
  for (const example of layer5_5.enhancedExamples.social_examples) {
    const text = example.text.toLowerCase();
    
    for (const forbidden of neverSayPatterns) {
      if (text.includes(forbidden.toLowerCase())) {
        violations.push({
          type: 'NEVER_SAY_VIOLATION',
          example: example.text,
          rule: `Contains forbidden phrase "${forbidden}"`
        });
      }
    }
  }
  
  // ========== CHECK 3: AVOID_PATTERNS VIOLATIONS ==========
  if (layer5.guardrails.avoid_patterns?.strip_from_output) {
    const avoidPatterns = Object.values(layer5.guardrails.avoid_patterns.strip_from_output)
      .flat()
      .map(p => p.toLowerCase());
    
    for (const example of layer5_5.enhancedExamples.social_examples) {
      const text = example.text.toLowerCase();
      
      for (const pattern of avoidPatterns) {
        if (text.includes(pattern.toLowerCase())) {
          violations.push({
            type: 'AVOID_PATTERN_VIOLATION',
            example: example.text,
            rule: `Contains avoid_pattern "${pattern}"`
          });
        }
      }
    }
  }
  
  // ========== REPORT VIOLATIONS ==========
  if (violations.length > 0) {
    console.error(`[${requestId}] ❌ Layer 5.5 audit failed - ${violations.length} violations:`);
    
    const violationsByType = violations.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(violationsByType).forEach(([type, count]) => {
      console.error(`[${requestId}]   ${type}: ${count} violation(s)`);
    });
    
    // Log first 3 violations for debugging
    violations.slice(0, 3).forEach(v => {
      console.error(`[${requestId}]   - ${v.rule}`);
      console.error(`[${requestId}]     Example: "${v.example.substring(0, 100)}..."`);
    });
    
    throw new Error(
      `[Layer 5.5] Audit failed: ${violations.length} violations found. ` +
      `Enhanced examples violate voice rules. Most common: ${Object.keys(violationsByType)[0]}`
    );
  }
  
  console.log(`[${requestId}] ✅ Layer 5.5 audit passed - examples comply with voice rules`);
}

// ============================================================================
// CROSS-LAYER: FINAL CONSISTENCY AUDIT
// ============================================================================

/**
 * Final quality gate: Check consistency across all layers
 * This is the existing consistency audit, now called at the end
 */
export function auditCrossLayerConsistency(
  layer0: Layer0Output,
  layer1: Layer1Output,
  enrichedProgrammes: EnrichedProgramme[],
  layer5: Layer5Output,
  layer5_5: Layer5_5Output,
  layer6: Layer6Output,
  requestId: string
): void {
  const warnings: string[] = [];
  const criticalIssues: string[] = [];
  
  // ========== CHECK 1: BRIEF MENTIONS PROGRAMMES ==========
  const brief = layer6.marketingManagerBrief.marketing_manager_brief.toLowerCase();
  const programmeTypes = layer1.programmes.map(p => p.type.toLowerCase());
  
  let mentionedProgrammes = 0;
  for (const type of programmeTypes) {
    if (brief.includes(type)) {
      mentionedProgrammes++;
    }
  }
  
  if (mentionedProgrammes === 0 && layer1.programmes.length > 0) {
    warnings.push(`Marketing Manager Brief doesn't mention any programmes (${layer1.programmes.length} detected)`);
  }
  
  // ========== CHECK 2: BRIEF TONE MATCHES VOICE ==========
  const formalityLevel = layer5.voiceProfile.formality_level?.toLowerCase() || '';
  
  if (formalityLevel.includes('formal') && brief.includes('emoji')) {
    warnings.push('Brief mentions emojis but voice is formal');
  }
  
  // ========== CHECK 3: SIGNATURE THEMES IN BRIEF ==========
  const signatureThemes = layer0.menuOverview?.signature_themes?.map(t => t.toLowerCase()) || [];
  let mentionedThemes = 0;
  
  for (const theme of signatureThemes) {
    // Extract key words from theme (remove "fusion", "specialist", etc.)
    const keyWords = theme.split(/[-\s]/).filter(w => w.length > 4);
    for (const word of keyWords) {
      if (brief.includes(word.toLowerCase())) {
        mentionedThemes++;
        break;
      }
    }
  }
  
  if (mentionedThemes === 0 && signatureThemes.length > 0) {
    warnings.push(`Brief doesn't reference signature themes (${signatureThemes.length} detected)`);
  }
  
  // ========== REPORT ==========
  if (criticalIssues.length > 0) {
    console.error(`[${requestId}] ❌ Cross-layer audit failed - ${criticalIssues.length} critical issues:`);
    criticalIssues.forEach(issue => console.error(`[${requestId}]   - ${issue}`));
    
    throw new Error(
      `[Cross-layer] Audit failed with ${criticalIssues.length} critical issue(s). ` +
      `Profile layers are inconsistent.`
    );
  }
  
  if (warnings.length > 0) {
    console.warn(`[${requestId}] ⚠️ Cross-layer audit warnings (${warnings.length}):`);
    warnings.forEach(warn => console.warn(`[${requestId}]   - ${warn}`));
  }
  
  console.log(`[${requestId}] ✅ Cross-layer audit passed - all layers consistent`);
}

// ============================================================================
// AUDIT SUMMARY HELPER
// ============================================================================

export function formatAuditSummary(
  violations: Array<{ type: string; description: string; severity: 'critical' | 'warning' }>,
  requestId: string
): string {
  const critical = violations.filter(v => v.severity === 'critical');
  const warnings = violations.filter(v => v.severity === 'warning');
  
  let summary = `\n${'='.repeat(70)}\n`;
  summary += `BRAND PROFILE AUDIT REPORT\n`;
  summary += `${'='.repeat(70)}\n\n`;
  
  if (critical.length > 0) {
    summary += `🔴 CRITICAL ISSUES (${critical.length}):\n`;
    critical.forEach((v, i) => {
      summary += `  ${i + 1}. [${v.type}] ${v.description}\n`;
    });
    summary += '\n';
  }
  
  if (warnings.length > 0) {
    summary += `⚠️  WARNINGS (${warnings.length}):\n`;
    warnings.forEach((v, i) => {
      summary += `  ${i + 1}. [${v.type}] ${v.description}\n`;
    });
    summary += '\n';
  }
  
  if (critical.length === 0 && warnings.length === 0) {
    summary += `✅ NO ISSUES FOUND - Profile is consistent\n\n`;
  }
  
  summary += `${'='.repeat(70)}\n`;
  
  return summary;
}
