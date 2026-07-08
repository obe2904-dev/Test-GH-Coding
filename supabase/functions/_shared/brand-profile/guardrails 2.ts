/**
 * Layer 5c: Guardrails Generation
 * 
 * Generates content guardrails: never_say rules, content exclusions, factual constraints.
 * Prioritizes copying from legacy fields if they exist.
 * 
 * V5.3 UPDATE: Added wallpaper avoidance rules and formulaic pattern detection
 * 
 * @version 5.3
 * @date May 24, 2026
 */

import type { V5Guardrails, V5Voice, V5Identity, GuardrailsGenerationInput } from './types-v5.ts'
import { getV5Prompt } from './v5-prompts.ts'

/**
 * Generates guardrails (Layer 5c)
 * 
 * Strategy:
 * 1. Copy from legacy never_say if exists
 * 2. Parse things_to_avoid and voice_constraints into structured format
 * 3. AI-generate brand-specific rules if missing
 * 4. Add industry-standard factual constraints
 * 5. NEW (v5.1): Generate structured avoid_patterns by category
 * 6. NEW (v5.1): Add default length_limits per platform
 */
export async function generateGuardrails(
  input: GuardrailsGenerationInput,
  openAiKey: string,
  language: string = 'da'  // Multi-language support (default Danish)
): Promise<V5Guardrails> {
  
  const guardrails: V5Guardrails = {
    never_say: [],
    content_exclusions: [],
    factual_constraints: []
  }
  
  // 1. Copy never_say from legacy if exists
  if (input.legacy_guardrails?.never_say && input.legacy_guardrails.never_say.length > 0) {
    guardrails.never_say = input.legacy_guardrails.never_say
    console.log(`✅ Copied ${guardrails.never_say.length} never_say rules from legacy`)
  } else {
    // AI-generate brand-specific never_say rules
    console.log('🤖 Generating never_say rules with AI...')
    guardrails.never_say = await aiGenerateNeverSayRules(input, openAiKey, language)
  }
  
  // 2. Parse things_to_avoid into content_exclusions
  if (input.legacy_guardrails?.things_to_avoid) {
    const exclusions = parseThingsToAvoid(input.legacy_guardrails.things_to_avoid)
    guardrails.content_exclusions.push(...exclusions)
  }
  
  // 3. Parse voice_constraints into content_exclusions
  if (input.legacy_guardrails?.voice_constraints) {
    const constraints = parseVoiceConstraints(input.legacy_guardrails.voice_constraints)
    guardrails.content_exclusions.push(...constraints)
  }
  
  // 4. If content_exclusions still empty, AI-generate
  if (guardrails.content_exclusions.length === 0) {
    console.log('🤖 Generating content_exclusions with AI...')
    guardrails.content_exclusions = await aiGenerateContentExclusions(input, openAiKey, language)
  }
  
  // 5. Add standard factual constraints for all restaurants
  guardrails.factual_constraints = getStandardFactualConstraints(input.business.business_category)
  
  // 6. Add seasonal notes (vocabulary-aware - uses business's own terminology)
  guardrails.seasonal_notes = getSeasonalNotes({
    has_outdoor_seating: input.business.has_outdoor_seating,
    business_character: input.business.business_character
  })
  
  // ========== NEW V5.1 FEATURES ==========
  
  // 7. Generate structured avoid_patterns by category (with AI-enhanced brochure language)
  guardrails.avoid_patterns = await generateAvoidPatterns(
    input.business.business_category,
    input.identity?.core_values || input.voice.personality_traits,  // Fallback to voice traits if no identity
    input.voice.personality_traits,
    input.voice.formality_level,
    openAiKey,
    language
  )
  console.log(`✅ Generated avoid_patterns: ${guardrails.avoid_patterns ? Object.keys(guardrails.avoid_patterns).length : 0} categories`)
  
  // 8. Add platform-specific length limits
  guardrails.length_limits = getDefaultLengthLimits()
  console.log(`✅ Added length_limits for ${Object.keys(guardrails.length_limits).length} platforms`)
  
  // 9. NEW V5.3: Add wallpaper avoidance rules
  guardrails.wallpaper_avoidance = {
    max_origin_mentions_percentage: 30,  // Max 30% of menu descriptions should mention origin
    required_variation_patterns: [
      'Variér mellem ingrediens-led, tilberednings-led og origin-led åbninger',
      'Brug forskellige sætningslængder (kort/medium/lang)',
      'Skift fokusområde: origin → ingredienser → tekstur/tilberedning'
    ],
    forbidden_repetitions: [
      'Ikke brug dash/tankestreg (-) som separator → signalerer AI content',
      'Ikke brug "klassisk [nationality]" i 2+ beskrivelser',
      'Ikke start alle beskrivelser med samme mønster',
      'Undgå repetition af samme adjektiver på tværs af retter'
    ]
  }
  console.log(`✅ Added wallpaper_avoidance rules`)
  
  return guardrails
}

/**
 * Parse legacy things_to_avoid text into structured exclusions
 */
function parseThingsToAvoid(thingsToAvoid: string): string[] {
  if (!thingsToAvoid || thingsToAvoid.trim() === '') return []
  
  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(thingsToAvoid)
    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'string' && item.length > 5)
    }
    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed.items.filter((item: unknown) => typeof item === 'string' && item.length > 5)
    }
    // If JSON parse succeeded but format is unsupported (e.g., {"language_constraints":[],"factual_constraints":[]})
    // Return empty array instead of falling through to text parsing
    console.warn('⚠️ things_to_avoid contains unsupported JSON format, ignoring')
    return []
  } catch {
    // Not JSON, parse as text
  }
  
  // Parse as plain text (bullet points or lines)
  const lines = thingsToAvoid.split('\n')
    .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(l => l.length > 5)
  
  return lines
}

/**
 * Parse voice_constraints into structured exclusions
 */
function parseVoiceConstraints(constraints: string): string[] {
  if (!constraints || constraints.trim() === '') return []
  
  const lines = constraints.split('\n')
    .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(l => l.length > 5 && (
      l.toLowerCase().includes('undgå') ||
      l.toLowerCase().includes('ikke') ||
      l.toLowerCase().includes('aldrig')
    ))
  
  return lines
}

/**
 * AI-generate never_say rules (word → replacement)
 */
async function aiGenerateNeverSayRules(
  input: GuardrailsGenerationInput,
  openAiKey: string,
  language: string = 'da'
): Promise<string[]> {
  
  const systemPrompt = getV5Prompt('neversay', language)  // Multi-language system prompt

  const userPrompt = `Generer never-say regler for ${input.business.business_category}.

BRAND VOICE:
- Personality: ${input.voice.personality_traits.join(', ')}
- Tone: ${input.voice.tone_rules.slice(0, 2).join('; ')}

${input.identity ? `BRAND CHARACTER:
- Essence: ${input.identity.brand_essence.slice(0, 100)}

` : ''}Fokuser på branche-specifikke fejl og generic marketing-speak der modsiger brand voice.`

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
        temperature: 0.5,
        max_tokens: 500
      })
    })

    const data = await response.json()
    const content = data.choices[0].message.content
    
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((rule: unknown) => 
            typeof rule === 'string' && rule.includes('→')
          )
          .map((rule: string) => {
            // Recursively remove quotes until none remain
            let cleaned = rule.trim()
            let previousLength = 0
            
            // Keep removing quotes until string stabilizes (max 10 iterations)
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
          .filter((rule: string) => rule.length > 0 && rule.includes('→'))
          .slice(0, 7)
      }
    } catch {
      const lines = content.split('\n')
        .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .map(l => {
          // Recursively clean quotes
          let cleaned = l.trim()
          for (let i = 0; i < 10 && cleaned.length > 0; i++) {
            const prev = cleaned
            cleaned = cleaned
              .replace(/^["'`]+/g, '')
              .replace(/["'`]+$/g, '')
              .replace(/,\s*$/g, '')
              .trim()
            if (prev === cleaned) break
          }
          return cleaned
        })
        .filter(l => l.includes('→'))
        .slice(0, 7)
      
      return lines.length > 0 ? lines : getDefaultNeverSayRules(input.business.business_category)
    }

  } catch (error) {
    console.error('❌ Never-say generation failed:', error)
  }
  
  return getDefaultNeverSayRules(input.business.business_category)
}

/**
 * AI-generate content exclusions
 */
async function aiGenerateContentExclusions(
  input: GuardrailsGenerationInput,
  openAiKey: string,
  language: string = 'da'
): Promise<string[]> {
  
  const systemPrompt = getV5Prompt('exclusions', language)  // Multi-language system prompt

  const userPrompt = `Generer content exclusions for ${input.business.business_category}.

${input.identity ? `BRAND CHARACTER:
${input.identity.core_values.map(v => `- ${v}`).join('\n')}

` : ''}Fokuser på emner der kan skade brand eller skabe problemer.`

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
        temperature: 0.4,
        max_tokens: 400
      })
    })

    const data = await response.json()
    const content = data.choices[0].message.content
    
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 6)
      }
    } catch {
      const lines = content.split('\n')
        .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(l => l.length > 10)
        .slice(0, 6)
      
      return lines.length > 0 ? lines : getDefaultContentExclusions()
    }

  } catch (error) {
    console.error('❌ Content exclusion generation failed:', error)
  }
  
  return getDefaultContentExclusions()
}

/**
 * Get standard factual constraints for restaurants
 */
function getStandardFactualConstraints(businessCategory: string): string[] {
  const base = [
    'Opfind aldrig events, tilbud, musik eller arrangementer',
    'Bekræft åbningstider før nævnelse',
    'Ingen påstande om "bedst", "første" eller superlatives uden dokumentation',
    'Verificer menupunkter eksisterer før omtale'
  ]
  
  // Add category-specific constraints
  if (businessCategory.toLowerCase().includes('café') || 
      businessCategory.toLowerCase().includes('restaurant')) {
    base.push('Bekræft allergener og ernæringsinformation ved specifikke claims')
  }
  
  if (businessCategory.toLowerCase().includes('bar')) {
    base.push('Aldrig opfordre til overforbrug af alkohol')
  }
  
  return base
}

/**
 * Extract the outdoor seating term actually used by the business
 * Checks business_character text for specific vocabulary
 */
function extractOutdoorSeatingTerm(businessCharacter?: string): string {
  if (!businessCharacter) return 'udeservering'
  
  const text = businessCharacter.toLowerCase()
  
  // Check in priority order (most specific first)
  if (text.includes('udeservering')) return 'udeservering'
  if (text.includes('udeservering')) return 'udeservering'
  if (text.includes('terrasse')) return 'terrasse'
  if (text.includes('udservering')) return 'udservering'
  if (text.includes('gårdhave')) return 'gårdhave'
  if (text.includes('have')) return 'have'
  
  // Default fallback
  return 'udeservering'
}

/**
 * Get seasonal notes (vocabulary-aware)
 * Only includes outdoor seating note if business actually has outdoor seating
 * Uses the term the business actually uses (not hardcoded "terrasse")
 */
function getSeasonalNotes(input: {
  has_outdoor_seating?: boolean;
  business_character?: string;
}): string[] {
  const base = [
    'Fremhæv hygge indendørs i vinterperioden',
    'Sæsonale råvarer: Forår (asparges), Sommer (jordbær), Efterår (svampe), Vinter (kål)'
  ]
  
  // Only add outdoor-seating seasonal note if business actually has outdoor seating
  if (input.has_outdoor_seating) {
    // Extract the term they actually use from business_character
    const outdoorTerm = extractOutdoorSeatingTerm(input.business_character)
    base.unshift(`Undgå ${outdoorTerm}-fokus oktober-marts (vejret understøtter det ikke)`)
  }
  
  return base
}

/**
 * Default never-say rules by category
 */
function getDefaultNeverSayRules(businessCategory: string): string[] {
  const base = [
    'billig → god værdi',
    'lækker → (vær specifik: sprød, cremet, saftig)',
    'fantastisk → (fjern ordet)',
    'dejlig → (vær konkret)'
  ]
  
  // Note: morgenmad and brunch are DIFFERENT meal occasions
  // morgenmad = quick breakfast (07:00-09:00, weekday, work-related)
  // brunch = leisurely social meal (10:00-14:00, weekend, social)
  // Allow both terms - don't force substitution
  
  if (businessCategory.toLowerCase().includes('café')) {
    base.push('kaffebar → café')
  }
  
  return base
}

/**
 * Default content exclusions
 */
function getDefaultContentExclusions(): string[] {
  return [
    'Undgå at nævne konkurrenter direkte',
    'Ingen politiske emner eller holdninger',
    'Ingen gennemgående kampagner uden godkendelse',
    'Undgå kontroversielle emner (religion, etnicitet, osv.)'
  ]
}

// ============================================================================
// NEW V5.1 HELPERS: Structured Avoid Patterns & Length Limits
// ============================================================================

/**
 * AI-generate brand-specific brochure language patterns to avoid
 */
async function aiGenerateBrochureLanguage(
  businessCategory: string,
  personalityTraits: string[],
  formalityLevel: string,
  openAiKey: string,
  language: string = 'da'
): Promise<string[]> {
  
  const systemPrompt = language === 'da'
    ? `Du er ekspert i at identificere generisk marketingsprog og klichéer i restaurantbranchen.

Din opgave er at liste specifikke fraser og udtryk der ALDRIG skal bruges i sociale medier posts for en ${businessCategory}.

Fokuser på:
- Poetisk/blomstrende sprog ("hyldest til", "sanseoplevelse")
- Overbrugte restaurant-klichéer ("pirrer næsen", "fuldender oplevelsen")
- Generisk marketingsprog ("forestil dig", "tager dig med på en rejse")
- Tomme superlative fraser ("en sand oplevelse", "løfter til nye højder")

Returner kun fraser der er specifikke nok til at detektere i tekst.
Returner et JSON array med 8-12 fraser.`
    : `You are an expert at identifying generic marketing language and clichés in the restaurant industry.

Your task is to list specific phrases and expressions that should NEVER be used in social media posts for a ${businessCategory}.

Focus on:
- Poetic/flowery language
- Overused restaurant clichés
- Generic marketing speak
- Empty superlative phrases

Return only phrases specific enough to detect in text.
Return a JSON array with 8-12 phrases.`

  const userPrompt = language === 'da'
    ? `Generer brochure language patterns for en ${businessCategory} med denne personlighed: ${personalityTraits.slice(0, 3).join(', ')}.

Formalitet: ${formalityLevel}

Inkluder:
1. Poetiske madskrivelses-klichéer
2. "Forestil dig..." type fraseringer  
3. "Hyldest til..." / "løfter til..." konstruktioner
4. Overbrugte sanse-beskrivelser

Returner JSON array.`
    : `Generate brochure language patterns for a ${businessCategory} with this personality: ${personalityTraits.slice(0, 3).join(', ')}.

Formality: ${formalityLevel}

Include:
1. Poetic food writing clichés
2. "Imagine..." type phrases
3. "Ode to..." / "elevates to..." constructions
4. Overused sensory descriptions

Return JSON array.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    const parsed = JSON.parse(content)
    
    // Extract array from various possible JSON formats
    let patterns: string[] = []
    if (Array.isArray(parsed)) {
      patterns = parsed
    } else if (parsed.patterns && Array.isArray(parsed.patterns)) {
      patterns = parsed.patterns
    } else if (parsed.phrases && Array.isArray(parsed.phrases)) {
      patterns = parsed.phrases
    } else if (parsed.brochure_language && Array.isArray(parsed.brochure_language)) {
      patterns = parsed.brochure_language
    } else if (parsed.brochure_sprog && Array.isArray(parsed.brochure_sprog)) {
      patterns = parsed.brochure_sprog
    } else if (parsed.klichéer && Array.isArray(parsed.klichéer)) {
      patterns = parsed.klichéer
    } else if (parsed.fraser && Array.isArray(parsed.fraser)) {
      patterns = parsed.fraser
    } else {
      console.warn(`⚠️ Unexpected JSON format for brochure patterns:`, Object.keys(parsed))
      // Fallback: find first array value
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          patterns = parsed[key]
          console.log(`   Using array from field: ${key}`)
          break
        }
      }
    }
    
    // Filter and clean
    const cleaned = patterns
      .map(p => String(p).toLowerCase().trim())
      .filter(p => p.length > 3 && p.length < 80)
      .slice(0, 12)
    
    console.log(`✅ AI generated ${cleaned.length} brochure language patterns`)
    return cleaned

  } catch (error) {
    console.error('⚠️ Brochure language AI generation failed:', error)
    // Return defaults
    return [
      'forestil dig',
      'hyldest til',
      'løfter til nye højder',
      'en sand oplevelse',
      'pirrer sanserne',
      'tager dig med på en rejse'
    ]
  }
}

/**
 * Generate structured avoid_patterns by category
 * 
 * Combines AI-generated brand-specific patterns with default patterns
 */
async function generateAvoidPatterns(
  businessCategory: string,
  coreValues: string[],
  personalityTraits: string[],
  formalityLevel: string,
  openAiKey: string,
  language: string = 'da'
): Promise<V5Guardrails['avoid_patterns']> {
  
  // v5.1.3: Split into strip_from_output vs generation_constraints
  const patterns: V5Guardrails['avoid_patterns'] = {
    strip_from_output: {
      brochure_language: [],
      superlatives: [],
      generic_marketing: [],
      ai_tells: [],
      formulaic_wallpaper: []
    },
    generation_constraints: {
      compound_sentences: []
    }
  }
  
  // AI-generate brand-specific brochure language patterns
  if (businessCategory.toLowerCase().includes('café') ||
      businessCategory.toLowerCase().includes('restaurant') ||
      businessCategory.toLowerCase().includes('bar') ||
      businessCategory.toLowerCase().includes('bistro')) {
    
    patterns.strip_from_output!.brochure_language = await aiGenerateBrochureLanguage(
      businessCategory,
      personalityTraits,
      formalityLevel,
      openAiKey,
      language
    )
  }
  
  // Superlatives (always avoid for factual accuracy)
  patterns.strip_from_output!.superlatives = [
    'perfekt',
    'fantastisk',
    'unik',
    'exceptionel',
    'ekstraordinær',
    'uovertruffet',
    'den bedste'
  ]
  
  // Generic marketing speak
  patterns.strip_from_output!.generic_marketing = [
    'forkæl dig selv',
    'du fortjener det',
    'en oplevelse for alle sanser',
    'den perfekte kombination',
    'nyd det gode liv',
    'vi glæder os til at se dig',
    'book et bord i dag'
  ]
  
  // AI tells (patterns that reveal AI generation)
  patterns.strip_from_output!.ai_tells = [
    // Incomplete sentences with periods
    // Overly formal transitions
    'således',
    'ydermere',
    'derudover'
  ]
  
  // GENERATION CONSTRAINT: Compound sentence markers (enforce one thought per sentence)
  // CRITICAL: These are PROMPT-LEVEL ONLY — never strip these common Danish words from output!
  // "når" and "da" appear in legitimate sentences: "Vi har åbent når du er klar"
  patterns.generation_constraints!.compound_sentences = [
    'mens',
    'selvom',
    'fordi',
    'eftersom',
    'når',
    'da'  // (in causal sense, not date)
  ]
  
  // NEW V5.3: Formulaic wallpaper patterns (menu description anti-patterns)
  patterns.strip_from_output!.formulaic_wallpaper = [
    'Ikke start hver ret med nationality (Italiensk..., Fransk..., Spansk...)',
    'Variér mellem ingrediens/tilberedning/oprindelse som åbning',
    'Undgå "klassisk [nationality]" i mere end 30% af beskrivelser',
    'Brug ikke samme sætningsstruktur i alle beskrivelser',
    'Maksimalt 1 af 3 menu-beskrivelser må nævne dish origin',
    'Variation i længde: nogle korte (5-8 ord), nogle medium (9-12 ord), nogle lange (13+ ord)'
  ]
  
  // Brand-specific refinements based on personality
  if (personalityTraits.some(t => t.toLowerCase().includes('direkte') || t.toLowerCase().includes('kortfattet'))) {
    // If brand is direct/concise, be extra strict on brochure language
    patterns.brochure_language!.push(
      'indbyder til',
      'byder på',
      'leverer en oplevelse'
    )
  }
  
  if (coreValues.some(v => v.toLowerCase().includes('autentisk') || v.toLowerCase().includes('ærlig'))) {
    // If authenticity is core value, avoid all superlatives
    patterns.superlatives!.push(
      'vidunderlig',
      'fortryllende',
      'magisk'
    )
  }
  
  return patterns
}

/**
 * Get default length limits for all platforms
 */
function getDefaultLengthLimits(): V5Guardrails['length_limits'] {
  return {
    instagram: {
      sentences: '3-6',
      characters: '300-450'
    },
    facebook: {
      sentences: '3-6',
      characters: '300-450'
    },
    google: {
      sentences: '2-4',
      characters: '180-300'
    },
    story: {
      sentences: '1',
      characters: '100-150'
    }
  }
}
