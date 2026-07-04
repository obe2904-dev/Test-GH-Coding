// ============================================================================
// CONSISTENCY AUDIT - Brand Profile Cross-Validation
// ============================================================================
// Validates that all brand profile components are consistent with each other
// 
// PURPOSE:
// - Detect contradictions between voice rules and examples
// - Verify formality consistency across components
// - Catch banned words in examples
// - Identify duplicate or missing fields
// 
// USED BY:
// - brand-profile-generator-v5 (before database save)
// 
// OUTPUT:
// - List of contradictions with severity and suggested fixes
// - Auto-fix capability for simple issues
// ============================================================================

import type { V5Voice, V5Guardrails, V5WritingExamples, V5ToneDNA } from './types-v5.ts';

export interface ContradictionFinding {
  type: 'never_say_violation' | 'imperative_violation' | 'formality_conflict' | 'duplicate_field' | 'missing_field' | 'tone_rule_violation';
  severity: 'critical' | 'warning';
  description: string;
  field_path: string;
  example_value?: string;
  auto_fixable: boolean;
  suggested_fix?: string;
}

export interface AuditResult {
  is_consistent: boolean;
  contradictions: ContradictionFinding[];
  auto_fixes_applied: number;
}

export interface AuditInput {
  voiceProfile: V5Voice;
  guardrails: V5Guardrails;
  writingExamples: V5WritingExamples;
  enhancedExamples?: { 
    social_examples: Array<{ text: string; rationale?: string } | string>; 
    avoid_examples?: Array<{ text: string; why_fails?: string } | string>;
  };
  toneDNA?: V5ToneDNA;
  marketingBrief?: string;
}

/**
 * Audit brand profile consistency across all components
 * Checks for contradictions between rules, guardrails, and examples
 */
export function auditBrandProfileConsistency(profile: AuditInput): AuditResult {
  
  const contradictions: ContradictionFinding[] = [];
  
  // ========================================
  // CHECK 1: Enhanced Examples vs Never-Say
  // ========================================
  if (profile.enhancedExamples?.social_examples) {
    for (const example of profile.enhancedExamples.social_examples) {
      const exampleText = typeof example === 'object' ? example.text : example;
      
      for (const neverSayRule of profile.guardrails.never_say) {
        // Parse rule: "word → (undgå)" or "word (context) → alternative"
        const bannedPart = neverSayRule.split('→')[0].trim();
        const bannedWord = bannedPart.replace(/\(.*?\)/g, '').trim().toLowerCase();
        
        if (exampleText.toLowerCase().includes(bannedWord)) {
          contradictions.push({
            type: 'never_say_violation',
            severity: 'critical',
            description: `Example contains banned word/phrase "${bannedWord}"`,
            field_path: 'enhanced_social_examples',
            example_value: exampleText.substring(0, 80) + (exampleText.length > 80 ? '...' : ''),
            auto_fixable: false,  // Requires regeneration
            suggested_fix: `Regenerate examples with never_say rules: ${neverSayRule}`
          });
        }
      }
    }
  }
  
  // ========================================
  // CHECK 2: Imperative Violations
  // ========================================
  const hasImperativeBan = profile.voiceProfile.tone_rules.some(rule =>
    /aldrig imperative|never imperative|undgå imperative|avoid imperative/i.test(rule)
  );
  
  if (hasImperativeBan && profile.enhancedExamples?.social_examples) {
    // Danish imperative verbs (first person command form)
    const imperativeVerbs = [
      'kom', 'tag', 'nyd', 'prøv', 'smag', 'oplev', 'book', 'bestil', 
      'se', 'hør', 'find', 'få', 'bliv', 'gå', 'lad', 'slå', 'stik'
    ];
    
    for (const example of profile.enhancedExamples.social_examples) {
      const exampleText = typeof example === 'object' ? example.text : example;
      const words = exampleText.toLowerCase().split(/\s+/);
      
      for (const verb of imperativeVerbs) {
        // Check if verb appears at start of sentence (typical imperative position)
        const sentences = exampleText.split(/[.!?]+/).map(s => s.trim().toLowerCase());
        for (const sentence of sentences) {
          if (sentence.startsWith(verb + ' ') || sentence === verb) {
            contradictions.push({
              type: 'imperative_violation',
              severity: 'critical',
              description: `Example uses imperative verb "${verb}" but tone_rules ban imperatives`,
              field_path: 'enhanced_social_examples',
              example_value: exampleText.substring(0, 80) + (exampleText.length > 80 ? '...' : ''),
              auto_fixable: false,
              suggested_fix: `Regenerate examples without imperative verbs`
            });
            break;
          }
        }
      }
    }
  }
  
  // ========================================
  // CHECK 3: Formality Consistency
  // ========================================
  if (profile.toneDNA && profile.marketingBrief) {
    const voiceFormality = profile.voiceProfile.formality_level;
    const toneDNAFormality = (profile.toneDNA.culinary_character?.formality_requirement || '').toLowerCase();
    const briefFormality = profile.marketingBrief.toLowerCase();
    
    const conflicts: string[] = [];
    
    // Check voice vs tone DNA
    if (voiceFormality === 'informal' && /formel/i.test(toneDNAFormality) && !/casual|uformel|informal/i.test(toneDNAFormality)) {
      conflicts.push('voice=informal but toneDNA=formal');
    }
    if (voiceFormality === 'formal' && /casual|uformel|afslappet/i.test(toneDNAFormality)) {
      conflicts.push('voice=formal but toneDNA=casual');
    }
    
    // Check voice vs marketing brief
    if (voiceFormality === 'informal' && /semi-formel|formel/i.test(briefFormality) && !/casual|uformel/i.test(briefFormality)) {
      conflicts.push('voice=informal but brief mentions "formel"');
    }
    
    if (conflicts.length > 0) {
      contradictions.push({
        type: 'formality_conflict',
        severity: 'warning',
        description: `Formality mismatch: ${conflicts.join('; ')}`,
        field_path: 'voice.formality_level, marketing_manager_brief, tone_dna.formality_requirement',
        auto_fixable: true,
        suggested_fix: `Standardize all to voice.formality_level="${voiceFormality}"`
      });
    }
  }
  
  // ========================================
  // CHECK 4: Missing good_examples
  // ========================================
  if (!profile.writingExamples.good_examples || profile.writingExamples.good_examples.length === 0) {
    contradictions.push({
      type: 'missing_field',
      severity: 'warning',
      description: 'writing_examples.good_examples is empty',
      field_path: 'brand_profile_v5.voice.writing_examples.good_examples',
      auto_fixable: true,
      suggested_fix: 'Populate from enhanced_social_examples'
    });
  }
  
  // ========================================
  // CHECK 5: Duplicate Fields (style_rules, structural_rules)
  // ========================================
  // Note: This check requires access to raw JSONB, handled in orchestrator
  // Included here for completeness but marked as non-applicable
  
  // ========================================
  // CHECK 6: Generic Marketing Patterns in Examples
  // ========================================
  if (profile.enhancedExamples?.social_examples && profile.guardrails.avoid_patterns?.strip_from_output?.generic_marketing) {
    for (const example of profile.enhancedExamples.social_examples) {
      const exampleText = typeof example === 'object' ? example.text : example;
      
      for (const pattern of profile.guardrails.avoid_patterns.strip_from_output.generic_marketing) {
        const patternLower = pattern.toLowerCase();
        if (exampleText.toLowerCase().includes(patternLower)) {
          contradictions.push({
            type: 'tone_rule_violation',
            severity: 'warning',
            description: `Example contains generic marketing pattern "${pattern}"`,
            field_path: 'enhanced_social_examples',
            example_value: exampleText.substring(0, 80) + (exampleText.length > 80 ? '...' : ''),
            auto_fixable: false,
            suggested_fix: `Consider regenerating examples to avoid pattern: ${pattern}`
          });
        }
      }
    }
  }
  
  // ========================================
  // CHECK 7: Avoid Examples Validation
  // ========================================
  // Only warn if we have 5+ social examples but no avoid examples
  // (Avoid examples are optional, but recommended for training)
  if (profile.enhancedExamples?.social_examples && 
      profile.enhancedExamples.social_examples.length >= 5 &&
      (!profile.enhancedExamples.avoid_examples || profile.enhancedExamples.avoid_examples.length === 0)) {
    contradictions.push({
      type: 'missing_field',
      severity: 'warning',
      description: 'avoid_examples is empty - should have counter-examples',
      field_path: 'enhanced_avoid_examples',
      auto_fixable: false,
      suggested_fix: 'Generate at least 3-5 avoid examples showing what NOT to do'
    });
  }
  
  return {
    is_consistent: contradictions.filter(c => c.severity === 'critical').length === 0,
    contradictions,
    auto_fixes_applied: 0  // Auto-fixes would be applied by caller if needed
  };
}

/**
 * Format audit results for logging
 */
export function formatAuditReport(audit: AuditResult, requestId: string): string {
  let report = `\n[${requestId}] 🔍 CONSISTENCY AUDIT REPORT\n`;
  report += `[${requestId}] ${'='.repeat(60)}\n`;
  
  if (audit.is_consistent) {
    report += `[${requestId}] ✅ Status: CONSISTENT - No critical contradictions found\n`;
  } else {
    report += `[${requestId}] ❌ Status: INCONSISTENT - ${audit.contradictions.filter(c => c.severity === 'critical').length} critical contradictions\n`;
  }
  
  report += `[${requestId}] Total issues: ${audit.contradictions.length} (${audit.contradictions.filter(c => c.severity === 'critical').length} critical, ${audit.contradictions.filter(c => c.severity === 'warning').length} warnings)\n`;
  
  if (audit.contradictions.length > 0) {
    report += `[${requestId}]\n[${requestId}] CONTRADICTIONS:\n`;
    
    audit.contradictions.forEach((contradiction, idx) => {
      const icon = contradiction.severity === 'critical' ? '🔴' : '⚠️';
      report += `[${requestId}] ${icon} ${idx + 1}. ${contradiction.type.toUpperCase()}\n`;
      report += `[${requestId}]    Description: ${contradiction.description}\n`;
      report += `[${requestId}]    Field: ${contradiction.field_path}\n`;
      
      if (contradiction.example_value) {
        report += `[${requestId}]    Example: "${contradiction.example_value}"\n`;
      }
      
      if (contradiction.suggested_fix) {
        report += `[${requestId}]    Fix: ${contradiction.suggested_fix}\n`;
      }
      
      if (contradiction.auto_fixable) {
        report += `[${requestId}]    Auto-fixable: Yes\n`;
      }
      
      report += `[${requestId}]\n`;
    });
  }
  
  report += `[${requestId}] ${'='.repeat(60)}\n`;
  
  return report;
}

/**
 * Quick validation check for critical issues only
 * Use this for fast validation without detailed reporting
 */
export function hasNoContradictions(profile: AuditInput): boolean {
  const audit = auditBrandProfileConsistency(profile);
  return audit.is_consistent;
}
