// ============================================================================
// TONE DNA GENERATOR - Strategic Tone Recommendation
// ============================================================================
// Generates business-specific tone strategy as marketing expert analysis
// 
// PURPOSE:
// - Analyze business holistically (location + menu + price + owner voice)
// - Recommend optimal tone positioning (not generic rules)
// - Provide reasoning for why this tone fits THIS business
// 
// INPUT:
// - Location intelligence (waterfront, city centre, etc.)
// - Menu overview (culinary character, fusion patterns)
// - Commercial orientation (price positioning)
// - Owner voice (Om Os text linguistic analysis)
// - Market context (demographics, competition, cultural norms)
// 
// OUTPUT:
// - Strategic tone DNA with reasoning
// - Location-driven tone implications
// - Culinary character tone requirements
// - Owner voice register matching
// - Market context considerations
// ============================================================================

import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts';
import type { 
  V5ToneDNA, 
  V5ToneDNARecommendation,
  V5ToneDNALocationDriver,
  V5ToneDNACulinaryCharacter,
  V5ToneDNAOwnerVoice,
  V5ToneDNAMarketContext,
  V5EnhancedSocialExample,
  V5EnhancedAvoidExample,
  V5Guardrails
} from './types-v5.ts';
import { getV5Prompt } from './v5-prompts.ts';

// ============================================================================
// INPUT INTERFACES
// ============================================================================

export interface ToneDNAInput {
  business: {
    name: string;
    city: string;
    country: string;
    om_os_text: string;
  };
  
  location_intelligence?: {
    category_scores: Record<string, number>;        // Geographic types only (city_centre, waterfront, etc.)
    demographic_proximity?: Record<string, number>;  // WHO nearby (student, tourist, etc.)
    neighborhood_character?: string;
    area_type?: string;
    location_marketing_hooks?: string[];
    physical_context?: {
      pedestrian_flow?: string;
      transit_within_150m?: boolean;
      nearest_transit?: { name: string; distance_meters: number } | null;
      parking_within_300m?: boolean;
      street_level?: string;
    } | null;
    local_location_reference?: string;  // Operator-set factual phrase (e.g. "ved åen") — non-negotiable
  };
  
  menu_overview_summary?: {
    cross_menu_summary?: string;
    signature_themes?: string[];
    gastronomic_profile?: string;
    overall_avg_price?: number;
  };
  
  commercial_orientation?: {
    price_positioning?: string;
    primary_hook?: string;
    business_model?: string;
  };
  
  demographic_signals?: {
    primary_demographic?: string;
    score?: number;
  };
  
  market_context?: {
    competition_level?: string;
    cultural_context?: string;
  };
}

// ============================================================================
// GENERATE TONE DNA
// ============================================================================

export async function generateToneDNA(
  input: ToneDNAInput,
  openaiClient: OpenAI,
  language: string = 'da'
): Promise<V5ToneDNA> {
  
  console.log('[ToneDNA] Generating strategic tone recommendation...');
  
  // 1. Build comprehensive analysis prompt
  const prompt = buildToneDNAPrompt(input, language);
  
  // 2. Call AI as strategic marketing expert
  const toneDNA = await callToneDNAAI(prompt, input.business.name, openaiClient, language);
  
  // 3. Validate and return
  validateToneDNA(toneDNA);
  
  console.log(`[ToneDNA] ✅ Generated tone DNA: ${toneDNA.recommended_tone.tone_positioning}`);
  console.log(`[ToneDNA]    Confidence: ${toneDNA.confidence_score}%`);
  console.log(`[ToneDNA]    Location driver: ${toneDNA.location_driver.primary_dimension} (${toneDNA.location_driver.strategic_importance})`);
  console.log(`[ToneDNA]    Price positioning: ${toneDNA.culinary_character.price_positioning}`);
  console.log(`[ToneDNA]    Owner register: ${toneDNA.owner_voice.register_level}`);
  
  return toneDNA;
}

// ============================================================================
// BUILD STRATEGIC ANALYSIS PROMPT
// ============================================================================

function buildToneDNAPrompt(input: ToneDNAInput, language: string): string {
  // Get base strategic prompt
  let prompt = getV5Prompt('tone_dna', language);
  
  // Find primary location dimension
  const locationScores = input.location_intelligence?.category_scores || {};
  const sortedDimensions = Object.entries(locationScores)
    .filter(([_, score]) => score && score >= 80)
    .sort(([_, a], [__, b]) => (b || 0) - (a || 0));
  
  const primaryDimension = sortedDimensions.length > 0 
    ? sortedDimensions[0][0] 
    : 'unknown';
  const primaryScore = sortedDimensions.length > 0 
    ? sortedDimensions[0][1] 
    : 0;
  
  // Replace placeholders
  prompt = prompt
    .replace(/{business_name}/g, input.business.name)
    .replace(/{city}/g, input.business.city)
    .replace(/{country}/g, input.business.country)
    .replace(/{om_os_text}/g, input.business.om_os_text || 'Not provided')
    .replace(/{primary_dimension}/g, primaryDimension)
    .replace(/{score}/g, String(primaryScore))
    .replace(/{competition_level}/g, input.market_context?.competition_level || 'medium')
    .replace(/{price_tier}/g, input.commercial_orientation?.price_positioning || 'moderate')
    .replace(/{primary_hook}/g, input.commercial_orientation?.primary_hook || 'product')
    .replace(/{content_strategy}/g, input.commercial_orientation?.business_model || 'offer_led');
  
  // Add structured data sections
  prompt += '\n\n═══════════════════════════════════════════════════════════\n';
  prompt += 'STRUKTUREREDE DATA TIL ANALYSE\n';
  prompt += '═══════════════════════════════════════════════════════════\n\n';
  
  // Location intelligence
  if (input.location_intelligence) {
    prompt += 'LOCATION INTELLIGENCE:\n';
    prompt += JSON.stringify(input.location_intelligence, null, 2);
    prompt += '\n\n';
  }

  // Hard constraint: local_location_reference is the operator-defined location phrase.
  // It MUST be the first entry in natural_vocabulary, verbatim. Never paraphrase it.
  const llr = input.location_intelligence?.local_location_reference;
  if (llr) {
    prompt += `⚠️ KRITISK LOKATIONSKRAV:\n`;
    prompt += `Forretningen bruger PRÆCIST denne formulering for sin placering: "${llr}"\n`;
    prompt += `Dette er operatørens eget ord for lokationen og SKAL:`;
    prompt += `\n  1. Fremgå som den FØRSTE post i natural_vocabulary (ordret, ikke omskrevet)`;
    prompt += `\n  2. Aldrig erstattes af generiske alternativer ("ved vandet", "havnefronten", "waterfront", "åen" alene osv.)`;
    prompt += `\n  3. Ikke parres med havbeskrivelser (bølger, hav, maritim) — det er en å, ikke et hav/fjord/strand.\n\n`;
  }
  
  // Menu overview
  if (input.menu_overview_summary) {
    prompt += 'MENU OVERVIEW:\n';
    prompt += `Signature themes: ${input.menu_overview_summary.signature_themes?.join(', ') || 'None'}\n`;
    prompt += `Cross-menu summary: ${input.menu_overview_summary.cross_menu_summary || 'Not available'}\n`;
    prompt += `Average price: ${input.menu_overview_summary.overall_avg_price || 'Unknown'}\n`;
    prompt += '\n';
  }
  
  // Demographic signals
  if (input.demographic_signals) {
    prompt += 'DEMOGRAPHIC SIGNALS:\n';
    prompt += JSON.stringify(input.demographic_signals, null, 2);
    prompt += '\n\n';
  }
  
  return prompt;
}

// ============================================================================
// CALL AI FOR STRATEGIC RECOMMENDATION
// ============================================================================

async function callToneDNAAI(
  prompt: string,
  businessName: string,
  openaiClient: OpenAI,
  language: string
): Promise<V5ToneDNA> {
  
  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are the world\'s best marketing strategist specializing in tone of voice for restaurants and cafés. You analyze businesses holistically and recommend optimal tone strategies based on location, menu, price, owner voice, and market context. You output ONLY valid JSON.' 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1500
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty AI response for tone DNA');
    }

    const parsed = JSON.parse(content);
    
    console.log('[ToneDNA] Raw AI response structure:', Object.keys(parsed));
    console.log('[ToneDNA] Response sample:', JSON.stringify(parsed).substring(0, 500));
    
    // Add generated_at timestamp
    parsed.generated_at = new Date().toISOString();

    // Enforce local_location_reference as first natural_vocabulary entry (AI may omit it)
    const llr = prompt.match(/PRÆCIST denne formulering for sin placering: "([^"]+)"/);
    if (llr?.[1] && parsed.location_driver?.natural_vocabulary) {
      const ref = llr[1];
      const vocab: string[] = Array.isArray(parsed.location_driver.natural_vocabulary)
        ? parsed.location_driver.natural_vocabulary
        : [];
      if (vocab[0] !== ref) {
        parsed.location_driver.natural_vocabulary = [ref, ...vocab.filter((v: string) => v !== ref)];
        console.log('[ToneDNA] ✅ local_location_reference enforced as first natural_vocabulary:', ref);
      }
    }
    
    // BLACKLIST: Remove forbidden generic location terms
    // AI often ignores prompt warnings and adds these anyway despite being told not to
    const FORBIDDEN_GENERIC_TERMS = [
      'ved vandet',
      'havnefronten',
      'waterfront',
      'udsigt',
      'udsigten',
      'havudsigt',
      'vandkanten',
      'ved havet',
      'ved søen',
      'på vandkanten'
    ];
    
    if (parsed.location_driver?.natural_vocabulary) {
      const beforeCount = parsed.location_driver.natural_vocabulary.length;
      const removed: string[] = [];
      
      parsed.location_driver.natural_vocabulary = 
        parsed.location_driver.natural_vocabulary.filter((term: string) => {
          const termLower = term.toLowerCase().trim();
          
          // Check if term contains ANY forbidden phrase (not just exact match)
          const containsForbidden = FORBIDDEN_GENERIC_TERMS.some(forbidden => 
            termLower.includes(forbidden)
          );
          
          if (containsForbidden) {
            removed.push(term);
            return false;
          }
          return true;
        });
      
      if (removed.length > 0) {
        console.log(`[ToneDNA] ⚠️ Removed ${removed.length} forbidden generic terms:`, removed);
        console.log(`[ToneDNA] ✅ Cleaned vocabulary from ${beforeCount} to ${parsed.location_driver.natural_vocabulary.length} terms`);
      }
    }
    
    return parsed as V5ToneDNA;
    
  } catch (error) {
    console.error('[ToneDNA] AI generation error:', error);
    throw new Error(`Failed to generate tone DNA: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// VALIDATE TONE DNA STRUCTURE
// ============================================================================

function validateToneDNA(toneDNA: V5ToneDNA): void {
  const required = [
    'recommended_tone',
    'location_driver',
    'culinary_character',
    'owner_voice',
    'market_context',
    'strategic_summary',
    'tone_do_list',
    'tone_dont_list'
  ];
  
  for (const field of required) {
    if (!(field in toneDNA)) {
      throw new Error(`Tone DNA missing required field: ${field}`);
    }
  }
  
  // Validate lists have content
  if (toneDNA.tone_do_list.length < 5) {
    console.warn('[ToneDNA] Warning: tone_do_list has fewer than 5 items');
  }
  
  if (toneDNA.tone_dont_list.length < 3) {
    console.warn('[ToneDNA] Warning: tone_dont_list has fewer than 3 items');
  }
}

// ============================================================================
// GENERATE ENHANCED EXAMPLES WITH REASONING
// ============================================================================

export async function generateEnhancedExamples(
  toneDNA: V5ToneDNA,
  businessIdentityPersona: string,
  voiceConstraints: {
    tone_rules: string[];
    formality_level: string;
    personality_traits: string[];
  },
  guardrails: Pick<V5Guardrails, 'never_say' | 'avoid_patterns'>,
  openaiClient: OpenAI,
  language: string = 'da',
  programmes?: Array<{ type: string; name: string; audienceSegments?: Array<{ segment_name: string }> }>
): Promise<{
  social_examples: V5EnhancedSocialExample[];
  avoid_examples: V5EnhancedAvoidExample[];
}> {
  
  console.log('[ToneDNA] Generating enhanced examples with reasoning...');
  console.log(`[ToneDNA] Constraints: ${voiceConstraints.tone_rules.length} tone rules, ${guardrails.never_say.length} never-say rules, formality=${voiceConstraints.formality_level}`);
  
  // Build prompt
  let prompt = getV5Prompt('enhanced_examples', language);
  
  // Add programme context if available
  let programmeContext = '';
  if (programmes && programmes.length > 0) {
    programmeContext = '\n\nPROGRAMMES (dæk alle i eksemplerne):\n';
    programmes.forEach(prog => {
      programmeContext += `- ${prog.name} (${prog.type})`;
      if (prog.audienceSegments && prog.audienceSegments.length > 0) {
        const segments = prog.audienceSegments.slice(0, 3).map(s => s.segment_name).join(', ');
        programmeContext += ` → ${segments}`;
      }
      programmeContext += '\n';
    });
  }
  
  // CRITICAL: Add voice constraints and guardrails to prompt
  let constraintsContext = '\n\n🔴 KRITISKE CONSTRAINTS (SKAL OVERHOLDES):\n\n';
  
  // Tone rules
  constraintsContext += '**TONE RULES (må ikke bryde):**\n';
  voiceConstraints.tone_rules.forEach(rule => {
    constraintsContext += `• ${rule}\n`;
  });
  
  // Never-say rules (top 15 to avoid token bloat)
  constraintsContext += '\n**FORBUDTE ORD/FRASER (må aldrig bruge):**\n';
  guardrails.never_say.slice(0, 15).forEach(rule => {
    constraintsContext += `• ${rule}\n`;
  });
  
  // Avoid patterns (from strip_from_output only)
  if (guardrails.avoid_patterns?.strip_from_output) {
    constraintsContext += '\n**UNDGÅ MØNSTRE:**\n';
    Object.entries(guardrails.avoid_patterns.strip_from_output).forEach(([category, patterns]) => {
      if (patterns && patterns.length > 0) {
        constraintsContext += `• ${category}: ${patterns.slice(0, 4).join(', ')}\n`;
      }
    });
  }
  
  // Formality level
  constraintsContext += `\n**FORMALITY LEVEL:** ${voiceConstraints.formality_level}\n`;
  
  // CRITICAL: Add explicit imperative ban if present in tone_rules
  const hasImperativeBan = voiceConstraints.tone_rules.some(rule =>
    /aldrig imperative|never imperative|undgå imperative|avoid imperative/i.test(rule)
  );
  
  if (hasImperativeBan) {
    constraintsContext += '\n🚨 **IMPERATIVE BAN (KRITISK):**\n';
    constraintsContext += '• ALDRIG start med imperative verber (kom, tag, nyd, prøv, smag, oplev, book, bestil, se, hør, find, få, bliv, gå, lad, slå, stik)\n';
    constraintsContext += '• Brug ALTID deklarative sætninger: "Vi har...", "I dag serverer vi...", "Vores [...] er klar"\n';
    constraintsContext += '• Eksempel GOD: "Vores brunch ved åen er klar 🌊"\n';
    constraintsContext += '• Eksempel DÅRLIG: "Prøv vores brunch ved åen 🌊" ❌ IMPERATIV FORBUDT\n\n';
  }
  
  constraintsContext += '\n⚠️  Generer 8 posts der FØLGER alle ovenstående regler. Hvis en post bryder en regel, må den IKKE inkluderes.\n';
  
  // Replace placeholders
  prompt = prompt
    .replace(/{tone_dna_json}/g, JSON.stringify(toneDNA, null, 2))
    .replace(/{business_identity_persona}/g, businessIdentityPersona + programmeContext + constraintsContext);
  
  // Build system message with imperative ban if needed
  let systemMessage = 'You generate social media examples with detailed reasoning for why they work or fail. You demonstrate tone DNA in practice. You MUST output valid JSON with exactly these fields: {"social_examples": [...], "avoid_examples": [...]}. Each array must contain 8-10 objects (social) and 5-6 objects (avoid).';
  
  if (hasImperativeBan) {
    systemMessage += '\n\n🚨 CRITICAL IMPERATIVE BAN: You are ABSOLUTELY FORBIDDEN from starting any example with imperative verbs (kom, tag, nyd, prøv, smag, oplev, book, bestil, se, hør, find, få, bliv, gå, lad, slå, stik). Use ONLY declarative sentences starting with "Vi har...", "I dag serverer vi...", "Vores [...]". Any example with an imperative verb will be REJECTED.';
  }
  
  // Call AI
  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: systemMessage
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,  // Slightly higher for creative examples
      max_tokens: 4000  // Increased for 12-15 social + 8-10 avoid examples with reasoning
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty AI response for enhanced examples');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('[ToneDNA] JSON parse failed, response length:', content.length);
      console.error('[ToneDNA] Response preview:', content.substring(0, 500));
      console.error('[ToneDNA] Response end:', content.substring(content.length - 200));
      throw parseError;
    }
    
    // DEBUG: Log the response structure to understand what AI is returning
    console.log('[ToneDNA] AI response keys:', Object.keys(parsed));
    console.log('[ToneDNA] social_examples type:', typeof parsed.social_examples, 'isArray:', Array.isArray(parsed.social_examples));
    console.log('[ToneDNA] avoid_examples type:', typeof parsed.avoid_examples, 'isArray:', Array.isArray(parsed.avoid_examples));
    
    if (!Array.isArray(parsed.social_examples)) {
      console.error('[ToneDNA] ⚠️  social_examples is not an array! Full response:', JSON.stringify(parsed, null, 2));
    }
    if (!Array.isArray(parsed.avoid_examples)) {
      console.error('[ToneDNA] ⚠️  avoid_examples is not an array! Full response:', JSON.stringify(parsed, null, 2));
    }
    
    console.log(`[ToneDNA] ✅ Generated ${parsed.social_examples?.length || 0} social examples`);
    console.log(`[ToneDNA] ✅ Generated ${parsed.avoid_examples?.length || 0} avoid examples`);
    
    // STEP 1: NORMALIZE - Ensure all examples are proper objects {text, rationale}
    // AI sometimes returns strings instead of objects, which breaks validation
    let normalizedSocialExamples = (parsed.social_examples || []).map((ex: any, index: number) => {
      if (typeof ex === 'object' && ex.text && ex.rationale) {
        return ex; // Already correct structure
      } else if (typeof ex === 'string') {
        console.warn(`[ToneDNA] ⚠️  Example ${index+1} is string, normalizing to object`);
        return { text: ex, rationale: 'AI-generated example' };
      } else if (typeof ex === 'object' && ex.text) {
        // Has text but missing rationale
        return { text: ex.text, rationale: ex.rationale || 'AI-generated example' };
      } else {
        console.error(`[ToneDNA] ❌ Invalid example structure at ${index+1}:`, ex);
        return null;
      }
    }).filter((ex: any) => ex !== null); // Remove invalid entries
    
    // STEP 2: FILTER IMPERATIVES - Remove examples with imperative verbs in ANY sentence
    if (hasImperativeBan && normalizedSocialExamples.length > 0) {
      const imperativeVerbs = ['kom', 'tag', 'nyd', 'prøv', 'smag', 'oplev', 'book', 'bestil', 'se', 'hør', 'find', 'få', 'bliv', 'gå', 'lad', 'slå', 'stik'];
      const imperativePattern = new RegExp(`^(${imperativeVerbs.join('|')})\\s`, 'i');
      
      const beforeImperative = normalizedSocialExamples.length;
      normalizedSocialExamples = normalizedSocialExamples.filter((ex: V5EnhancedSocialExample) => {
        // Split into sentences and check EACH sentence (not just start of entire text)
        const sentences = ex.text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
        const hasImperative = sentences.some(sentence => imperativePattern.test(sentence));
        
        if (hasImperative) {
          // Find which sentence contains the imperative
          const imperativeSentence = sentences.find(s => imperativePattern.test(s));
          const match = imperativeSentence?.match(imperativePattern);
          console.warn(`[ToneDNA] 🚫 Filtered imperative example: "${ex.text.substring(0, 60)}..." (verb: ${match?.[1]} in sentence: "${imperativeSentence?.substring(0, 40)}...")`);
        }
        
        return !hasImperative;
      });
      
      if (beforeImperative > normalizedSocialExamples.length) {
        console.log(`[ToneDNA] ✅ Filtered ${beforeImperative - normalizedSocialExamples.length} imperative examples (${beforeImperative} → ${normalizedSocialExamples.length})`);
      }
    }
    
    // STEP 3: FILTER BANNED WORDS - Remove examples containing never_say words
    // AI often ignores never_say constraints in prompt, so we filter post-generation
    if (guardrails?.never_say && guardrails.never_say.length > 0 && normalizedSocialExamples.length > 0) {
      // Extract banned words from never_say rules (format: "word → replacement" or just "word")
      const bannedWords = guardrails.never_say.map(rule => {
        let word = null;
        
        // Try multiple arrow formats: →, ->, –>, etc.
        if (rule.includes('→')) {
          word = rule.split('→')[0];
        } else if (rule.includes('->')) {
          word = rule.split('->')[0];
        } else if (rule.includes('–>')) {
          word = rule.split('–>')[0];
        } else {
          // No arrow found, use entire rule as banned word
          word = rule;
        }
        
        return word ? word.trim().toLowerCase() : null;
      }).filter((word): word is string => word !== null && word.length > 0);
      
      console.log(`[ToneDNA] 🔍 Checking ${bannedWords.length} banned words against ${normalizedSocialExamples.length} examples...`);
      if (bannedWords.length > 0) {
        console.log(`[ToneDNA]    First 5 banned words:`, bannedWords.slice(0, 5));
      }
      
      const beforeBanned = normalizedSocialExamples.length;
      normalizedSocialExamples = normalizedSocialExamples.filter((ex: V5EnhancedSocialExample) => {
        const lowerText = ex.text.toLowerCase();
        
        for (const bannedWord of bannedWords) {
          // Check for whole word match (not substring)
          // Escape special regex characters in banned word
          const escaped = bannedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordPattern = new RegExp(`\\b${escaped}\\b`, 'i');
          
          if (wordPattern.test(lowerText)) {
            console.warn(`[ToneDNA] 🚫 Filtered banned word "${bannedWord}" in example: "${ex.text.substring(0, 60)}..."`);
            return false;
          }
        }
        
        return true;
      });
      
      if (beforeBanned > normalizedSocialExamples.length) {
        console.log(`[ToneDNA] ✅ Filtered ${beforeBanned - normalizedSocialExamples.length} examples with banned words (${beforeBanned} → ${normalizedSocialExamples.length})`);
      } else {
        console.log(`[ToneDNA] ℹ️  No banned words found in examples`);
      }
    }
    
    // STEP 4: VALIDATE MINIMUM COUNT
    if (normalizedSocialExamples.length < 5) {
      console.warn(`[ToneDNA] ⚠️  Only ${normalizedSocialExamples.length} examples remain after filtering (need 8). AI may not be respecting constraints.`);
    }
    
    // STEP 5: NORMALIZE AVOID EXAMPLES - Ensure proper {text, why_avoid} structure
    const normalizedAvoidExamples = (parsed.avoid_examples || []).map((ex: any, index: number) => {
      if (typeof ex === 'object' && ex.text && ex.why_avoid) {
        return ex; // Already correct structure
      } else if (typeof ex === 'string') {
        console.warn(`[ToneDNA] ⚠️  Avoid example ${index+1} is string, normalizing to object`);
        return { text: ex, why_avoid: 'Generic or inappropriate tone' };
      } else if (typeof ex === 'object' && ex.text) {
        // Has text but missing why_avoid
        return { text: ex.text, why_avoid: ex.why_avoid || 'Generic or inappropriate tone' };
      } else {
        console.error(`[ToneDNA] ❌ Invalid avoid example structure at ${index+1}:`, ex);
        return null;
      }
    }).filter((ex: any) => ex !== null); // Remove invalid entries
    
    return {
      social_examples: normalizedSocialExamples,
      avoid_examples: normalizedAvoidExamples
    };
    
  } catch (error) {
    console.error('[ToneDNA] Enhanced examples generation error:', error);
    throw new Error(`Failed to generate enhanced examples: ${error instanceof Error ? error.message : String(error)}`);
  }
}
