// ============================================================================
// VALIDATION SYSTEM
// ============================================================================
// Validates generated examples match voice rules
// Danish cliché detection + retry logic with banned patterns
// ============================================================================

import { extractMaxWordsFromRules } from './voice-archetypes.ts';

export type ViolationType = 
  | 'sentence_length' 
  | 'missing_location' 
  | 'professional_quality' 
  | 'concreteness' 
  | 'rule_mismatch';

export type Severity = 'critical' | 'warning';

export interface Violation {
  type: ViolationType;
  severity: Severity;
  violation: string;          // Danish description
  example_snippet?: string;
  suggestion?: string;        // Danish suggestion
}

export interface ValidationResult {
  passes: boolean;            // true if no critical violations
  score: number;              // 0-1
  violations: Violation[];
}

export interface ValidationContext {
  voice_rules: string[];
  location_signature?: string;
  location_context_weight?: 'high' | 'medium' | 'low';
  sentence_structure?: string;
  max_words_override?: number;
}

// ============================================================================
// DANISH HOSPITALITY CLICHÉS (Banned Patterns)
// ============================================================================

export const DANISH_HOSPITALITY_CLICHES = [
  'uforglemmelig',
  'passion',
  'kærlighed',
  'emmer af',
  'forføre',
  'smagsløg',
  'smagsprøve på vores passion',
  'med kærlighed',
  'forbereder.*med kærlighed',
  'lad.*smagsløg.*danse',
  'forkæle dig',
  'forkæl dig selv',
  'forkælelse',
  'weekendforkælelse',
  'madglæde',
  'lækkerier',
  'vidunderlig oplevelse',
  'magisk atmosfære',
  'fantastisk oplevelse',
  'utrolig oplevelse',
  'utrolig stemning',
  'elsker',
  'glæd dig til at se',
  'glæd dig til',
  'klar til at',
  'passion for',
  'elsker at',
  'lad os forkæle'
];

// Additional abstract words to watch
const ABSTRACT_HOSPITALITY_WORDS = [
  'oplevelse',
  'stemning',
  'atmosfære',
  'følelse',
  'kærlighed',
  'passion',
  'magie',
  'drøm'
];

// Concrete indicators (positive signals)
const CONCRETE_INDICATORS = [
  /\d+/,                           // Numbers (kl. 10, 45 kr, 3 retter)
  /kl\.\s*\d+/i,                   // Times (kl. 10, kl. 17-22)
  /kr\.?|kroner/i,                 // Prices
  /mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag/i,  // Days
  /morgen|formiddag|eftermiddag|aften/i,  // Time of day
  /ved åen|ved havnen|ved stranden|nyhavn|vesterbro|nørrebro/i,  // Location names
];

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export function validateExamples(
  examples: string[],
  context: ValidationContext
): ValidationResult {
  const violations: Violation[] = [];
  let totalScore = 1.0;
  
  for (const example of examples) {
    // Check 1: Sentence Length
    const lengthViolation = checkSentenceLength(example, context);
    if (lengthViolation) {
      violations.push(lengthViolation);
      totalScore -= 0.2;
    }
    
    // Check 2: Location Mention
    const locationViolation = checkLocationMention(example, context);
    if (locationViolation) {
      violations.push(locationViolation);
      totalScore -= 0.25;
    }
    
    // Check 3: Cliché Detection
    const clicheViolations = checkCliches(example);
    for (const violation of clicheViolations) {
      violations.push(violation);
      totalScore -= 0.3;
    }
    
    // Check 4: Concreteness
    const concreteViolation = checkConcreteness(example);
    if (concreteViolation) {
      violations.push(concreteViolation);
      totalScore -= 0.15;
    }
  }
  
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  
  return {
    passes: criticalViolations.length === 0,
    score: Math.max(0, Math.min(1, totalScore)),
    violations
  };
}

// ============================================================================
// CHECK 1: SENTENCE LENGTH
// ============================================================================

function checkSentenceLength(
  example: string,
  context: ValidationContext
): Violation | null {
  // Extract max words from rules or use override
  let maxWords = context.max_words_override || extractMaxWordsFromRules(context.voice_rules);
  
  // If no explicit max, check for sentence structure preference
  if (!maxWords && context.sentence_structure === 'short_declarative') {
    maxWords = 15;  // Default for short declarative
  }
  
  if (!maxWords) return null;  // No length requirement
  
  // Calculate average sentence length
  const sentences = example.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let totalWords = 0;
  let sentenceCount = 0;
  
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    totalWords += words;
    sentenceCount++;
  }
  
  const avgWords = sentenceCount > 0 ? totalWords / sentenceCount : 0;
  
  // Allow 20% over as tolerance
  if (avgWords > maxWords * 1.2) {
    return {
      type: 'sentence_length',
      severity: 'critical',
      violation: `Gennemsnitlig sætningslængde ${Math.round(avgWords)} ord, regel siger max ${maxWords} ord`,
      example_snippet: example.substring(0, 100) + '...',
      suggestion: `Opdel lange sætninger. Mål: max ${maxWords} ord per sætning.`
    };
  }
  
  return null;
}

// ============================================================================
// CHECK 2: LOCATION MENTION
// ============================================================================

function checkLocationMention(
  example: string,
  context: ValidationContext
): Violation | null {
  // Only check if location is high priority and signature exists
  if (context.location_context_weight !== 'high' || !context.location_signature) {
    return null;
  }
  
  const exampleLower = example.toLowerCase();
  const signatureLower = context.location_signature.toLowerCase();
  
  if (!exampleLower.includes(signatureLower)) {
    return {
      type: 'missing_location',
      severity: 'critical',
      violation: `Mangler location reference "${context.location_signature}" (high priority USP)`,
      example_snippet: example.substring(0, 100) + '...',
      suggestion: `Indsæt "${context.location_signature}" naturligt i sætningen`
    };
  }
  
  return null;
}

// ============================================================================
// CHECK 3: CLICHÉ DETECTION
// ============================================================================

function checkCliches(example: string): Violation[] {
  const violations: Violation[] = [];
  const exampleLower = example.toLowerCase();
  
  for (const cliche of DANISH_HOSPITALITY_CLICHES) {
    const regex = new RegExp(cliche, 'i');
    if (regex.test(example)) {
      violations.push({
        type: 'professional_quality',
        severity: 'critical',
        violation: `Indeholder hospitality cliché: "${cliche}"`,
        example_snippet: example.substring(0, 100) + '...',
        suggestion: `Erstat med konkret beskrivelse eller specifik detalje`
      });
    }
  }
  
  return violations;
}

// ============================================================================
// CHECK 4: CONCRETENESS
// ============================================================================

function checkConcreteness(example: string): Violation | null {
  const score = calculateConcreteness(example);
  
  // Require at least 60% concreteness
  if (score < 0.6) {
    return {
      type: 'concreteness',
      severity: 'warning',
      violation: `For abstrakt (${Math.round(score * 100)}% konkret)`,
      example_snippet: example.substring(0, 100) + '...',
      suggestion: `Tilføj konkrete detaljer: retnavn, tid, pris, eller sted`
    };
  }
  
  return null;
}

function calculateConcreteness(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  
  if (wordCount === 0) return 0;
  
  let concreteCount = 0;
  let abstractCount = 0;
  
  // Count concrete indicators
  for (const pattern of CONCRETE_INDICATORS) {
    const matches = text.match(new RegExp(pattern, 'gi'));
    if (matches) {
      concreteCount += matches.length * 2;  // Weight concrete indicators heavily
    }
  }
  
  // Count abstract hospitality words (negative)
  for (const word of ABSTRACT_HOSPITALITY_WORDS) {
    if (words.includes(word)) {
      abstractCount++;
    }
  }
  
  // Calculate ratio
  const score = Math.min(1, (concreteCount / wordCount) * 5);  // Scale up concrete score
  const penalty = (abstractCount / wordCount) * 2;  // Penalize abstract words
  
  return Math.max(0, Math.min(1, score - penalty));
}

// ============================================================================
// EXTRACT CLICHÉS FROM VIOLATIONS (for retry with banned patterns)
// ============================================================================

export function extractClichesFromViolations(violations: Violation[]): string[] {
  const cliches: string[] = [];
  
  for (const violation of violations) {
    if (violation.type === 'professional_quality') {
      // Extract the cliché from the violation message
      const match = violation.violation.match(/"([^"]+)"/);
      if (match && match[1]) {
        cliches.push(match[1]);
      }
    }
  }
  
  return cliches;
}

// ============================================================================
// GENERATE BANNED PATTERNS PROMPT (Danish)
// ============================================================================

export function generateBannedPatternsPrompt(cliches: string[]): string {
  if (cliches.length === 0) return '';
  
  return `\n\nVIGTIGT - FORBUDTE ORD/FRASER:
Du SKAL undgå følgende ord og fraser (de blev brugt i forrige forsøg og er hospitality-klichéer):
${cliches.map(c => `- "${c}"`).join('\n')}

Brug i stedet konkrete detaljer, retnavn, tider, eller specifikke ingredienser.`;
}

// ============================================================================
// VALIDATION SUMMARY (for logging)
// ============================================================================

export function getValidationSummary(result: ValidationResult): string {
  if (result.passes) {
    return `✅ Validation passed (score: ${(result.score * 100).toFixed(0)}%)`;
  }
  
  const critical = result.violations.filter(v => v.severity === 'critical').length;
  const warnings = result.violations.filter(v => v.severity === 'warning').length;
  
  return `❌ Validation failed (score: ${(result.score * 100).toFixed(0)}%) - ${critical} critical, ${warnings} warnings`;
}
