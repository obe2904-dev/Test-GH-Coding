/**
 * Layer 5b: Writing Examples Generation
 * 
 * Generates example opening/closing phrases and signature phrases.
 * Prioritizes copying from legacy fields if they exist (100% for typical_openings in Café Faust).
 * 
 * V5.1 UPDATE: Validation with retry logic - ensures examples match voice rules
 * 
 * @version 5.1
 * @date May 20, 2026
 */

import type { V5WritingExamples, V5Voice, WritingExamplesGenerationInput } from './types-v5.ts'
import { getV5Prompt } from './v5-prompts.ts'
import { 
  validateExamples, 
  extractClichesFromViolations, 
  generateBannedPatternsPrompt,
  getValidationSummary,
  type ValidationContext 
} from './validation.ts'
import type { VoiceArchetype } from './voice-archetypes.ts'
import type { ProfessionalPersona } from './professional-persona.ts'
import type { GeographicContext } from './geographic-context.ts'

/**
 * Clean never_say rules from JSON artifacts (quotes, commas)
 * Handles both "word → replacement" format and plain words
 * Uses recursive cleaning to handle deeply nested quotes
 */
function cleanNeverSayRules(rules: string[]): string[] {
  if (!Array.isArray(rules)) return []
  
  return rules
    .map(rule => {
      // Recursively remove quotes until none remain
      let cleaned = rule.trim()
      let previousLength = 0
      
      // Keep removing quotes until string stabilizes (max 10 iterations to prevent infinite loop)
      for (let i = 0; i < 10 && cleaned.length !== previousLength; i++) {
        previousLength = cleaned.length
        cleaned = cleaned
          .replace(/^["'`]+/g, '')    // Remove leading quotes
          .replace(/["'`]+$/g, '')    // Remove trailing quotes
          .replace(/,\s*$/g, '')      // Remove trailing commas
          .trim()
      }
      
      return cleaned
    })
    .filter(rule => rule.length > 0)
    .map(rule => {
      // Extract just the banned word if in "word → replacement" format
      if (rule.includes('→')) {
        const parts = rule.split('→').map(p => p.trim())
        const word = parts[0]
        
        // Additional cleaning of extracted word
        return word
          .replace(/^["'`()]+|["'`()]+$/g, '')  // Remove any remaining quotes or parens
          .trim()
      }
      return rule
    })
    .filter(rule => rule.length > 0 && !rule.includes('{') && !rule.includes('['))  // Filter out JSON artifacts
}

/**
 * Clean LLM response by removing markdown code fences and extra formatting
 */
function cleanLLMResponse(content: string): string {
  return content
    .replace(/```json\s*/g, '')  // Remove ```json
    .replace(/```\s*/g, '')      // Remove ```
    .replace(/^["'`]+|["'`]+$/g, '')  // Remove surrounding quotes
    .trim()
}

/**
 * Parse LLM response into string array, handling JSON or line-by-line format
 */
function parseLLMArray(content: string, maxItems: number = 4): string[] {
  const cleaned = cleanLLMResponse(content)
  
  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => String(item).trim())
        .filter(item => item.length > 5 && item.length < 200)
        .slice(0, maxItems)
    }
  } catch {
    // Not JSON, parse line-by-line
  }
  
  // Fallback: Extract lines
  const lines = cleaned.split('\n')
    .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())  // Remove bullets, numbers
    .map(l => l.replace(/^["']+|["']+$/g, '').trim())  // Remove surrounding quotes
    .filter(l => l.length > 5 && l.length < 200)
    .slice(0, maxItems)
  
  return lines
}

/**
 * Generates writing examples (Layer 5b)
 * 
 * Strategy (V5.1):
 * 1. Copy from legacy fields if exists (typical_openings, typical_closings, signature_phrases)
 * 2. If missing, AI-generate based on voice rules + professional persona
 * 3. VALIDATE generated examples (ensure they match voice rules)
 * 4. RETRY once with banned patterns if validation fails
 * 5. Extract signature phrases from menu/location if not provided
 */
export async function generateWritingExamples(
  input: WritingExamplesGenerationInput & {
    professionalPersona?: ProfessionalPersona;
    voiceArchetype?: VoiceArchetype;
    geographicContext?: GeographicContext;
    businessTypeDetection?: any;
  },
  openAiKey: string,
  language: string = 'da'  // Multi-language support (default Danish)
): Promise<V5WritingExamples> {
  
  const examples: V5WritingExamples = {
    typical_openings: [],
    typical_closings: [],
    signature_phrases: []
  }
  
  // Build validation context from voice archetype
  const validationContext: ValidationContext | undefined = input.voiceArchetype ? {
    voice_rules: input.voiceArchetype.base_rules,
    location_signature: input.geographicContext?.location_context.signature,
    location_context_weight: input.voiceArchetype.location_context_weight,
    sentence_structure: input.professionalPersona?.tone_defaults.sentence_style
  } : undefined
  
  // 1. Copy existing typical_openings if available (legacy migration)
  if (input.legacy_examples?.typical_openings && input.legacy_examples.typical_openings.length > 0) {
    examples.typical_openings = input.legacy_examples.typical_openings
    console.log(`✅ Copied ${examples.typical_openings.length} typical_openings from legacy`)
  } else {
    // AI-generate WITH VALIDATION
    console.log('🤖 Generating typical_openings with AI + validation...')
    const cleanedNeverSayEarly = cleanNeverSayRules(input.legacy_never_say || [])
    examples.typical_openings = await aiGenerateOpeningsWithValidation(
      input.voice, 
      input.business, 
      input.professionalPersona,
      input.geographicContext,
      validationContext,
      openAiKey, 
      language,
      [],              // bannedPatterns (retry list, starts empty)
      cleanedNeverSayEarly  // neverSayWords: proactively ban these in first call
    )
  }
  
  // 2. Copy existing typical_closings if available  
  if (input.legacy_examples?.typical_closings && input.legacy_examples.typical_closings.length > 0) {
    examples.typical_closings = input.legacy_examples.typical_closings
    console.log(`✅ Copied ${examples.typical_closings.length} typical_closings from legacy`)
  } else {
    // AI-generate
    console.log('🤖 Generating typical_closings with AI...')
    examples.typical_closings = await aiGenerateClosings(input.voice, input.business, openAiKey, language)
  }
  
  // 3. Copy existing signature_phrases if available
  if (input.legacy_examples?.signature_phrases && input.legacy_examples.signature_phrases.length > 0) {
    examples.signature_phrases = input.legacy_examples.signature_phrases
    console.log(`✅ Copied ${examples.signature_phrases.length} signature_phrases from legacy`)
  } else {
    // Extract from business context or AI-generate
    console.log('🔍 Extracting signature_phrases from business context...')
    examples.signature_phrases = extractSignaturePhrases(input.business)
    
    if (examples.signature_phrases.length === 0) {
      console.log('🤖 No signature phrases found, generating with AI...')
      examples.signature_phrases = await aiGenerateSignaturePhrases(input.voice, input.business, openAiKey, language)
    }
  }
  
  // 3.5. Generate CTA library (NEW v5.6)
  console.log('🎯 Generating brand-specific CTA library...')
  const ctaResult = await aiGenerateCTALibrary(
    input.voice,
    {
      business_name: input.business.business_name,
      business_category: input.business.business_category,
      location_reference: input.business.location_reference,
      archetype: input.businessTypeDetection?.archetype,
      city: input.geographicContext?.location_context.city
    },
    input.businessTypeDetection?.commercial_baseline_mode,
    openAiKey,
    language
  )
  examples.cta_library = ctaResult.cta_library
  examples.cta_preferences = ctaResult.cta_preferences
  
  // 4. Generate complete caption examples (good_examples)
  console.log('🤖 Generating complete caption examples...')
  const cleanedNeverSay = cleanNeverSayRules(input.legacy_never_say || [])
  console.log(`   📋 Input never_say rules: ${(input.legacy_never_say || []).length}`)
  console.log(`   ✅ Cleaned to: ${cleanedNeverSay.length} banned words`)
  if (cleanedNeverSay.length > 0) {
    console.log(`   🚫 Banned words: ${cleanedNeverSay.slice(0, 5).join(', ')}${cleanedNeverSay.length > 5 ? '...' : ''}`)
  } else {
    console.log(`   ⚠️  NO BANNED WORDS - AI will not avoid any words!`)
  }
  examples.good_examples = await aiGenerateGoodExamples(
    input.voice,
    input.business,
    examples.typical_openings,
    examples.typical_closings,
    examples.signature_phrases,
    cleanedNeverSay,  // Pass cleaned banned words
    openAiKey,
    language
  )
  
  return examples
}

/**
 * NEW V5.1: AI-generate typical openings WITH VALIDATION AND RETRY
 */
async function aiGenerateOpeningsWithValidation(
  voice: V5Voice,
  business: { business_name: string; business_category?: string; location_reference?: string },
  professionalPersona: ProfessionalPersona | undefined,
  geographicContext: GeographicContext | undefined,
  validationContext: ValidationContext | undefined,
  openAiKey: string,
  language: string = 'da',
  bannedPatterns: string[] = [],
  neverSayWords: string[] = []  // Words that should never appear — added to prompt proactively
): Promise<string[]> {
  
  // Build enhanced prompt with professional persona and geographic context
  const systemPrompt = professionalPersona 
    ? buildPersonaSystemPromptForExamples(professionalPersona, geographicContext, 'openings', language, business.location_reference)
    : getV5Prompt('openings', language)

  let userPrompt = `Generer 4 åbningslinjer for ${business.business_name}.

VOICE GUIDELINES (SKAL FØLGES NØJAGTIGT):
${voice.tone_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

PERSONALITY: ${voice.personality_traits.join(', ')}
FORMALITY: ${voice.formality_level}
SENTENCE STYLE: ${voice.sentence_structure}

${geographicContext?.narrative || ''}${
  business.location_reference
    ? `\n\n⚠️ LOKATIONSKRAV: Når du nævner placeringen, brug PRÆCIST: "${business.location_reference}" \u2014 aldrig omformuleret, aldrig udvidet (ikke "Aarhus å", "havnefronten", "vandet" osv.).`
    : ''
}${
  neverSayWords.length > 0
    ? `\n\n🚫 FORBUDTE ORD (brug aldrig disse, heller ikke variationer):\n${neverSayWords.map(w => `- "${w}"`).join('\n')}`
    : ''
}

🚨 KRITISK KRAV TIL TYPICAL_OPENINGS:

1. MAX 8 ORD - ingen lange sætninger
2. ALDRIG start med imperativ verbum (befalingsform)
3. Skal være DEKLARATIVE/FAKTUELLE åbninger - ikke opfordringer
4. Skal demonstrere stedets karakter og placering

FORMAT: Korte, faktuelle åbninger på 2-8 ord.

✅ GODE EKSEMPLER (FØLG DISSE MØNSTRE):
${business.location_reference 
  ? `- "Solskin ved ${business.location_reference}."\n- "Morgenmad ved ${business.location_reference}."` 
  : '- "Weekenden starter her."\n- "Morgenmad klar fra kl. 9."'
}
- "Bøf & bearnaise klar fra 17:30."
- "Fredagsaften. Udeservering."
- "Brunch ved åen hver weekend."

❌ FORBUDT (brug ALDRIG disse mønstre):
- Imperativer: Start, Kom, Oplev, Tag, Vælg, Prøv, Nyd, Book, Se, Smag, Mød
- Lange sætninger over 8 ord
- Generiske fraser: "Vi er klar", "Velkommen", "Du kan..."
- Opfordrende tone ("gør dette", "få det")

OUTPUT: 4 korte linjer (max 8 ord hver), én pr. linje, ingen numre/bullets.`

  // Add banned patterns if this is a retry
  if (bannedPatterns.length > 0) {
    userPrompt += generateBannedPatternsPrompt(bannedPatterns)
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    })

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Parse LLM response
    const openings = parseLLMArray(content, 4)
    
    // VALIDATE if validation context available
    if (validationContext && openings.length > 0) {
      const validationResult = validateExamples(openings, validationContext)
      console.log(`   ${getValidationSummary(validationResult)}`)
      
      // If validation failed and this is first attempt, retry once with banned patterns
      if (!validationResult.passes && bannedPatterns.length === 0) {
        console.log(`⚠️ Validation failed, retrying with banned patterns...`)
        const cliches = extractClichesFromViolations(validationResult.violations)
        if (cliches.length > 0) {
          console.log(`   Banning: ${cliches.join(', ')}`)
          return await aiGenerateOpeningsWithValidation(
            voice,
            business,
            professionalPersona,
            geographicContext,
            validationContext,
            openAiKey,
            language,
            cliches,      // Pass cliches as banned patterns
            neverSayWords // Keep original never-say words
          )
        }
      }
      
      // If still failed after retry, use fallback
      if (!validationResult.passes) {
        console.log(`❌ Validation still failed after retry, using fallback`)
        return getFallbackOpenings()
      }
    }
    
    return openings.length > 0 ? openings : getFallbackOpenings()

  } catch (error) {
    console.error('❌ Opening generation failed:', error)
  }
  
  return getFallbackOpenings()
}

/**
 * NEW V5.1: Build system prompt using professional persona for examples generation
 */
function buildPersonaSystemPromptForExamples(
  persona: ProfessionalPersona,
  geographicContext: GeographicContext | undefined,
  exampleType: 'openings' | 'closings',
  language: string,
  localLocationReference?: string
): string {
  let prompt = persona.system_persona
  
  if (geographicContext) {
    prompt += `\n\n${geographicContext.narrative}`
  }
  
  const taskDescription = exampleType === 'openings' 
    ? 'Generer åbningslinjer (opening hooks) til Instagram captions.'
    : 'Generer afslutningslinjer (CTAs) til Instagram captions.'

  const locationInstruction = localLocationReference
    ? `- Når du nævner placeringen, brug PRÆCIST: "${localLocationReference}" — aldrig omformuleret eller udvidet (ikke "Aarhus å", "havnefronten" osv.)`
    : `- Hvis location er vigtig, nævn den konkret (ikke generisk "god beliggenhed")`
  
  prompt += `\n\nDIN OPGAVE:
${taskDescription}

KRAV:
- Følg voice guidelines NØJAGTIGT
- Demonstrer reglerne i praksis (eks. hvis regel siger "Max 15 ord", så max 15 ord)
- Brug konkrete detaljer (ikke abstrakte ord som "passion", "kærlighed", "uforglemmelig")
${locationInstruction}
- Korte, klare, actionable

OUTPUT: 4 linjer, én pr. linje, ingen numre eller bullets.`
  
  return prompt
}

/**
 * AI-generate typical openings (LEGACY - without validation)
 */
async function aiGenerateOpenings(
  voice: V5Voice,
  business: { business_name: string; business_category?: string },
  openAiKey: string,
  language: string = 'da'
): Promise<string[]> {
  
  const systemPrompt = getV5Prompt('openings', language)  // Multi-language system prompt

  const userPrompt = `Generer åbningslinjer for ${business.business_name}.

VOICE GUIDELINES:
${voice.tone_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

PERSONALITY: ${voice.personality_traits.join(', ')}
FORMALITY: ${voice.formality_level}
SENTENCE STYLE: ${voice.sentence_structure}

Eksempler på god stil (hvis short_declarative):
- "Vi er klar."
- "Kom forbi."
- "Det tager ti minutter."

Generer 4 NYE åbningslinjer i samme stil.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    })

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Parse LLM response (handles both JSON and line-by-line format)
    const openings = parseLLMArray(content, 4)
    return openings.length > 0 ? openings : getFallbackOpenings()

  } catch (error) {
    console.error('❌ Opening generation failed:', error)
  }
  
  return getFallbackOpenings()
}

/**
 * AI-generate typical closing phrases (CTAs)
 */
async function aiGenerateClosings(
  voice: V5Voice,
  business: { business_name: string },
  openAiKey: string,
  language: string = 'da'
): Promise<string[]> {
  
  const systemPrompt = getV5Prompt('closings', language)  // Multi-language system prompt

  const userPrompt = `Generer afslutningslinjer for ${business.business_name}.

VOICE GUIDELINES:
${voice.tone_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

PERSONALITY: ${voice.personality_traits.join(', ')}

Eksempler:
- "Book dit bord"
- "Vi ses i aften"
- "Kom forbi"
- "Ring på 12345678"

Generer 4 NYE afslutningslinjer.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    })

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Parse LLM response (handles both JSON and line-by-line format)
    const closings = parseLLMArray(content, 4)
    return closings.length > 0 ? closings : getFallbackClosings()

  } catch (error) {
    console.error('❌ Closing generation failed:', error)
  }
  
  return getFallbackClosings()
}

/**
 * Extract signature phrases from business context
 */
function extractSignaturePhrases(business: {
  business_name: string;
  menu_highlights?: string[];
  location_reference?: string;
}): string[] {
  const phrases: string[] = []
  
  // Add location reference if exists
  if (business.location_reference) {
    phrases.push(business.location_reference)
  }
  
  // Add menu highlights if exists
  if (business.menu_highlights) {
    const highlights = business.menu_highlights
      .filter(h => h.toLowerCase().includes('hjemme') || h.toLowerCase().includes('lokal'))
      .slice(0, 2)
    
    phrases.push(...highlights)
  }
  
  // Common restaurant signature phrases
  const commonPhrases = [
    'hjemmelavet',
    'regionale råvarer',
    'frisk hver dag'
  ]
  
  // Add common phrases to fill up to 3-4 total
  for (const phrase of commonPhrases) {
    if (phrases.length >= 4) break
    if (!phrases.includes(phrase)) {
      phrases.push(phrase)
    }
  }
  
  return phrases
}

/**
 * AI-generate signature phrases
 */
async function aiGenerateSignaturePhrases(
  voice: V5Voice,
  business: { business_name: string },
  openAiKey: string,
  language: string = 'da'
): Promise<string[]> {
  
  const systemPrompt = getV5Prompt('signature', language)  // Multi-language system prompt

  const userPrompt = `Generer signature phrases for ${business.business_name}.

PERSONALITY: ${voice.personality_traits.join(', ')}

Fokuser på autentiske, brand-specifikke udtryk.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 200
      })
    })

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Parse LLM response (handles both JSON and line-by-line format)
    const phrases = parseLLMArray(content, 4)
    return phrases.length > 0 ? phrases : ['hjemmelavet', 'regionale råvarer', 'frisk hver dag']

  } catch (error) {
    console.error('❌ Signature phrase generation failed:', error)
  }
  
  return ['hjemmelavet', 'regionale råvarer', 'frisk hver dag']
}

/**
 * NEW v5.6: AI-generate brand-specific CTA library
 * 
 * Creates intent-based, context-aware CTAs that:
 * - Match the business's voice and archetype
 * - Reference specific attributes (location, cuisine, service style)
 * - Use modern Danish (no 1990s slang like "svip forbi")
 * - Adapt to regional preferences
 */
async function aiGenerateCTALibrary(
  voice: V5Voice,
  business: {
    business_name: string;
    business_category?: string;
    location_reference?: string;
    archetype?: string;
    city?: string;
  },
  commercialMode?: string,  // 'premium' | 'balanced' | 'walk-in'
  openAiKey: string,
  language: string = 'da'
): Promise<{
  cta_library: V5WritingExamples['cta_library'];
  cta_preferences: V5WritingExamples['cta_preferences'];
}> {
  
  const systemPrompt = language === 'da'
    ? `Du er ekspert i at skrive call-to-action (CTA) tekster for danske restauranter og cafeer.

KERNEPRINCIP: Alle CTAs skal lyde som én person der taler til en anden person.
Ikke corporate-speak, ikke marketing-afdelingen — bare menneskeligt, ægte og varmt.

Din opgave er at generere BRAND-SPECIFIKKE CTAs der:
✅ Matcher virksomhedens stemme og arketype
✅ Henviser til specifikke egenskaber (lokation, mad, service)
✅ Bruger MODERNE dansk (2024-2026 konventioner)
✅ Undgår forældede vendinger (FORBUDT: "svip forbi", "få fingrene i")
✅ Lyder naturlige og autentiske

VIGTIGT:
- CTAs skal være specifikke for DENNE virksomhed
- Brug location_reference hvis relevant
- Tilpas til archetype (fine dining = elegant personlig, café = varm casual)
- Vær regional bevidst (København = international, Aarhus = traditionel)
- Selv formelle CTAs skal føles som menneske-til-menneske samtale
- Generer 3-5 variationer per intent/style`
    : `You are an expert at writing call-to-action (CTA) texts for Danish restaurants and cafes.

CORE PRINCIPLE: All CTAs must sound like one person talking to another person.
Not corporate-speak, not marketing department — just human, genuine, and warm.

Your task is to generate BRAND-SPECIFIC CTAs that:
✅ Match the business's voice and archetype
✅ Reference specific attributes (location, food, service)
✅ Use MODERN Danish (2024-2026 conventions)
✅ Avoid outdated phrases (FORBIDDEN: "svip forbi", "få fingrene i")
✅ Sound natural and authentic

IMPORTANT:
- CTAs must be specific to THIS business
- Use location_reference when relevant
- Adapt to archetype (fine dining = elegantly personal, café = warmly casual)
- Be regionally aware (Copenhagen = international, Aarhus = traditional)
- Even formal CTAs should feel like human-to-human conversation
- Generate 3-5 variations per intent/style`

  const archetypeGuidance = business.archetype || business.business_category || 'restaurant'
  const locationPhrase = business.location_reference ? `ved ${business.location_reference}` : ''
  const toneStyle = voice.formality_level === 'formal' || voice.formality_level === 'sophisticated' ? 'formal' : 'casual'

  const userPrompt = language === 'da'
    ? `Generer brand-specifikke CTAs for ${business.business_name}.

=== BUSINESS CONTEXT ===
Archetype: ${archetypeGuidance}
Lokation: ${locationPhrase || business.city || 'ikke angivet'}
Commercial Mode: ${commercialMode || 'balanced'}
Formality: ${voice.formality_level}
Personality: ${voice.personality_traits.slice(0, 3).join(', ')}

=== VOICE RULES (SKAL MATCHES) ===
${voice.tone_rules.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join('\n')}

=== CTA REQUIREMENTS ===

VIGTIGT: Alle CTAs skal lyde som én person der taler til en anden person.
Ikke corporate, ikke marketing-speak — bare menneskeligt og ægte.

1. VISIT CTAs (casual style):
   - Varm, venlig "kom forbi" tone
   - Reference lokation hvis relevant: "${locationPhrase || 'i [område]'}"
   - Eksempel: "Kom forbi ${locationPhrase}" eller "Vi ses snart!"
   - Generer 3-4 variationer

2. VISIT CTAs (elevated style):
   - Stadig personlig men elegant (ikke stiv eller corporate)
   - Som en sommelier eller chef der inviterer dig — ikke et firma
   - Eksempel: "Vi glæder os til at se dig ${locationPhrase}" eller "Lad os byde dig velkommen"
   - UNDGÅ: "Besøg os" (for stivt), "Velkommen til [firmanavn]" (upersonligt)
   - Generer 3-4 variationer

3. BOOKING CTAs (soft style):
   - Hjælpsom, ikke presserende
   - Som en ven der giver dig et godt råd
   - Eksempel: "Book bord hvis du vil være sikker på en plads" eller "Ring og book — så er du sikker"
   - Generer 3-4 variationer

4. BOOKING CTAs (reminder style):
   - Venlig påmindelse, ikke urgency eller FOMO
   - Stadig personlig og hjælpsom
   - Eksempel: "Vi anbefaler at booke" eller "Book gerne på forhånd — så er du sikker"
   - UNDGÅ: "Book nu!", "Få pladser!", "Før det er for sent", "det er tit fuldt" (unsubstantiated claims)
   - Generer 3-4 variationer

5. ENGAGEMENT CTAs (question style):
   - Spørgsmål der inviterer til interaktion
   - Eksempel: "Hvad synes du?" eller "Hvad ville du vælge?"
   - Generer 3-4 variationer

6. ENGAGEMENT CTAs (social style):
   - Social deling og tag-a-friend
   - Eksempel: "Tag en ven med" eller "Del med en foodie"
   - Generer 3-4 variationer

7. SOCIAL MEDIA CTAs:
   - Platform-specifikke (Instagram/Facebook)
   - Eksempel: "Tag os med i dit billede" eller "Del din oplevelse"
   - Generer 2-3 variationer

8. SIGNATURE CLOSING (optional):
   - Brand's egen signatur-afslutning
   - Unik til denne virksomhed
   - Eksempel baseret på voice + lokation
   - Generer 1 signatur

9. AVOID PHRASES:
   - List 2-3 forældede vendinger at undgå
   - Baseret på moderne dansk standard
   - Eksempel: "Svip forbi" (for gammeldags)

RETURN AS JSON:
{
  "visit_casual": ["CTA 1", "CTA 2", "CTA 3"],
  "visit_formal": ["CTA 1", "CTA 2", "CTA 3"],
  "booking_soft": ["CTA 1", "CTA 2", "CTA 3"],
  "booking_urgent": ["CTA 1", "CTA 2", "CTA 3"],
  "engagement_question": ["CTA 1", "CTA 2", "CTA 3"],
  "engagement_social": ["CTA 1", "CTA 2", "CTA 3"],
  "social_media": ["CTA 1", "CTA 2"],
  "signature_closing": "Brand-specifik signatur",
  "avoid_phrases": ["Forældet phrase 1", "Forældet phrase 2"],
  "default_style": "casual" eller "formal",
  "booking_priority": "soft" eller "urgent"
}

HUSK: Alle CTAs skal lyde menneskeligt — som én person til en anden, ikke som marketing.`
    : `Generate brand-specific CTAs for ${business.business_name}.
[English version of same prompt structure...]`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    const parsed = JSON.parse(cleanLLMResponse(content))

    // Structure the response
    const cta_library: V5WritingExamples['cta_library'] = {
      visit: {
        casual: Array.isArray(parsed.visit_casual) ? parsed.visit_casual : [],
        formal: Array.isArray(parsed.visit_formal) ? parsed.visit_formal : []
      },
      booking: {
        soft: Array.isArray(parsed.booking_soft) ? parsed.booking_soft : [],
        urgent: Array.isArray(parsed.booking_urgent) ? parsed.booking_urgent : []
      },
      engagement: {
        question: Array.isArray(parsed.engagement_question) ? parsed.engagement_question : [],
        social: Array.isArray(parsed.engagement_social) ? parsed.engagement_social : []
      },
      social_media: Array.isArray(parsed.social_media) ? parsed.social_media : [],
      signature_closing: parsed.signature_closing || undefined
    }

    const cta_preferences: V5WritingExamples['cta_preferences'] = {
      default_style: parsed.default_style === 'formal' ? 'formal' : 'casual',
      booking_priority: parsed.booking_priority === 'urgent' ? 'urgent' : 'soft',
      avoid_phrases: Array.isArray(parsed.avoid_phrases) ? parsed.avoid_phrases : ['Svip forbi']
    }

    console.log(`✅ Generated CTA library: ${Object.keys(cta_library).length} categories`)
    
    return { cta_library, cta_preferences }

  } catch (error) {
    console.error('❌ CTA library generation failed:', error)
    
    // Return minimal fallback
    return {
      cta_library: {
        visit: {
          casual: ['Kom forbi!', 'Vi ses snart', 'Kig forbi'],
          formal: [`Vi glæder os til at se dig ${locationPhrase}`, `Låd os byde dig velkommen`, 'Vi har åbent for dig']
        },
        booking: {
          soft: ['Book bord hvis du vil være sikker', 'Book gerne på forhånd'],
          urgent: ['Vi anbefaler at booke', 'Book gerne — så er du sikker']
        },
        engagement: {
          question: ['Hvad synes du?', 'Hvad ville du vælge?'],
          social: ['Tag en ven med', 'Del med en foodie']
        },
        social_media: ['Tag os med i dit billede', 'Del din oplevelse']
      },
      cta_preferences: {
        default_style: toneStyle as 'casual' | 'formal',
        booking_priority: commercialMode === 'premium' ? 'urgent' : 'soft',
        avoid_phrases: ['Svip forbi', 'Få fingrene i']
      }
    }
  }
}

/**
 * AI-generate complete caption examples showing the full voice in action
 * 
 * Creates 3-4 full examples:
 * - Menu post example
 * - Behind-scenes example  
 * - Atmosphere example
 */
async function aiGenerateGoodExamples(
  voice: V5Voice,
  business: { business_name: string },
  typicalOpenings: string[],
  typicalClosings: string[],
  signaturePhrases: string[],  neverSay: string[],  openAiKey: string,
  language: string = 'da'
): Promise<string[]> {
  
  const systemPrompt = language === 'da'
    ? `Du er ekspert i at skrive sociale medier captions for restauranter/cafeer.

Din opgave er at skrive KOMPLETTE eksempel-captions der viser den ønskede stemme i praksis.

VIGTIGT:
- Skriv FAKTISKE captions som brugeren kan se som eksempler
- Følg ALLE voice rules præcist
- Brug ALDRIG forbudte ord
- Brug signature phrases naturligt
- Hold den præcise længde og sætningsstruktur

Dette er EKSEMPLER der skal vise "sådan skal det se ud".`
    : `You are an expert at writing social media captions for restaurants/cafes.

Your task is to write COMPLETE example captions that demonstrate the desired voice in practice.

IMPORTANT:
- Write ACTUAL captions that users can see as examples
- Follow ALL voice rules precisely
- NEVER use forbidden words
- Use signature phrases naturally
- Maintain the exact length and sentence structure

These are EXAMPLES that should show "this is how it should look".`

  const userPrompt = language === 'da'
    ? `Skriv 3 komplette caption eksempler for ${business.business_name}.

=== VOICE RULES (SKAL FØLGES) ===
${voice.tone_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Personlighed: ${voice.personality_traits.slice(0, 3).join(', ')}
Formalitet: ${voice.formality_level}
Sætningsstruktur: ${voice.sentence_structure}

=== FORBUDTE ORD (UNDGÅ DISSE) ===
${neverSay.length > 0 ? neverSay.join(', ') : 'Ingen'}

=== TYPISKE ÅBNINGER ===
${typicalOpenings.slice(0, 2).map(o => `"${o}"`).join(', ')}

=== TYPISKE AFSLUTNINGER ===
${typicalClosings.slice(0, 2).map(c => `"${c}"`).join(', ')}

=== SIGNATURE PHRASES (brug naturligt) ===
${signaturePhrases.slice(0, 3).join(', ')}

🚨 KRITISKE KVALITETSKRAV TIL ALLE CAPTIONS:

1. ÅBNING: ALDRIG start med imperativ verbum
   ❌ FORBUDT: Start, Kom, Oplev, Tag, Vælg, Prøv, Nyd, Book, Se, Smag, Mød, Få
   ✅ KORREKT: Deklarative åbninger med konkrete detaljer

2. LÆNGDE: 300-450 tegn total (inkl. emojis og CTA)

3. KONKRETE DETALJER frem for abstrakte ord:
   ❌ Undgå: "lækker", "perfekt", "unik", "autentisk", "passion", "kærlighed"
   ✅ Brug: Præcise beskrivelser af mad, tilberedning, ingredienser, setting

4. ÉN TANKE PER SÆTNING: Korte, klare udsagn - ingen lange sammensatte konstruktioner

5. FORBEREDELSE/PROCES: Vis hvordan tingene laves, ikke bare slutresultatet
   Eksempel: "Steges langsomt i smør" frem for "lækker bøf"

6. NATURLIGT DANSK: Undgå turistbrochure-sprog og generiske salgspitches

=== OPGAVE ===
Skriv 3 FORSKELLIGE captions der demonstrerer stemmen i praksis:
1. Menu post (ret + konkret beskrivelse + CTA)
2. Behind-scenes post (aktivitet/forberedelse + CTA)
3. Atmosphere post (stemning med konkrete detaljer + CTA)

Hver caption:
- Max ${voice.sentence_structure === 'short_declarative' ? '3-4' : '4-6'} sætninger
- Brug åbningsstil fra TYPISKE ÅBNINGER (deklarativ, ikke imperativ)
- Brug afslutningsstil fra TYPISKE AFSLUTNINGER
- Integrer mindst 1 signature phrase naturligt
- Følg ALLE voice rules og kvalitetskrav

Returner JSON array med 3 strings.`
    : `Write 3 complete caption examples for ${business.business_name}.

=== VOICE RULES (MUST FOLLOW) ===
${voice.tone_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Personality: ${voice.personality_traits.slice(0, 3).join(', ')}
Formality: ${voice.formality_level}
Sentence structure: ${voice.sentence_structure}

=== BANNED WORDS (AVOID THESE) ===
${neverSay.length > 0 ? neverSay.join(', ') : 'None'}

=== TYPICAL OPENINGS ===
${typicalOpenings.slice(0, 2).map(o => `"${o}"`).join(', ')}

=== TYPICAL CLOSINGS ===
${typicalClosings.slice(0, 2).map(c => `"${c}"`).join(', ')}

=== SIGNATURE PHRASES (use naturally) ===
${signaturePhrases.slice(0, 3).join(', ')}

🚨 CRITICAL QUALITY REQUIREMENTS FOR ALL CAPTIONS:

1. OPENING: NEVER start with imperative verbs
   ❌ FORBIDDEN: Start, Come, Experience, Take, Choose, Try, Enjoy, Book, See, Taste, Meet, Get
   ✅ CORRECT: Declarative openings with concrete details

2. LENGTH: 300-450 characters total (including emojis and CTA)

3. CONCRETE DETAILS over abstract words:
   ❌ Avoid: "delicious", "perfect", "unique", "authentic", "passion", "love"
   ✅ Use: Precise descriptions of food, preparation, ingredients, setting

4. ONE THOUGHT PER SENTENCE: Short, clear statements - no long compound constructions

5. PREPARATION/PROCESS: Show how things are made, not just the end result
   Example: "Slow-cooked in butter" instead of "delicious steak"

6. NATURAL LANGUAGE: Avoid tourist brochure language and generic sales pitches

=== TASK ===
Write 3 DIFFERENT captions demonstrating the voice in practice:
1. Menu post (dish + concrete description + CTA)
2. Behind-scenes post (activity/preparation + CTA)
3. Atmosphere post (mood with concrete details + CTA)

Each caption:
- Max ${voice.sentence_structure === 'short_declarative' ? '3-4' : '4-6'} sentences
- Use opening style from TYPICAL OPENINGS (declarative, not imperative)
- Use closing style from TYPICAL CLOSINGS
- Integrate at least 1 signature phrase naturally
- Follow ALL voice rules and quality requirements

Return JSON array with 3 strings.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error(`❌ OpenAI API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    const parsed = JSON.parse(content)
    
    // Extract array from various possible JSON formats
    let examples: string[] = []
    if (Array.isArray(parsed)) {
      examples = parsed
    } else if (parsed.examples && Array.isArray(parsed.examples)) {
      examples = parsed.examples
    } else if (parsed.captions && Array.isArray(parsed.captions)) {
      examples = parsed.captions
    } else if (parsed.good_examples && Array.isArray(parsed.good_examples)) {
      examples = parsed.good_examples
    } else if (parsed.gode_eksempler && Array.isArray(parsed.gode_eksempler)) {
      examples = parsed.gode_eksempler
    } else {
      console.warn(`⚠️ Unexpected JSON format for good examples:`, Object.keys(parsed))
      console.warn(`   Trying to extract first array found...`)
      // Fallback: find first array value
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          examples = parsed[key]
          console.log(`   Found array in field: ${key}`)
          break
        }
      }
    }
    
    // Filter and clean
    const cleaned = examples
      .map(e => String(e).trim())
      .filter(e => e.length > 20 && e.length < 600)
      .slice(0, 4)
    
    console.log(`✅ Generated ${cleaned.length} complete caption examples`)
    return cleaned

  } catch (error) {
    console.error('❌ Good examples generation failed:', error)
    return []
  }
}

/**
 * Fallback openings if AI fails
 */
function getFallbackOpenings(): string[] {
  return [
    'Vi er klar.',
    'Kom forbi.',
    'Se dagens menu.',
    'Book dit bord.'
  ]
}

/**
 * Fallback closings if AI fails
 */
function getFallbackClosings(): string[] {
  return [
    'Book dit bord',
    'Vi ses',
    'Kom forbi',
    'Se menuen'
  ]
}
