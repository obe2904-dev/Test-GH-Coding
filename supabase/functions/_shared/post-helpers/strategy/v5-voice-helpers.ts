/**
 * V5 Voice Helpers for Phase 2a/2d
 * 
 * Extracts V5-specific voice data (writing examples, tone rules, guardrails)
 * for use in content selection and narrative generation.
 */

import type { V5BrandProfile, V5Programme } from '../../brand-profile/types-v5.ts';

export interface V5VoiceContext {
  // Writing examples
  typical_openings: string[];
  typical_closings: string[];
  signature_phrases: string[];
  
  // Voice rules
  tone_rules: string[];
  personality_traits: string[];
  formality_level: string;
  humor_style: string;
  
  // Guardrails
  never_say: string[];
  content_exclusions: string[];
  factual_constraints: string[];
}

/**
 * Extract V5 voice context from brand_profile_v5 JSONB
 */
export function extractV5VoiceContext(v5Profile: V5BrandProfile | null): V5VoiceContext | null {
  if (!v5Profile) return null;
  
  const voice = v5Profile.voice;
  const examples = v5Profile.writing_examples;
  const guardrails = v5Profile.guardrails;
  
  // Null safety - return null if essential parts missing
  if (!voice || !examples || !guardrails) {
    console.warn('[V5 Voice] Incomplete V5 profile - missing voice/examples/guardrails');
    return null;
  }
  
  return {
    // Writing examples (Layer 5b)
    typical_openings: examples.typical_openings || [],
    typical_closings: examples.typical_closings || [],
    signature_phrases: examples.signature_phrases || [],
    
    // Voice rules (Layer 5a)
    tone_rules: voice.tone_rules || [],
    personality_traits: voice.personality_traits || [],
    formality_level: voice.formality_level || 'semi-formal',
    humor_style: voice.humor_style || 'none',
    
    // Guardrails (Layer 5c)
    never_say: guardrails.never_say || [],
    content_exclusions: guardrails.content_exclusions || [],
    factual_constraints: guardrails.factual_constraints || [],
  };
}

/**
 * Format V5 voice context for AI prompts
 */
export function formatV5VoiceForPrompt(voiceContext: V5VoiceContext): string {
  const blocks: string[] = [];
  
  // Tone rules - most important for voice consistency
  if (voiceContext.tone_rules.length > 0) {
    blocks.push(
      `TONE RULES (følg disse direkte):\n${voiceContext.tone_rules.map(r => `  - ${r}`).join('\n')}`
    );
  }
  
  // Writing examples - for style matching
  if (voiceContext.typical_openings.length > 0 || voiceContext.signature_phrases.length > 0) {
    const exampleParts: string[] = [];
    
    if (voiceContext.typical_openings.length > 0) {
      exampleParts.push(
        `Typiske åbninger:\n${voiceContext.typical_openings.slice(0, 3).map(o => `  • "${o}"`).join('\n')}`
      );
    }
    
    if (voiceContext.signature_phrases.length > 0) {
      exampleParts.push(
        `Signatur-fraser:\n${voiceContext.signature_phrases.slice(0, 3).map(p => `  • "${p}"`).join('\n')}`
      );
    }
    
    if (voiceContext.typical_closings.length > 0) {
      exampleParts.push(
        `Typiske afslutninger:\n${voiceContext.typical_closings.slice(0, 3).map(c => `  • "${c}"`).join('\n')}`
      );
    }
    
    blocks.push(
      `SKRIVESTIL-EKSEMPLER (genkend og match registeret - genbrug IKKE ordret):\n${exampleParts.join('\n\n')}`
    );
  }
  
  // Guardrails - strict constraints
  if (voiceContext.never_say.length > 0) {
    blocks.push(
      `ALDRIG BRUG (erstat med alternativer):\n${voiceContext.never_say.slice(0, 6).map(n => `  - ${n}`).join('\n')}`
    );
  }
  
  if (voiceContext.content_exclusions.length > 0) {
    blocks.push(
      `INDHOLDSRESTRIKTIONER:\n${voiceContext.content_exclusions.slice(0, 5).map(e => `  - ${e}`).join('\n')}`
    );
  }
  
  if (voiceContext.factual_constraints.length > 0) {
    blocks.push(
      `FAKTUELLE BEGRÆNSNINGER:\n${voiceContext.factual_constraints.slice(0, 5).map(f => `  - ${f}`).join('\n')}`
    );
  }
  
  // Personality traits - for overall tone
  if (voiceContext.personality_traits.length > 0) {
    blocks.push(
      `Personlighedstræk: ${voiceContext.personality_traits.slice(0, 5).join(', ')}\n` +
      `Formalitetsniveau: ${voiceContext.formality_level}\n` +
      `Humorstil: ${voiceContext.humor_style}`
    );
  }
  
  return blocks.length > 0 
    ? `V5 BRAND VOICE (DENNE FORRETNINGS SPECIFIKKE STEMME):\n\n${blocks.join('\n\n')}`
    : '';
}

/**
 * Get active programmes for a given week
 * Returns programmes that overlap with the week's days
 */
export function getActiveProgrammes(
  programmes: V5Programme[],
  weekStartDate: string  // ISO date "2026-05-12"
): V5Programme[] {
  if (!programmes || programmes.length === 0) return [];
  
  // Calculate week's day names
  const startDate = new Date(weekStartDate + 'T12:00:00');
  const weekDays: string[] = [];
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + i);
    weekDays.push(dayNames[dayDate.getDay()]);
  }
  
  // Filter programmes that are active on ANY day this week
  const activeProgrammes = programmes.filter(prog => {
    return prog.daysOfWeek.some(day => weekDays.includes(day.toLowerCase()));
  });
  
  console.log(`[V5 Programmes] ${activeProgrammes.length}/${programmes.length} programmes active this week`);
  
  return activeProgrammes;
}

/**
 * Format programme information for Phase 2a content selection
 */
export function formatProgrammesForContentSelection(programmes: V5Programme[]): string {
  if (programmes.length === 0) return '';
  
  const blocks: string[] = [
    `AKTIVE PROGRAMMER DENNE UGE (${programmes.length} programmer):`
  ];
  
  // Sort by confidence (high first)
  const sorted = [...programmes].sort((a, b) => {
    const confMap = { high: 3, medium: 2, low: 1 };
    return confMap[b.confidence] - confMap[a.confidence];
  });
  
  sorted.forEach((prog, idx) => {
    const days = prog.daysOfWeek.join(', ');
    const time = `${prog.timeWindow.start}-${prog.timeWindow.end}`;
    const conf = prog.confidence;
    
    // Commercial orientation summary
    const orientation = prog.commercialOrientation;
    const goalSplit = orientation.baseline_goal_split;
    const primaryGoal = Object.entries(goalSplit)
      .sort(([, a], [, b]) => b - a)[0][0];
    
    // Audience segments summary
    const audiences = prog.audienceSegments.length > 0
      ? prog.audienceSegments.map(a => a.segment_name).slice(0, 2).join(' + ')
      : 'general';
    
    blocks.push(
      `${idx + 1}. ${prog.name} (${days}, ${time}) [${conf} confidence]
   Commercial: ${orientation.decision_timing} timing, primært ${primaryGoal}
   Målgruppe: ${audiences}
   ${orientation.reasoning}`
    );
  });
  
  blocks.push('');
  blocks.push('INSTRUKTION: Prioritér indhold fra programmer med HIGH confidence. Match commercial orientation til strategiske vinkler.');
  
  return blocks.join('\n');
}
