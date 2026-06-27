// ============================================================================
// CONSISTENCY AUDIT TESTS
// ============================================================================
// Tests for brand profile consistency audit module
// Run with: deno test --allow-env --allow-read supabase/functions/_shared/brand-profile/consistency-audit.test.ts
// ============================================================================

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { auditBrandProfileConsistency, formatAuditReport } from './consistency-audit.ts';
import type { AuditInput } from './consistency-audit.ts';

// ============================================================================
// TEST 1: No Contradictions (Clean Profile)
// ============================================================================
Deno.test('Consistency Audit - Clean profile passes', () => {
  const cleanProfile: AuditInput = {
    voiceProfile: {
      tone_rules: [
        'Brug korte sætninger',
        'Fokusér på kvalitet'
      ],
      formality_level: 'informal',
      personality_traits: ['varm', 'lokal', 'autentisk'],
      social_writing_examples: [],
      typical_sentence_structures: []
    } as any,
    guardrails: {
      never_say: [
        'perfekt → (undgå)',
        'unik → (undgå)'
      ],
      avoid_patterns: {
        strip_from_output: {
          generic_marketing: ['det perfekte sted', 'unik oplevelse']
        }
      },
      content_exclusions: [],
      factual_constraints: []
    } as any,
    writingExamples: {
      typical_openings: ['Vi har åbent'],
      typical_closings: ['Vel mødt'],
      good_examples: [
        'Vi har åbent til kl. 22 i dag',
        'Frisk øl fra Aarhus Bryghus'
      ],
      signature_phrases: []
    } as any,
    enhancedExamples: {
      social_examples: [
        { text: 'Vi har åbent til kl. 22 i dag', rationale: 'Short and direct' },
        { text: 'Frisk øl fra Aarhus Bryghus', rationale: 'Local reference' }
      ],
      avoid_examples: []
    }
  };

  const audit = auditBrandProfileConsistency(cleanProfile);
  
  assertEquals(audit.is_consistent, true, 'Clean profile should be consistent');
  assertEquals(audit.contradictions.length, 0, 'Should have no contradictions');
});

// ============================================================================
// TEST 2: Never-Say Violation
// ============================================================================
Deno.test('Consistency Audit - Detects never-say violations', () => {
  const profileWithBannedWords: AuditInput = {
    voiceProfile: {
      tone_rules: ['Brug korte sætninger'],
      formality_level: 'informal',
      personality_traits: ['varm'],
      social_writing_examples: [],
      typical_sentence_structures: []
    } as any,
    guardrails: {
      never_say: [
        'perfekt → (undgå)',
        'nyd det gode liv → (undgå)'
      ],
      avoid_patterns: {},
      content_exclusions: [],
      factual_constraints: []
    } as any,
    writingExamples: {
      typical_openings: [],
      typical_closings: [],
      good_examples: [],
      signature_phrases: []
    } as any,
    enhancedExamples: {
      social_examples: [
        { text: 'Nyd det gode liv ved åen', rationale: 'Bad example' },
        { text: 'Det perfekte sted til frokost', rationale: 'Another bad one' }
      ],
      avoid_examples: []
    }
  };

  const audit = auditBrandProfileConsistency(profileWithBannedWords);
  
  assertEquals(audit.is_consistent, false, 'Should detect contradictions');
  const neverSayViolations = audit.contradictions.filter(c => c.type === 'never_say_violation');
  assertEquals(neverSayViolations.length >= 2, true, 'Should detect at least 2 never-say violations');
  
  // Check that all violations are marked as critical
  neverSayViolations.forEach(v => {
    assertEquals(v.severity, 'critical', 'Never-say violations should be critical');
    assertEquals(v.auto_fixable, false, 'Never-say violations require regeneration');
  });
});

// ============================================================================
// TEST 3: Imperative Violation
// ============================================================================
Deno.test('Consistency Audit - Detects imperative violations', () => {
  const profileWithImperatives: AuditInput = {
    voiceProfile: {
      tone_rules: [
        'Brug aldrig imperative',
        'Fokusér på fakta'
      ],
      formality_level: 'informal',
      personality_traits: ['direkte'],
      social_writing_examples: [],
      typical_sentence_structures: []
    } as any,
    guardrails: {
      never_say: [],
      avoid_patterns: {},
      content_exclusions: [],
      factual_constraints: []
    } as any,
    writingExamples: {
      typical_openings: [],
      typical_closings: [],
      good_examples: [],
      signature_phrases: []
    } as any,
    enhancedExamples: {
      social_examples: [
        { text: 'Kom forbi i dag', rationale: 'Uses imperative' },
        { text: 'Tag en pause ved åen', rationale: 'Uses imperative' },
        { text: 'Vi har åbent til kl. 22', rationale: 'Good - no imperative' }
      ],
      avoid_examples: []
    }
  };

  const audit = auditBrandProfileConsistency(profileWithImperatives);
  
  assertEquals(audit.is_consistent, false, 'Should detect imperative violations');
  const imperativeViolations = audit.contradictions.filter(c => c.type === 'imperative_violation');
  assertEquals(imperativeViolations.length >= 1, true, 'Should detect imperative violations');
  
  imperativeViolations.forEach(v => {
    assertEquals(v.severity, 'critical', 'Imperative violations should be critical');
  });
});

// ============================================================================
// TEST 4: Formality Conflict
// ============================================================================
Deno.test('Consistency Audit - Detects formality conflicts', () => {
  const profileWithFormalityConflict: AuditInput = {
    voiceProfile: {
      tone_rules: ['Brug korte sætninger'],
      formality_level: 'informal',
      personality_traits: ['casual'],
      social_writing_examples: [],
      typical_sentence_structures: []
    } as any,
    guardrails: {
      never_say: [],
      avoid_patterns: {},
      content_exclusions: [],
      factual_constraints: []
    } as any,
    writingExamples: {
      typical_openings: [],
      typical_closings: [],
      good_examples: [],
      signature_phrases: []
    } as any,
    toneDNA: {
      culinary_character: {
        formality_requirement: 'Semi-formel og elegant'
      }
    } as any,
    marketingBrief: 'Brug en semi-formel tone der...'
  };

  const audit = auditBrandProfileConsistency(profileWithFormalityConflict);
  
  const formalityConflicts = audit.contradictions.filter(c => c.type === 'formality_conflict');
  assertEquals(formalityConflicts.length >= 1, true, 'Should detect formality conflicts');
  
  formalityConflicts.forEach(v => {
    assertEquals(v.severity, 'warning', 'Formality conflicts should be warnings');
    assertEquals(v.auto_fixable, true, 'Formality conflicts can be auto-fixed');
  });
});

// ============================================================================
// TEST 5: Missing good_examples
// ============================================================================
Deno.test('Consistency Audit - Detects missing good_examples', () => {
  const profileWithMissingExamples: AuditInput = {
    voiceProfile: {
      tone_rules: ['Brug korte sætninger'],
      formality_level: 'informal',
      personality_traits: ['varm'],
      social_writing_examples: [],
      typical_sentence_structures: []
    } as any,
    guardrails: {
      never_say: [],
      avoid_patterns: {},
      content_exclusions: [],
      factual_constraints: []
    } as any,
    writingExamples: {
      typical_openings: [],
      typical_closings: [],
      good_examples: [],  // Empty!
      signature_phrases: []
    } as any,
    enhancedExamples: {
      social_examples: [
        { text: 'Vi har åbent', rationale: 'Good' }
      ],
      avoid_examples: []
    }
  };

  const audit = auditBrandProfileConsistency(profileWithMissingExamples);
  
  const missingFieldIssues = audit.contradictions.filter(c => c.type === 'missing_field');
  assertEquals(missingFieldIssues.length >= 1, true, 'Should detect missing good_examples');
  
  missingFieldIssues.forEach(v => {
    assertEquals(v.severity, 'warning', 'Missing fields should be warnings');
  });
});

// ============================================================================
// TEST 6: Generic Marketing Patterns
// ============================================================================
Deno.test('Consistency Audit - Detects generic marketing patterns', () => {
  const profileWithGenericMarketing: AuditInput = {
    voiceProfile: {
      tone_rules: ['Undgå generisk salgssprog'],
      formality_level: 'informal',
      personality_traits: ['autentisk'],
      social_writing_examples: [],
      typical_sentence_structures: []
    } as any,
    guardrails: {
      never_say: [],
      avoid_patterns: {
        strip_from_output: {
          generic_marketing: [
            'det perfekte sted',
            'unik oplevelse',
            'et besøg værd'
          ]
        }
      },
      content_exclusions: [],
      factual_constraints: []
    } as any,
    writingExamples: {
      typical_openings: [],
      typical_closings: [],
      good_examples: ['Vi har åbent'],
      signature_phrases: []
    } as any,
    enhancedExamples: {
      social_examples: [
        { text: 'Det perfekte sted til frokost', rationale: 'Bad - generic' },
        { text: 'En unik oplevelse ved åen', rationale: 'Bad - generic' },
        { text: 'Vi har frisk øl fra Aarhus', rationale: 'Good - specific' }
      ],
      avoid_examples: []
    }
  };

  const audit = auditBrandProfileConsistency(profileWithGenericMarketing);
  
  const genericMarketingIssues = audit.contradictions.filter(c => c.type === 'tone_rule_violation');
  assertEquals(genericMarketingIssues.length >= 1, true, 'Should detect generic marketing patterns');
  
  genericMarketingIssues.forEach(v => {
    assertEquals(v.severity, 'warning', 'Generic marketing should be warnings');
  });
});

// ============================================================================
// TEST 7: Format Audit Report
// ============================================================================
Deno.test('Consistency Audit - Format audit report', () => {
  const profileWithIssues: AuditInput = {
    voiceProfile: {
      tone_rules: ['Brug aldrig imperative'],
      formality_level: 'informal',
      personality_traits: ['varm'],
      social_writing_examples: [],
      typical_sentence_structures: []
    } as any,
    guardrails: {
      never_say: ['perfekt → (undgå)'],
      avoid_patterns: {},
      content_exclusions: [],
      factual_constraints: []
    } as any,
    writingExamples: {
      typical_openings: [],
      typical_closings: [],
      good_examples: [],
      signature_phrases: []
    } as any,
    enhancedExamples: {
      social_examples: [
        { text: 'Kom og nyd det perfekte sted', rationale: 'Bad' }
      ],
      avoid_examples: []
    }
  };

  const audit = auditBrandProfileConsistency(profileWithIssues);
  const report = formatAuditReport(audit, 'TEST-123');
  
  assertExists(report, 'Report should exist');
  assertEquals(report.includes('CONSISTENCY AUDIT REPORT'), true, 'Report should have header');
  assertEquals(report.includes('TEST-123'), true, 'Report should include request ID');
  assertEquals(report.includes('CONTRADICTIONS'), true, 'Report should list contradictions');
});

// ============================================================================
// TEST 8: Multiple Contradiction Types
// ============================================================================
Deno.test('Consistency Audit - Handles multiple contradiction types', () => {
  const messyProfile: AuditInput = {
    voiceProfile: {
      tone_rules: [
        'Brug aldrig imperative',
        'Undgå generisk salgssprog'
      ],
      formality_level: 'informal',
      personality_traits: ['casual'],
      social_writing_examples: [],
      typical_sentence_structures: []
    } as any,
    guardrails: {
      never_say: [
        'perfekt → (undgå)',
        'nyd → (undgå)'
      ],
      avoid_patterns: {
        strip_from_output: {
          generic_marketing: ['det perfekte sted']
        }
      },
      content_exclusions: [],
      factual_constraints: []
    } as any,
    writingExamples: {
      typical_openings: [],
      typical_closings: [],
      good_examples: [],  // Missing!
      signature_phrases: []
    } as any,
    enhancedExamples: {
      social_examples: [
        { text: 'Kom og nyd det perfekte sted', rationale: 'All violations' },
        { text: 'Tag en pause i dag', rationale: 'Imperative' },
        { text: 'Det perfekte valg', rationale: 'Never-say + generic' }
      ],
      avoid_examples: []
    },
    toneDNA: {
      culinary_character: {
        formality_requirement: 'Formel'
      }
    } as any,
    marketingBrief: 'Brug en formel tone'
  };

  const audit = auditBrandProfileConsistency(messyProfile);
  
  assertEquals(audit.is_consistent, false, 'Messy profile should fail audit');
  assertEquals(audit.contradictions.length >= 5, true, 'Should detect multiple issues');
  
  // Should have different types
  const types = new Set(audit.contradictions.map(c => c.type));
  assertEquals(types.size >= 3, true, 'Should detect multiple contradiction types');
  
  // Critical issues should prevent save
  const criticalCount = audit.contradictions.filter(c => c.severity === 'critical').length;
  assertEquals(criticalCount >= 2, true, 'Should have multiple critical issues');
});

console.log('✅ All consistency audit tests passed!');
