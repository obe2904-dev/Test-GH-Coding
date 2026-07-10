/**
 * Layer 5a: Voice Profile Generation
 * 
 * Generates structured voice guidelines from business context and identity.
 * Can parse existing tone_of_voice text or AI-generate from scratch.
 * 
 * V5.3 UPDATE: Added origin mention strategy analysis and wallpaper avoidance
 * V5.1 UPDATE: Uses voice archetype system for prescriptive professional rules
 * 
 * @version 5.3
 * @date May 24, 2026
 */

import type { V5Voice, V5Identity, VoiceGenerationInput } from './types-v5.ts'
import { getV5Prompt } from './v5-prompts.ts'
import type { VoiceArchetype } from './voice-archetypes.ts'
import type { ProfessionalPersona } from './professional-persona.ts'

// ============================================================================
// MENU ORIGIN ANALYSIS (V5.3)
// ============================================================================

/**
 * Analyzes menu items to detect origin mention patterns
 * 
 * Purpose: Determine how frequently the menu already mentions dish origins
 * (Belgian, French, Italian, etc.) to inform menu_description_examples strategy
 * 
 * @param menuItems - Array of menu item objects with name and description
 * @param signatureThemes - Signature themes from menu analysis
 * @returns Origin strategy metadata for voice profile
 */
export function analyzeMenuOriginStrategy(
  menuItems?: Array<{ name?: string; description?: string }>,
  signatureThemes?: string[]
): {
  frequency: 'never' | 'selective' | 'frequent' | 'always';
  reasoning: string;
  detected_keywords: string[];
} {
  
  // Common origin keywords in Danish
  const originKeywords = [
    'belgisk', 'belgian',
    'fransk', 'french', 'franske',
    'italiensk', 'italian', 'italienske',
    'spansk', 'spanish', 'spanske',
    'græsk', 'greek', 'græske',
    'japansk', 'japanese', 'japanske',
    'kinesisk', 'chinese', 'kinesiske',
    'thailandsk', 'thai',
    'indisk', 'indian', 'indiske',
    'mexicansk', 'mexican', 'mexicanske',
    'amerikansk', 'american', 'amerikanske',
    'dansk', 'danish', 'danske',
    'klassiker', 'classic', 'tradition', 'autentisk', 'authentic'
  ]
  
  if (!menuItems || menuItems.length === 0) {
    return {
      frequency: 'selective',
      reasoning: 'Ingen menu data tilgængelig - anbefaler selektiv brug af origin mentions baseret på signature themes',
      detected_keywords: []
    }
  }
  
  // Count how many menu items mention origins
  let itemsWithOrigin = 0
  const detectedKeywords = new Set<string>()
  
  for (const item of menuItems) {
    const textToSearch = `${item.name || ''} ${item.description || ''}`.toLowerCase()
    
    for (const keyword of originKeywords) {
      if (textToSearch.includes(keyword)) {
        itemsWithOrigin++
        detectedKeywords.add(keyword)
        break // Count each item only once
      }
    }
  }
  
  const percentage = (itemsWithOrigin / menuItems.length) * 100
  
  // Check signature themes for international/fusion indicators
  const hasInternationalTheme = signatureThemes?.some(theme => 
    theme.toLowerCase().includes('international') ||
    theme.toLowerCase().includes('fusion') ||
    theme.toLowerCase().includes('fransk') ||
    theme.toLowerCase().includes('italiensk') ||
    theme.toLowerCase().includes('belgisk') ||
    theme.toLowerCase().includes('asiatisk')
  ) || false
  
  // Determine frequency strategy
  let frequency: 'never' | 'selective' | 'frequent' | 'always'
  let reasoning: string
  
  if (percentage === 0 && !hasInternationalTheme) {
    frequency = 'never'
    reasoning = `Menu nævner ikke cuisine origins (0% af ${menuItems.length} retter). Fokuser på ingredienser og tilberedning i stedet.`
  } else if (percentage < 15 || (percentage < 30 && !hasInternationalTheme)) {
    frequency = 'selective'
    reasoning = `Menu bruger origin mentions sparsomt (${Math.round(percentage)}% af ${menuItems.length} retter). Brug kun når det tilføjer autenticitetsværdi.`
  } else if (percentage < 50 || (percentage < 70 && hasInternationalTheme)) {
    frequency = 'frequent'
    reasoning = `Menu nævner origins regelmæssigt (${Math.round(percentage)}% af ${menuItems.length} retter)${hasInternationalTheme ? ' og signature themes inkluderer international cuisine' : ''}. Origin framing er del af brandidentiteten.`
  } else {
    frequency = 'always'
    reasoning = `Menu bruger origin mentions konsekvent (${Math.round(percentage)}% af ${menuItems.length} retter). Autenticitet og provenance er central for brandet.`
  }
  
  return {
    frequency,
    reasoning,
    detected_keywords: Array.from(detectedKeywords)
  }
}

// ============================================================================
// TEAM/PEOPLE ANCHORS EXTRACTION (V5.6)
// ============================================================================

/**
 * Extracts verified team roles and processes for BTS content
 * 
 * Purpose: Prevent hallucination in brand_behind/team_people posts by providing
 * factual boundaries about what roles and processes actually exist.
 * 
 * @param menuContext - Menu data including signature themes and items
 * @param businessType - Detected business type and vertical
 * @param programmes - Active programmes (brunch, bar, etc.)
 * @returns Array of verified team/process anchors
 */
export function extractTeamPeopleAnchors(
  menuContext?: VoiceGenerationInput['menuContext'],
  businessType?: { type: string; vertical?: string },
  programmes?: Array<{ type: string }>,
  menuItems?: Array<{ name?: string; description?: string; category?: string }>
): string[] {
  const anchors: string[] = []
  
  if (!menuContext && !businessType && !programmes) {
    return anchors
  }
  
  // Craft/homemade signals from menu
  const craftKeywords = [
    'hjemmelavet', 'hjemmelavede', 'friskbagt', 'friskbagte',
    'egen produktion', 'egenproduceret', 'in-house',
    'håndlavet', 'håndlavede', 'håndværk'
  ]
  
  const menuText = menuItems
    ?.map(item => `${item.name || ''} ${item.description || ''}`.toLowerCase())
    .join(' ') || ''
  
  const hasCraftSignals = craftKeywords.some(keyword => 
    menuText.includes(keyword) || 
    menuContext?.signature_themes?.some(theme => theme.toLowerCase().includes(keyword))
  )
  
  if (hasCraftSignals) {
    anchors.push('Køkken der tilbereder hjemmelavede elementer')
  }
  
  // Bartender role (requires bar programme + cocktails/wine)
  const hasBarProgramme = programmes?.some(p => 
    p.type === 'bar' || p.type === 'cocktail_bar' || p.type === 'wine_bar'
  ) || businessType?.vertical === 'bar' || businessType?.vertical === 'cocktail_bar'
  
  const hasCocktails = menuText.includes('cocktail') || 
    menuContext?.signature_themes?.some(theme => 
      theme.toLowerCase().includes('cocktail') || theme.toLowerCase().includes('drinks')
    )
  
  const hasWine = menuText.includes('vin ') || menuText.includes('wine') ||
    menuContext?.signature_themes?.some(theme => theme.toLowerCase().includes('vin'))
  
  if (hasBarProgramme && (hasCocktails || hasWine)) {
    if (hasCocktails) {
      anchors.push('Bartender med cocktailprogram')
    } else if (hasWine) {
      anchors.push('Sommelier med vinprogram')
    }
  }
  
  // Barista role (specialty coffee signals)
  const specialtyCoffeeKeywords = [
    'espresso', 'cappuccino', 'flat white', 'cortado',
    'specialty coffee', 'kaffebar', 'coffee bar'
  ]
  
  const hasSpecialtyCoffee = specialtyCoffeeKeywords.some(keyword => 
    menuText.includes(keyword) ||
    menuContext?.signature_themes?.some(theme => theme.toLowerCase().includes(keyword))
  )
  
  if (hasSpecialtyCoffee) {
    anchors.push('Barista med specialty coffee')
  }
  
  // Food presentation signals (tapas, sharing, tasting menu)
  const presentationKeywords = [
    'tapas', 'sharing', 'deletallerken', 'tasting menu',
    'menu', 'anretning', 'præsentation'
  ]
  
  const hasPresentation = presentationKeywords.some(keyword => 
    menuText.includes(keyword) ||
    menuContext?.signature_themes?.some(theme => theme.toLowerCase().includes(keyword))
  )
  
  if (hasPresentation) {
    anchors.push('Mad-præsentation og anretning')
  }
  
  // Chef/kitchen operation (most restaurants/cafes have this)
  const hasKitchen = businessType?.vertical === 'restaurant' || 
    businessType?.vertical === 'cafe' || 
    businessType?.vertical === 'bakery' ||
    programmes?.some(p => p.type === 'brunch' || p.type === 'lunch' || p.type === 'dinner')
  
  // Only add generic chef anchor if no specific craft/presentation anchors exist
  if (hasKitchen && anchors.length === 0) {
    anchors.push('Køkken der tilbereder dagens retter')
  }
  
  return anchors
}

/**
 * Generates voice profile (Layer 5a)
 * 
 * Strategy (V5.2):
 * 1. AI-generate with FULL context (city culture, audience, price, neighborhood)
 * 2. If legacy tone_of_voice exists → Parse into structured format
 * 3. Fallback → Basic AI generation
 */
export async function generateVoiceProfile(
  input: VoiceGenerationInput,
  openAiKey: string,
  language: string = 'da'  // Multi-language support (default Danish)
): Promise<V5Voice> {
  
  // NEW V5.3: Separated prompts for better quality
  // Prompt 3: Voice Framework (tone rules, personality, formality)
  console.log(`🤖 Generating AI voice framework...`)
  const voiceFramework = await aiGenerateVoiceProfile(input, openAiKey, language)
  
  // Prompt 4: Menu Description Examples (dedicated, focused prompt)
  console.log(`📝 Generating menu description examples...`)
  const menuExamples = await generateMenuDescriptionExamples(
    input,
    voiceFramework,
    openAiKey,
    language,
    0,  // attemptNumber starts at 0
    undefined  // requestId - can be added later if needed
  )
  
  // NEW V5.4: Social Writing Examples (tone-demonstrating phrases)
  console.log(`📱 Generating social writing examples...`)
  const socialExamples = await generateSocialWritingExamples(
    input,
    voiceFramework,
    openAiKey,
    language,
    0,  // attemptNumber starts at 0
    undefined  // requestId - can be added later if needed
  )
  
  // NEW V5.6: Extract team/people anchors from menu and business context
  console.log(`👥 Extracting team/people anchors...`)
  const teamPeopleAnchors = extractTeamPeopleAnchors(
    input.menuContext,
    input.businessTypeDetection,
    undefined,  // programmes - not available in VoiceGenerationInput, will need to be passed if available
    input.menuContext?.sample_items
  )
  console.log(`👥 Team anchors extracted: ${teamPeopleAnchors.join(', ') || 'none'}`)
  
  // Merge results
  return {
    ...voiceFramework,
    menu_description_examples: menuExamples,
    social_writing_examples: socialExamples,
    team_people_anchors: teamPeopleAnchors.length > 0 ? teamPeopleAnchors : undefined
  }
}

/**
 * AUTO-EXPAND personality traits into concrete operational rules
 * Translates abstract traits (for owner understanding) into executable AI instructions
 */
function expandPersonalityTraitsToRules(
  traits: string[], 
  formalityLevel: string
): string[] {
  const rules: string[] = []
  
  // Normalize traits for matching (lowercase, trim)
  const normalizedTraits = traits.map(t => t.toLowerCase().trim())
  console.log(`[expandTraits] Input traits:`, traits)
  console.log(`[expandTraits] Normalized:`, normalizedTraits)
  
  // SOPHISTICATED/SOFISTIKERET → Avoid pushy sales language
  if (normalizedTraits.some(t => 
    t.includes('sofistikeret') || 
    t.includes('sophisticated') || 
    t.includes('elegant') ||
    t.includes('refined')
  )) {
    console.log(`[expandTraits] ✅ Matched sophisticated/sofistikeret`)
    rules.push('Undgå imperativer som åbning (ikke "Kom forbi", "Oplev", "Tag" — brug deklarative åbninger som "Morgenmad klar fra kl. 9")')
    rules.push('Undgå generisk salgssprog: "perfekt", "lækker", "hyggelig", "nyd", "unik", "autentisk"')
  }
  
  // MODERN/MODERNE → Avoid old-fashioned language
  if (normalizedTraits.some(t => 
    t.includes('moderne') || 
    t.includes('modern') ||
    t.includes('contemporary')
  )) {
    console.log(`[expandTraits] ✅ Matched moderne/modern`)
    rules.push('Undgå dateret sprog: "svip", "tag en pause fra hverdagen", "varm omfavnelse"')
  }
  
  // LOCAL/LOKAL → Already handled by archetype typically, but reinforce
  if (normalizedTraits.some(t => 
    t.includes('lokal') || 
    t.includes('local')
  )) {
    // This is usually already in archetype rules, so skip to avoid duplication
    // rules.push('Brug lokale referencer og geografiske detaljer')
  }
  
  // INFORMAL + sophisticated → Special case (casual sophistication)
  if (formalityLevel === 'informal' && normalizedTraits.some(t => t.includes('sofistikeret'))) {
    rules.push('Balancér venlig informalitet med kvalitetsbevidsthed — undgå både stiv formality OG billig casual-tale')
  }
  
  // FRIENDLY/VENLIG + avoiding pushiness
  if (normalizedTraits.some(t => 
    t.includes('indbydende') || 
    t.includes('inviting') ||
    t.includes('welcoming')
  )) {
    // Already covered by sophisticated rules above if present
    // Otherwise it's OK to be inviting
  }
  
  return rules
}

/**
 * NEW V5.1: Build voice profile from professional archetype
 */
function buildVoiceFromArchetype(
  archetype: VoiceArchetype,
  persona: ProfessionalPersona,
  identity: V5Identity,
  business: { business_name: string; business_category: string; establishment_type?: string }
): V5Voice {
  // Use archetype base rules directly (these are Danish, prescriptive, measurable)
  const tone_rules = [...archetype.base_rules]
  
  // Extract personality traits from archetype and persona
  const personality_traits = [
    ...persona.expertise_areas.slice(0, 2),  // Top 2 expertise areas as traits
    archetype.formality_level,
    archetype.professional_standards
  ]
  
  // AUTO-EXPAND personality traits into concrete operational rules
  // This translates abstract traits (for owner understanding) into executable AI instructions
  const expandedRules = expandPersonalityTraitsToRules(personality_traits, archetype.formality_level)
  console.log(`[Voice] Expanding traits ${JSON.stringify(personality_traits)} → ${expandedRules.length} new rules`)
  if (expandedRules.length > 0) {
    console.log(`[Voice] Auto-expanded rules:`, expandedRules)
  }
  tone_rules.push(...expandedRules)
  
  // Categorize rules
  const categorized = categorizeRules(tone_rules)
  
  // Build reasoning (Danish)
  const reasoning = `Voice archetype: ${archetype.archetype_name}

Professional persona: ${persona.expertise_areas.join(', ')}

Arketype valgt baseret på:
- Business type og location kombination
- Professionelle best practices for denne type business
- Geographic context og målgruppe

${tone_rules.length} konkrete voice rules sikrer konsistent professional quality.`
  
  return {
    tone_rules,
    personality_traits,
    formality_level: persona.tone_defaults.formality as any,
    sentence_structure: persona.tone_defaults.sentence_style as any,
    structural_rules: categorized.structural,
    style_rules: categorized.style,
    content_anchors: archetype.content_priorities,
    humor_style: 'professional' as const,  // Default to professional for AI-generated voice
    emoji_level: 'minimal' as const,  // Default to minimal for restaurants
    voice_confidence: 0.95,  // High confidence in professional archetype
    voice_reasoning: reasoning,
    avoid_examples: []  // Will be populated by guardrails later
  }
}

/**
 * Parse legacy tone_of_voice text into structured V5Voice format
 * 
 * Expected format:
 * ```
 * - STEMME-MEKANIK:
 * - Skriv én tanke pr. sætning — stop før du forklarer
 * - Tal direkte til gæsten — brug du-form
 * 
 * Eksempel: "Vi er klar."
 * Eksempel: "Kom forbi."
 * ```
 */
function parseLegacyToneOfVoice(toneOfVoice: string): Partial<V5Voice> {
  const lines = toneOfVoice.split('\n').map(l => l.trim()).filter(Boolean)
  
  const tone_rules: string[] = []
  const personality_traits: string[] = []
  
  for (const line of lines) {
    // Skip examples and headers
    if (line.startsWith('Eksempel:') || line.includes('STEMME-MEKANIK')) {
      continue
    }
    
    // Extract rules (lines starting with -)
    if (line.startsWith('-')) {
      const rule = line.replace(/^-\s*/, '').trim()
      if (rule.length > 10 && !rule.includes(':')) { // Avoid header lines
        tone_rules.push(rule)
      }
    }
  }
  
  // Infer personality traits from tone rules
  const text = toneOfVoice.toLowerCase()
  
  if (text.includes('kort') || text.includes('én tanke pr. sætning')) {
    personality_traits.push('kortfattet')
  }
  if (text.includes('direkte') || text.includes('tal direkte')) {
    personality_traits.push('direkte')
  }
  if (text.includes('venlig') || text.includes('du-form')) {
    personality_traits.push('venlig')
  }
  if (text.includes('lokal') || text.includes('autentisk')) {
    personality_traits.push('lokal')
  }
  
  // Infer formality from du/De usage
  const formality_level = text.includes('du-form') || text.includes('brug du') 
    ? 'informal' 
    : 'semi-formal'
  
  // Infer humor style from tone
  const humor_style = text.includes('tør') || text.includes('underspillet')
    ? 'dry'
    : text.includes('legende') || text.includes('humor')
    ? 'playful'
    : 'none'
  
  // Infer sentence structure
  const sentence_structure = text.includes('kort') || text.includes('én tanke')
    ? 'short_declarative'
    : 'conversational'
  
  return {
    tone_rules,
    personality_traits,
    formality_level,
    humor_style,
    emoji_level: 'minimal' as const,  // Default for parsed legacy
    sentence_structure
  }
}

/**
 * NEW V5.3: Generate menu description examples (Prompt 4 - dedicated)
 * 
 * Separated from voice profile generation for better quality.
 * Focuses 100% on crafting examples that demonstrate voice personality.
 * 
 * @param input - Voice generation input with menu context
 * @param voiceProfile - Already-generated voice framework from Prompt 3
 * @param openAiKey - OpenAI API key
 * @param language - Language code (default 'da')
 * @returns Array of 6 menu description examples (2 variations per dish)
 */
async function generateMenuDescriptionExamples(
  input: VoiceGenerationInput,
  voiceProfile: Partial<V5Voice>,
  openAiKey: string,
  language: string = 'da',
  attemptNumber: number = 0,
  requestId?: string
): Promise<string[]> {
  
  // If no menu items, return empty array
  if (!input.menuContext?.sample_items || input.menuContext.sample_items.length === 0) {
    console.log(`⚠️ No menu items provided, skipping examples`)
    return []
  }
  
  const sampleItems = input.menuContext.sample_items
  const expectedCount = sampleItems.length * 2
  
  const logPrefix = requestId ? `[${requestId}] ` : ''
  console.log(`${logPrefix}📝 Generating ${expectedCount} menu examples (${sampleItems.length} dishes × 2 variations)...`)
  console.log(`${logPrefix}   Voice: ${voiceProfile.personality_traits?.join(', ')} | ${voiceProfile.formality_level} | ${voiceProfile.humor_style}`)
  if (attemptNumber > 0) {
    console.log(`${logPrefix}   🔄 Retry attempt ${attemptNumber}`)
  }
  
  // Filter tone_rules to only culinary-relevant ones (exclude location/marketing)
  const culinaryToneRules = voiceProfile.tone_rules?.filter(rule => {
    const lower = rule.toLowerCase()
    
    // EXCLUDE patterns inappropriate for menu descriptions
    const excludePatterns = [
      'ved åen', 'ved vandet', 'ved havnen',  // Location references
      'i hjertet af', 'hos os', 'i området',   // Location/atmosphere
      'twist', 'vibes', 'mood',                // Vague marketing
      'atmosfære', 'stemning', 'oplevelse'     // Experience (not dish)
    ]
    
    if (excludePatterns.some(pattern => lower.includes(pattern))) {
      return false
    }
    
    // INCLUDE culinary-focused patterns
    const includePatterns = [
      'tilberedning', 'tilberedt',             // Cooking methods
      'ingrediens', 'kvalitet',                // Ingredients/quality
      'teknik', 'metode',                      // Technique
      'fokusér på', 'fremhæv'                  // Specific focus areas
    ]
    
    if (includePatterns.some(pattern => lower.includes(pattern))) {
      return true
    }
    
    // Default: exclude if uncertain (conservative approach)
    return false
  }).slice(0, 2) || []  // Max 2 rules to keep prompt focused
  
  console.log(`${logPrefix}   Filtered ${voiceProfile.tone_rules?.length || 0} tone rules → ${culinaryToneRules.length} culinary-relevant`)
  
  // Get dedicated prompt for menu examples
  const systemPrompt = getV5Prompt('menu_examples', language)
  
  // Build user prompt with full context
  const userPrompt = language === 'da'
    ? `Generer menu-beskrivelseseksempler for ${input.business.business_name}.

VOICE PROFILE (SKAL reflekteres i eksempler):
Personlighed: ${voiceProfile.personality_traits?.join(', ') || 'venlig, direkte'}
Formalitet: ${voiceProfile.formality_level || 'semi-formal'}
Humor: ${voiceProfile.humor_style || 'none'}
Sætningsstruktur: ${voiceProfile.sentence_structure || 'conversational'}

${culinaryToneRules.length > 0 ? `
CULINARY TONE RULES (kun kulinarisk relevante regler):
${culinaryToneRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}
` : ''}

BUSINESS CONTEXT:
- Navn: ${input.business.business_name}
- Kategori: ${input.business.business_category}
${input.geographicContext?.city_profile?.city ? `- By: ${input.geographicContext.city_profile.city}` : ''}
${input.locationIntelligence?.neighborhood_character ? `- Område: ${input.locationIntelligence.neighborhood_character}` : ''}
${input.menuContext.signature_themes ? `- Menu-temaer: ${input.menuContext.signature_themes.join(', ')}` : ''}

RETTER DU SKAL BESKRIVE (brug PRÆCIS disse ${sampleItems.length} retter):
${sampleItems.map((item, i) => {
  const parts = [`${i + 1}. "${item.name}"`]
  if (item.description) parts.push(`   Original: ${item.description}`)
  if (item.price) parts.push(`   Pris: ${item.price} DKK`)
  return parts.join('\n')
}).join('\n\n')}

OPGAVE:
Skriv ${expectedCount} beskrivelser (2 variationer per ret) der VISER voice-profilen i praksis.

KRITISK - PERSONA + FORMALITY ALIGNMENT:
- Personlighed udtrykkes INDEN FOR formalitetsniveau og kulturel kontekst
- Semi-formal + playful = legende men respektfuldt (IKKE slang, IKKE anglicismer)
- Hvis personlighed er "moderne, lokal" → brug moderne vendinger, undgå gammeldags sprog
- Hvis humor er "playful" MEN formality er "semi-formal" → leg med sprog men bevar kultiveret tone
- Hvis personlighed er "direkte, kortfattet" → gå direkte på, ingen svulstige beskrivelser
- VIS teknik-appreciation: "langsomt ovnbagt" ikke bare "ovnbagt"
- CONNECT metode til resultat: "grillet → saftig" ikke bare "grillet laks"

Returner JSON: {"menu_description_examples": ["...", "...", ...${expectedCount} total]}`
    : `Generate menu description examples for ${input.business.business_name}.

VOICE PROFILE (MUST be reflected in examples):
Personality: ${voiceProfile.personality_traits?.join(', ') || 'friendly, direct'}
Formality: ${voiceProfile.formality_level || 'semi-formal'}
Humor: ${voiceProfile.humor_style || 'none'}
Sentence structure: ${voiceProfile.sentence_structure || 'conversational'}

${culinaryToneRules.length > 0 ? `
CULINARY TONE RULES (only culinary-relevant rules):
${culinaryToneRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}
` : ''}

BUSINESS CONTEXT:
- Name: ${input.business.business_name}
- Category: ${input.business.business_category}
${input.geographicContext?.city_profile?.city ? `- City: ${input.geographicContext.city_profile.city}` : ''}
${input.menuContext.signature_themes ? `- Menu themes: ${input.menuContext.signature_themes.join(', ')}` : ''}

DISHES TO DESCRIBE (use EXACTLY these ${sampleItems.length} dishes):
${sampleItems.map((item, i) => `${i + 1}. "${item.name}"${item.description ? ` - ${item.description}` : ''}`).join('\n')}

TASK:
Write ${expectedCount} descriptions (2 variations per dish) that DEMONSTRATE the voice profile.

Return JSON: {"menu_description_examples": ["...", "...", ...${expectedCount} total]}`

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
        temperature: 0.3,  // Lower temp for structural consistency, personality through word choice
        max_tokens: 600,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    const parsed = JSON.parse(content)
    
    const examples = parsed.menu_description_examples || []
    
    console.log(`${logPrefix}🔍 AI returned ${examples.length} examples (expected ${expectedCount})`)
    
    // VALIDATION: Check hard constraints
    const failures: string[] = []
    
    // Check 1: Exact count
    if (examples.length !== expectedCount) {
      failures.push(`❌ WRONG COUNT: Expected ${expectedCount}, got ${examples.length}`)
    }
    
    // Check 2: Word count (5-12 words per example)
    examples.forEach((ex: string, i: number) => {
      const wordCount = ex.split(/\s+/).length
      if (wordCount > 12) {
        failures.push(`❌ EXAMPLE ${i+1} TOO LONG: ${wordCount} words (max 12): "${ex}"`)
      }
      if (wordCount < 5) {
        failures.push(`❌ EXAMPLE ${i+1} TOO SHORT: ${wordCount} words (min 5): "${ex}"`)
      }
    })
    
    // Check 3: Prohibited patterns (code-level enforcement)
    const prohibitedPatterns = [
      { 
        pattern: / - /,
        name: 'dash separator',
        severity: 'CRITICAL'
      },
      {
        pattern: /\bvores\b/i,
        name: 'possessive "vores"',
        severity: 'HIGH'
      },
      {
        pattern: /\bperfekt til\b/i,
        name: 'marketing phrase "perfekt til"',
        severity: 'HIGH'
      },
      {
        pattern: /\btwist\b/i,
        name: 'vague word "twist"',
        severity: 'CRITICAL'
      },
      {
        pattern: /\bved åen\b/i,
        name: 'location reference "ved åen"',
        severity: 'CRITICAL'
      },
      {
        pattern: /\bhos os\b/i,
        name: 'location reference "hos os"',
        severity: 'HIGH'
      },
      {
        pattern: /\bhjemmelavet\b/i,
        name: 'unverified claim "hjemmelavet"',
        severity: 'HIGH'
      },
      {
        pattern: /\bhåndlavet\b/i,
        name: 'unverified claim "håndlavet"',
        severity: 'HIGH'
      },
      {
        pattern: /\btil deling\b/i,
        name: 'serving context "til deling"',
        severity: 'MEDIUM'
      },
      {
        pattern: /\bmagisk\b/i,
        name: 'vague marketing "magisk"',
        severity: 'MEDIUM'
      }
    ]
    
    let patternFailures: string[] = []
    examples.forEach((ex: string, i: number) => {
      prohibitedPatterns.forEach(({ pattern, name, severity }) => {
        if (pattern.test(ex)) {
          patternFailures.push(
            `❌ [${severity}] EXAMPLE ${i+1} contains ${name}: "${ex}"`
          )
        }
      })
    })
    
    if (patternFailures.length > 0) {
      failures.push(...patternFailures)
    }
    
    // Check 4: Variation quality (pairs must differ)
    for (let i = 0; i < examples.length; i += 2) {
      if (i + 1 < examples.length) {
        const varA = examples[i]
        const varB = examples[i + 1]
        const aStart = varA.split(' ').slice(0, 2).join(' ').toLowerCase()
        const bStart = varB.split(' ').slice(0, 2).join(' ').toLowerCase()
        
        if (aStart === bStart) {
          failures.push(`❌ PAIR ${i/2 + 1} TOO SIMILAR: Both start "${aStart}"`)
        }
      }
    }
    
    // Check 5: Wallpaper detection
    const serveretCount = examples.filter((ex: string) => ex.includes('serveret med')).length
    if (serveretCount > 1) {
      failures.push(`❌ WALLPAPER: ${serveretCount} examples use "serveret med" (max 1)`)
    }
    
    // If validation fails, check if we should retry
    if (failures.length > 0) {
      console.error(`${logPrefix}❌ VALIDATION FAILED:`)
      failures.forEach(f => console.error(`${logPrefix}   ${f}`))
      
      // Check if we have CRITICAL or HIGH failures that should trigger retry
      const hasCriticalFailures = failures.some(f => 
        f.includes('[CRITICAL]') || f.includes('[HIGH]')
      )
      
      // Retry once if critical failures and this is first attempt
      if (hasCriticalFailures && attemptNumber === 0) {
        console.log(`${logPrefix}🔄 Retrying with strengthened constraints...`)
        
        // Retry with strengthened prompt (attemptNumber=1 prevents infinite retry)
        return generateMenuDescriptionExamples(
          input,
          voiceProfile,
          openAiKey,
          language,
          1,  // attemptNumber
          requestId
        )
      }
      
      // If still failing after retry OR only MEDIUM failures, attempt repair
      console.error(`${logPrefix}   Attempting repair...`)
      
      try {
        const repaired = await repairMenuExamples(
          examples,
          sampleItems,
          expectedCount,
          openAiKey,
          voiceProfile
        )
        
        if (repaired && repaired.length === expectedCount) {
          console.log(`${logPrefix}✅ Repair successful`)
          return repaired
        } else {
          console.error(`${logPrefix}❌ Repair failed, returning empty array`)
          return []
        }
      } catch (repairError) {
        console.error(`${logPrefix}❌ Repair error:`, repairError)
        return []
      }
    }
    
    console.log(`${logPrefix}✅ Validation passed: ${examples.length} examples`)
    examples.forEach((ex: string, i: number) => {
      const wordCount = ex.split(/\s+/).length
      console.log(`${logPrefix}   ${i + 1}. (${wordCount} words) ${ex}`)
    })
    
    return examples

  } catch (error) {
    console.error('❌ Menu examples generation failed:', error)
    return []
  }
}

/**
 * NEW V5.4: Generate social writing examples
 * 
 * Generates 8 short tone-demonstrating phrases for social media context.
 * Shows how business talks on Instagram/Facebook (tone only, not CTAs/emojis).
 * 
 * @param input - Voice generation input with business context
 * @param voiceProfile - Already-generated voice framework from Prompt 3
 * @param openAiKey - OpenAI API key
 * @param language - Language code (default 'da')
 * @returns Array of 8 social writing examples
 */
async function generateSocialWritingExamples(
  input: VoiceGenerationInput,
  voiceProfile: Partial<V5Voice>,
  openAiKey: string,
  language: string = 'da',
  attemptNumber: number = 0,
  requestId?: string
): Promise<string[]> {
  
  const logPrefix = requestId ? `[${requestId}] ` : ''
  console.log(`${logPrefix}📱 Generating 8 social writing examples...`)
  console.log(`${logPrefix}   Voice: ${voiceProfile.personality_traits?.join(', ')} | ${voiceProfile.formality_level}`)
  if (attemptNumber > 0) {
    console.log(`${logPrefix}   🔄 Retry attempt ${attemptNumber}`)
  }
  
  // For SOCIAL context, we KEEP location/atmosphere tone rules (unlike menu)
  const socialToneRules = voiceProfile.tone_rules?.filter(rule => {
    const lower = rule.toLowerCase()
    
    // For social media, we want location/atmosphere/community rules
    // KEEP patterns that would be filtered out for menu descriptions
    const keepForSocial = [
      'ved åen', 'ved vandet', 'location',      // Location OK for social
      'atmosfære', 'stemning', 'oplevelse',     // Experience OK for social
      'community', 'fællesskab', 'social'       // Community OK for social
    ]
    
    if (keepForSocial.some(pattern => lower.includes(pattern))) {
      return true
    }
    
    // EXCLUDE only generic marketing fluff
    const excludePatterns = [
      'vi elsker', 'bedste nogensinde',         // Generic speak
      'magisk', 'uforglemmelig',                // Overpromising
      'passion', 'værdi'                        // Corporate speak
    ]
    
    if (excludePatterns.some(pattern => lower.includes(pattern))) {
      return false
    }
    
    return true  // Default: include (less restrictive than menu)
  }).slice(0, 3) || []  // Max 3 rules to keep prompt focused
  
  console.log(`${logPrefix}   Filtered ${voiceProfile.tone_rules?.length || 0} tone rules → ${socialToneRules.length} social-relevant`)
  
  try {
    const systemPrompt = getV5Prompt('social_writing', language)
    
    // Build context about the business for ownable phrases
    const locationInfo = input.identity?.location_identity?.full_reference || ''
    const locationContext = locationInfo ? `Location: ${locationInfo}` : ''
    
    // Use programme TYPES (breakfast/lunch/dinner), NOT specific dishes  
    // Note: detected_programmes not in menuContext - use generic fallback
    const programmeTypes = input.menuContext?.signature_themes?.join(', ') || 'Restaurant'
    
    const philosophyHints = input.identity?.positioning || ''
    const signatureThemes = input.menuContext?.signature_themes?.slice(0, 2).join(', ') || ''
    const businessType = input.business?.business_category || input.business?.establishment_type || 'Restaurant'
    const businessName = input.business?.business_name || 'Business'
    
    const userPrompt = `BUSINESS: ${businessName}
BUSINESS TYPE: ${businessType} (use THIS, not "bistro" or generic terms)
${locationContext ? `${locationContext}\n` : ''}
VOICE PROFILE:
- Personality: ${voiceProfile.personality_traits?.join(', ')}
- Formality: ${voiceProfile.formality_level}
- Humor: ${voiceProfile.humor_style}
${socialToneRules.length > 0 ? `- Tone rules:\n${socialToneRules.map(r => `  • ${r}`).join('\n')}` : ''}

BUSINESS SPECIFICS (for ownable phrases):
${philosophyHints ? `- Philosophy/positioning: ${philosophyHints}\n` : ''}${signatureThemes ? `- Signature themes: ${signatureThemes}\n` : ''}- Programme types: ${programmeTypes}

CRITICAL RULES:
1. Do NOT describe specific menu items
2. Do NOT make factual claims (opening hours, years established) unless provided
3. Do NOT use generic business types ("bistro", "gourmet") - use actual: ${businessType}
4. Write about EXPERIENCE, LOCATION, PHILOSOPHY
5. Replace reference example placeholders with ACTUAL business data

Skriv 8 korte fraser (3-10 ord) der demonstrerer hvordan ${businessName} taler på sociale medier.
Focus på OWNABLE phrases der kun passer til DENNE business.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.3,  // Same as menu examples for consistency
        response_format: { type: 'json_object' },  // Ensure plain-string arrays, not objects
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const rawContent = data.choices[0]?.message?.content || ''
    
    // Parse JSON response (response_format:json_object guarantees valid JSON)
    const parsed = JSON.parse(rawContent)
    
    const examples: string[] = (parsed.social_writing_examples || []).map((ex: unknown) =>
      typeof ex === 'string' ? ex : String((ex as Record<string, unknown>)?.phrase ?? (ex as Record<string, unknown>)?.text ?? ex)
    )
    
    // Validate count
    if (examples.length !== 8) {
      console.error(`${logPrefix}❌ Expected 8 examples, got ${examples.length}`)
      
      if (attemptNumber === 0) {
        console.log(`${logPrefix}🔄 Retrying...`)
        return generateSocialWritingExamples(input, voiceProfile, openAiKey, language, 1, requestId)
      }
      
      return []
    }
    
    // Validation: Check for prohibited patterns
    const failures: string[] = []
    
    // Extract menu item names to detect if they appear in social phrases
    const menuItemNames = input.menuContext?.sample_items
      ?.map(item => item.name?.toLowerCase())
      .filter(Boolean) || []
    
    const businessCategory = input.business?.business_category?.toLowerCase() || ''
    
    // Type for validation patterns with optional context-aware exceptions
    type ProhibitedPattern = {
      pattern: RegExp;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
      message: string;
      allowIf?: (example: string) => boolean;  // Optional context-aware exception
    }
    
    // CONTEXT-AWARE VALIDATION:
    // Some words are banned in abstract marketing but acceptable in concrete contexts
    const prohibitedPatterns: ProhibitedPattern[] = [
      { pattern: /vi elsker|elsker vores|love our/i, severity: 'CRITICAL', message: 'Generic Instagram speak' },
      { pattern: /bedste.*nogensinde|uforglemmelig|magisk/i, severity: 'CRITICAL', message: 'Overpromising' },
      { pattern: /vibes|mood|foodie|hang out/i, severity: 'CRITICAL', message: 'Anglicisms' },
      { 
        pattern: /twist/i, 
        severity: 'HIGH',  // Downgraded from CRITICAL
        message: 'Marketing word (twist)', 
        allowIf: (example: string) => {
          // ALLOW if used in concrete menu context (e.g., "Vegetarisk twist på klassiske retter")
          const hasConcreteContext = /vegetarisk|klassisk|moderne.*med|nordisk.*på/i.test(example)
          return hasConcreteContext
        }
      },
      { 
        pattern: /kulinarisk rejse|gastronomi på højeste niveau/i, 
        severity: 'CRITICAL', 
        message: 'Vague marketing speak (journey/highest level)' 
      },
      { 
        pattern: /\boplevelse\b/i,  // Singular "oplevelse" is more abstract
        severity: 'HIGH',  // Downgraded from CRITICAL
        message: 'Vague word (oplevelse)', 
        allowIf: (example: string) => {
          // ALLOW plural "oplevelser" when connected to concrete facts (e.g., "nye smagsoplevelser")
          const hasConcreteContext = /nye smagsoplevelser|sæsonens oplevelser|ukens oplevelser/i.test(example)
          return hasConcreteContext
        }
      },
      { pattern: /i hver bid|i hvert måltid/i, severity: 'CRITICAL', message: 'Generic food clichés' },
      { pattern: /fra kl \d|siden \d{4}|åbner kl/i, severity: 'HIGH', message: 'Factual claim without verification (opening hours/year)' },
      { pattern: /vores passion|skabe værdi|commitment to/i, severity: 'HIGH', message: 'Corporate speak' },
      { pattern: /frisk hver dag|mad med sjæl/i, severity: 'HIGH', message: 'Generic phrases (not ownable)' },
      { pattern: /hjemmelavet|håndlavet/i, severity: 'MEDIUM', message: 'Unverified claims (unless confirmed)' }
    ]
    
    examples.forEach((example: string, index: number) => {
      const exampleLower = example.toLowerCase()
      
      // Check length
      const wordCount = example.trim().split(/\s+/).filter(Boolean).length
      if (wordCount < 3 || wordCount > 10) {
        failures.push(`❌ [MEDIUM] Example ${index + 1} length (${wordCount} words, expected 3-10): "${example}"`)
      }
      
      // CRITICAL: Check if menu item names appear in social phrases
      menuItemNames.forEach(itemName => {
        if (itemName && exampleLower.includes(itemName)) {
          failures.push(`❌ [CRITICAL] Example ${index + 1} contains menu item "${itemName}": "${example}"`)
        }
      })
      
      // Check prohibited patterns (WITH CONTEXT AWARENESS)
      prohibitedPatterns.forEach(({ pattern, severity, message, allowIf }) => {
        if (pattern.test(example)) {
          // Check if context-aware exception applies
          if (allowIf && allowIf(example)) {
            console.log(`${logPrefix}✅ Allowed exception: "${example}" (${message} but concrete context)`)
            return  // Skip this failure
          }
          failures.push(`❌ [${severity}] Example ${index + 1} contains ${message}: "${example}"`)
        }
      })
    })
    
    // If validation fails, check if we should retry
    if (failures.length > 0) {
      console.error(`${logPrefix}❌ VALIDATION FAILED:`)
      failures.forEach(f => console.error(`${logPrefix}   ${f}`))
      
      // Check if we have CRITICAL or HIGH failures that should trigger retry
      const hasCriticalFailures = failures.some(f => 
        f.includes('[CRITICAL]') || f.includes('[HIGH]')
      )
      
      // Retry once if critical failures and this is first attempt
      if (hasCriticalFailures && attemptNumber === 0) {
        console.log(`${logPrefix}🔄 Retrying with strengthened constraints...`)
        return generateSocialWritingExamples(input, voiceProfile, openAiKey, language, 1, requestId)
      }
      
      // If still failing, return empty (no repair for social examples)
      console.error(`${logPrefix}❌ Failed after retry, returning empty array`)
      return []
    }
    
    console.log(`${logPrefix}✅ Validation passed: ${examples.length} examples`)
    examples.forEach((ex: string, i: number) => {
      const wordCount = ex.split(/\s+/).length
      console.log(`${logPrefix}   ${i + 1}. (${wordCount} words) ${ex}`)
    })
    
    return examples

  } catch (error) {
    console.error(`${logPrefix}❌ Social writing examples generation failed:`, error)
    return []
  }
}

/**
 * AI-generate voice profile using GPT-4o
 */
async function aiGenerateVoiceProfile(
  input: VoiceGenerationInput,
  openAiKey: string,
  language: string = 'da'  // Add language parameter with default
): Promise<V5Voice> {
  
  const systemPrompt = getV5Prompt('voice', language)  // Multi-language system prompt

  // Build enhanced context sections
  const audienceContext = input.locationIntelligence?.category_scores 
    ? Object.entries(input.locationIntelligence.category_scores)
        .filter(([_, score]) => (score as number) >= 75)
        .sort(([_, a], [__, b]) => (b as number) - (a as number))
        .slice(0, 2)
        .map(([type, score]) => `${type} (${score} score)`)
        .join(', ')
    : null

  const priceTier = input.menuContext?.overall_avg_price 
    ? input.menuContext.overall_avg_price < 100 ? 'budget-friendly'
      : input.menuContext.overall_avg_price < 200 ? 'mid-range'
      : 'upscale'
    : null

  const userPrompt = `Generer voice profile for ${input.business.business_name}.

BUSINESS CONTEXT:
- Kategori: ${input.business.business_category}
${input.business.establishment_type ? `- Type: ${input.business.establishment_type}` : ''}
${input.businessTypeDetection?.detected_type ? `- Detekteret type: ${input.businessTypeDetection.detected_type}` : ''}
${input.businessTypeDetection?.professional_domain ? `- Professionelt domæne: ${input.businessTypeDetection.professional_domain}` : ''}

GEOGRAPHIC & CULTURAL CONTEXT:
${input.cityContext?.cultural_context ? `- Kulturel kontekst: ${input.cityContext.cultural_context}` : ''}
${input.geographicContext?.city_profile ? `- By: ${input.geographicContext.city_profile.city} (${input.geographicContext.city_profile.size_category}, ${input.geographicContext.city_profile.population?.toLocaleString()} indbyggere)` : ''}
${input.geographicContext?.location_context?.type ? `- Lokationstype: ${input.geographicContext.location_context.type}` : ''}
${input.geographicContext?.location_context?.signature ? `- Lokationssignatur: "${input.geographicContext.location_context.signature}"` : ''}
${input.locationIntelligence?.neighborhood_character ? `- Områdekarakter: ${input.locationIntelligence.neighborhood_character}` : ''}

AUDIENCE SIGNALS:
${audienceContext ? `- Primære målgrupper: ${audienceContext}` : '- Ingen stærke målgruppe-signaler'}

MENU & CULINARY CONTEXT:
${priceTier ? `- Prisniveau: ${priceTier}` : ''}
${input.menuContext?.overall_avg_price ? `- Gns. pris: ${input.menuContext.overall_avg_price} DKK` : ''}
${input.menuContext?.signature_themes ? `- Signature-temaer: ${input.menuContext.signature_themes.slice(0, 4).join(', ')}` : ''}

${input.professionalPersona?.expertise_areas ? `
PROFESSIONAL EXPERTISE:
- ${input.professionalPersona.expertise_areas.join(', ')}
` : ''}

${input.legacy_voice?.tone_model?.primary_keywords ? `
EXISTING PERSONALITY HINTS:
- Keywords: ${input.legacy_voice.tone_model.primary_keywords.join(', ')}
` : ''}

${input.legacy_voice?.voice_constraints ? `
CONSTRAINTS:
${input.legacy_voice.voice_constraints}
` : ''}

DIN OPGAVE:
Generer voice framework (positive guidelines + minimal constraints) 
der er 100% tilpasset DENNE specifikke business.

KRAV TIL TONE_DO_LIST (4-6 POSITIVE structural rules):
1. AFLED fra konteksten ovenfor - ikke generiske regler
   ❌ "Vær professionel" (kunne være ENHVER business)
   ✅ "Fremhæv tilberedningsmetoder og ingrediensers kvalitet" (reflects culinary + signature themes)
   ✅ "Brug lokale referencer til ${input.geographicContext?.city_profile?.city || 'området'}" (location-specific)

2. POSITIVE FRAMING - fortæl hvad man SKAL gøre
   ❌ "Undgå lange sætninger"
   ✅ "Skriv én tanke pr. sætning — hold det enkelt"
   ❌ "Undgå overflødige beskrivelser"
   ✅ "Fokusér på konkrete sanseindtryk og ingredienser"

3. REFLEKTER intelligence-specifics:
   - Hvis location = waterfront → "Brug stedets atmosfære som naturlig kontekst"
   - Hvis signature themes = European bistro → "Balancér mellem klassisk og moderne fortolkning"
   - Hvis audience = urban professionals + students → "Kombiner sofistikeret tone med tilgængelighed"
   - Hvis prisniveau = mid-range → "Kommunikér værdi gennem håndværk, ikke pris"

KRAV TIL AVOID_PATTERNS (minimale constraints - kun kritiske forbud):
- compound_sentences: Max 2 strukturelle forbud
  Eksempel: ["imperativer som åbning: 'Kom forbi', 'Oplev'"]
- generic_marketing: Max 6 marketing-klichéer
  Eksempel: ["perfekt", "lækker", "hyggelig", "nyd", "unik"]
- brochure_language: Max 4 daterede udtryk
  Eksempel: ["svip", "tag en pause", "varm omfavnelse"]

KRAV TIL PERSONALITY TRAITS:
- Konkrete adjektiver ("moderne", "indbydende", "lokal")
- IKKE vage ("friendly", "professional")
- 3-5 traits der matcher location + audience + culinary identity

Fokusér på POSITIVE guidance i tone_do_list.
Negative constraints skal være MINIMALE og separeret for lavere salience.`

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
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    const parsed = JSON.parse(content)

    console.log(`🔍 AI Voice Response Keys:`, Object.keys(parsed))
    console.log(`   - tone_do_list present: ${!!parsed.tone_do_list}`)
    console.log(`   - avoid_patterns present: ${!!parsed.avoid_patterns}`)
    
    // Map new structure to existing fields for backward compatibility
    // tone_do_list → tone_rules (for now, until full migration)
    const toneRules = parsed.tone_do_list || parsed.tone_rules || []
    
    // Extract avoid patterns for guardrails
    const avoidPatterns = parsed.avoid_patterns || {
      compound_sentences: [],
      generic_marketing: [],
      brochure_language: []
    }

    console.log(`   - Positive rules count: ${toneRules.length}`)
    console.log(`   - Avoid patterns: ${Object.keys(avoidPatterns).map(k => `${k}:${avoidPatterns[k]?.length || 0}`).join(', ')}`)
    
    // VALIDATION: Enforce constraints on menu_description_examples
    if (parsed.menu_description_examples && Array.isArray(parsed.menu_description_examples)) {
      const examples = parsed.menu_description_examples
      const expectedCount = (input.menuContext?.sample_items?.length || 3) * 2
      
      console.log(`🔍 Validating menu_description_examples...`)
      console.log(`   - Expected count: ${expectedCount} (${input.menuContext?.sample_items?.length || 3} dishes × 2 variations)`)
      console.log(`   - Actual count: ${examples.length}`)
      
      // Validation failures
      const failures: string[] = []
      
      // Check 1: Exact count
      if (examples.length !== expectedCount) {
        failures.push(`❌ WRONG COUNT: Expected ${expectedCount}, got ${examples.length}`)
      }
      
      // Check 2: Word count (5-12 words per example)
      examples.forEach((ex, i) => {
        const wordCount = ex.split(/\s+/).length
        if (wordCount > 12) {
          failures.push(`❌ EXAMPLE ${i+1} TOO LONG: ${wordCount} words (max 12): "${ex}"`)
        }
        if (wordCount < 5) {
          failures.push(`❌ EXAMPLE ${i+1} TOO SHORT: ${wordCount} words (min 5): "${ex}"`)
        }
      })
      
      // Check 3: Multiple sentences (period in middle)
      examples.forEach((ex, i) => {
        const periodCount = (ex.match(/\./g) || []).length
        if (periodCount > 1 || (periodCount === 1 && !ex.endsWith('.'))) {
          failures.push(`❌ EXAMPLE ${i+1} MULTIPLE SENTENCES: "${ex}"`)
        }
      })
      
      // If validation fails, throw error to trigger fallback
      if (failures.length > 0) {
        console.error(`❌ VALIDATION FAILED:`)
        failures.forEach(f => console.error(`   ${f}`))
        console.error(`   Attempting to repair examples...`)
        
        // Attempt repair: Fix examples to meet constraints
        try {
          const repairedExamples = await repairMenuExamples(
            examples,
            input.menuContext?.sample_items || [],
            expectedCount,
            openAiKey
          )
          
          if (repairedExamples && repairedExamples.length === expectedCount) {
            console.log(`✅ Repair successful: ${repairedExamples.length} examples now valid`)
            parsed.menu_description_examples = repairedExamples
          } else {
            console.error(`❌ Repair failed, clearing examples`)
            parsed.menu_description_examples = []
          }
        } catch (repairError) {
          console.error(`❌ Repair error:`, repairError)
          parsed.menu_description_examples = []
        }
      } else {
        console.log(`✅ Validation passed: ${examples.length} examples, all meet constraints`)
      }
    }

    // Generate reasoning that explains the voice choices (localized) - ENHANCED V5.2
    const contextFactors = []
    if (input.cityContext?.cultural_context) contextFactors.push(`kulturel kontekst (${input.cityContext.cultural_context.slice(0, 40)}...)`)
    if (audienceContext) contextFactors.push(`målgrupper (${audienceContext})`)
    if (priceTier) contextFactors.push(`prisniveau (${priceTier})`)
    if (input.locationIntelligence?.neighborhood_character) contextFactors.push(`område (${input.locationIntelligence.neighborhood_character})`)
    if (input.voiceArchetype?.archetype_name) contextFactors.push(`arketype: ${input.voiceArchetype.archetype_name}`)
    
    // Use signature themes instead of brand essence
    const signaturePreview = input.menuContext?.signature_themes?.slice(0, 3).join(', ') || 'generel menu'
    
    const reasoning = language === 'da'
      ? `AI-genereret stemmeprofil baseret på omfattende business intelligence.

Kontekst-faktorer analyseret:
${contextFactors.length > 0 ? contextFactors.map(f => `• ${f}`).join('\n') : '• Standard brandidentitet'}

Vigtigste påvirkninger:
• Menu-temaer: ${signaturePreview}
• Tone: ${parsed.formality_level === 'informal' ? 'uformel' : parsed.formality_level === 'formal' ? 'formel' : 'semi-formel'}${parsed.personality_traits && parsed.personality_traits.length > 0 ? ` med "${parsed.personality_traits.slice(0, 3).join(', ')}" personlighed` : ''}
${input.geographicContext?.city_profile?.city ? `• Geografisk tilpasning: ${input.geographicContext.city_profile.city}` : ''}

De ${toneRules.length} voice rules sikrer konsistent stemme tilpasset specifik business-kontekst.`
      : `AI-generated voice profile based on comprehensive business intelligence.

Context factors analyzed:
${contextFactors.length > 0 ? contextFactors.map(f => `• ${f}`).join('\n') : '• Standard brand identity'}

Key influences:
• Menu themes: ${signaturePreview}
• Tone: ${parsed.formality_level}${parsed.personality_traits && parsed.personality_traits.length > 0 ? ` with "${parsed.personality_traits.slice(0, 3).join(', ')}" personality` : ''}
${input.geographicContext?.city_profile?.city ? `• Geographic adaptation: ${input.geographicContext.city_profile.city}` : ''}

The ${toneRules.length} voice rules ensure consistent voice adapted to specific business context.`

    // NEW V5.1: Categorize rules into structural vs style
    const categorized = categorizeRules(parsed.tone_rules || [])
    
    // Generate avoid examples (anti-patterns)
    const avoidExamples = await aiGenerateAvoidExamples(
      {
        ...parsed,
        tone_rules: parsed.tone_rules || [],
        personality_traits: parsed.personality_traits || [],
        formality_level: parsed.formality_level || 'informal',
        sentence_structure: parsed.sentence_structure || 'conversational',
        content_anchors: [],
        voice_confidence: 0.8,
        voice_reasoning: reasoning
      } as V5Voice,
      input.business.business_category,
      openAiKey,
      language
    )
    // Calculate enforcement metadata
    const enforcementLevel: 'strict' | 'moderate' | 'flexible' = 
      categorized.structural.length >= 3 ? 'strict'
      : categorized.structural.length >= 1 ? 'moderate'
      : 'flexible'
    
    // Calculate max sentence length from sentence_structure and tone_rules
    let sentenceLengthMax: number | undefined
    const sentenceStructure = parsed.sentence_structure || 'conversational'
    const toneRulesText = toneRules.join(' ').toLowerCase()
    
    if (sentenceStructure === 'short_declarative' || 
        toneRulesText.includes('kort') || 
        toneRulesText.includes('præcis') ||
        toneRulesText.includes('short')) {
      sentenceLengthMax = 10  // Max 10 words per sentence
    } else if (sentenceStructure === 'conversational') {
      sentenceLengthMax = 15  // Max 15 words per sentence
    }
    
    // NEW V5.3: Analyze menu for origin mention strategy
    const originStrategy = analyzeMenuOriginStrategy(
      input.menuContext?.sample_items || [],
      input.menuContext?.signature_themes || []
    )
    
    console.log(`🌍 Origin strategy analysis:`)
    console.log(`   - Frequency: ${originStrategy.frequency}`)
    console.log(`   - Reasoning: ${originStrategy.reasoning}`)
    console.log(`   - Detected keywords: ${originStrategy.detected_keywords.join(', ')}`)
    
    // AUTO-EXPAND personality traits into operational rules (AI-generated path)
    const expandedRules = expandPersonalityTraitsToRules(
      parsed.personality_traits || [], 
      parsed.formality_level || 'informal'
    )
    console.log(`[Voice AI] Expanding traits ${JSON.stringify(parsed.personality_traits)} → ${expandedRules.length} new rules`)
    if (expandedRules.length > 0) {
      console.log(`[Voice AI] Auto-expanded rules:`, expandedRules)
    }
    
    // Merge base rules + expanded rules
    const allToneRules = [...toneRules, ...expandedRules]
    const recategorized = categorizeRules(allToneRules)
    
    const result: V5Voice = {
      tone_rules: allToneRules,  // Positive rules from tone_do_list + expanded
      structural_rules: recategorized.structural,
      style_rules: recategorized.style,
      personality_traits: parsed.personality_traits || [],
      formality_level: parsed.formality_level || 'informal',
      humor_style: parsed.humor_style || 'none',
      sentence_structure: parsed.sentence_structure || 'conversational',
      emoji_level: parsed.emoji_level || 'minimal',
      content_anchors: [],  // To be populated by caller
      menu_description_examples: parsed.menu_description_examples || [],  // NEW V5.2
      menu_description_metadata: {  // NEW V5.3
        origin_mention_frequency: originStrategy.frequency,
        origin_mention_reasoning: originStrategy.reasoning,
        variation_enforced: true,  // V5.3 prompts explicitly enforce variation
        detected_origin_keywords: originStrategy.detected_keywords
      },
      avoid_examples: avoidExamples,
      voice_confidence: 0.8,
      voice_reasoning: reasoning,
      enforcement_level: enforcementLevel,
      sentence_length_max: sentenceLengthMax
    }

    console.log(`✅ Voice generation complete:`)
    console.log(`   - menu_description_examples: ${result.menu_description_examples?.length || 0} examples`)
    if (result.menu_description_examples && result.menu_description_examples.length > 0) {
      console.log(`   - Examples:`, JSON.stringify(result.menu_description_examples, null, 2))
    }
    
    return result

  } catch (error) {
    console.error('❌ Voice generation failed:', error)
    
    // Fallback: Create basic voice from identity
    return createFallbackVoice(input, language)
  }
}

/**
 * Create fallback voice if AI generation fails
 */
function createFallbackVoice(input: VoiceGenerationInput, language: string = 'da'): V5Voice {
  // Use signature themes or professional persona for traits
  const personality_traits = input.menuContext?.signature_themes?.slice(0, 3).map(t => t.toLowerCase()) || 
                             input.professionalPersona?.expertise_areas?.slice(0, 3) || 
                             ['venlig', 'professionel', 'lokal']
  
  const tone_rules = [
    'Skriv klart og konkret',
    'Tal direkte til gæsten',
    'Fokuser på det væsentlige'
  ]
  
  const categorized = categorizeRules(tone_rules)
  
  return {
    tone_rules,
    structural_rules: categorized.structural,
    style_rules: categorized.style,
    personality_traits,
    formality_level: 'informal',
    humor_style: 'none',
    emoji_level: 'minimal',
    sentence_structure: 'conversational',
    content_anchors: [],
    menu_description_examples: [],  // No examples in fallback
    avoid_examples: [],
    voice_confidence: 0.5,
    voice_reasoning: language === 'da' 
      ? 'Fallback-stemme genereret fra menu-temaer (AI-generering mislykkedes)'
      : 'Fallback voice generated from menu themes (AI generation failed)',
    enforcement_level: 'moderate',
    sentence_length_max: 15
  }
}

// ============================================================================
// NEW V5.1: Rule Categorization (Structural vs Style)
// ============================================================================

/**
 * Categorize tone_rules into structural (enforceable) vs style (guidance)
 * 
 * Structural rules are concrete constraints that can be validated:
 * - Sentence structure (one thought per sentence, no subordinate clauses)
 * - Banned words/patterns
 * - Length constraints
 * - Forbidden constructions
 * 
 * Style rules are subjective guidance:
 * - Tone aspirations ("Be warm", "Sound professional")
 * - Vocabulary preferences
 * - Brand personality expressions
 */
function categorizeRules(rules: string[]): { structural: string[], style: string[] } {
  const structural: string[] = []
  const style: string[] = []
  
  for (const rule of rules) {
    const lowerRule = rule.toLowerCase()
    
    // Structural rule patterns (enforceable constraints)
    if (
      lowerRule.includes('én tanke') ||
      lowerRule.includes('one thought') ||
      lowerRule.includes('stop før') ||
      lowerRule.includes('stop before') ||
      lowerRule.includes('ledsætning') ||
      lowerRule.includes('subordinate clause') ||
      lowerRule.includes('mens') ||
      lowerRule.includes('fordi') ||
      lowerRule.includes('selvom') ||
      lowerRule.match(/\d+-\d+\s*(ord|sætning|word|sentence)/) ||  // Length constraints
      lowerRule.includes('aldrig') ||
      lowerRule.includes('never use') ||
      lowerRule.includes('undgå') && (lowerRule.includes('ord') || lowerRule.includes('word'))
    ) {
      structural.push(rule)
    }
    // Style rule patterns (guidance)
    else if (
      lowerRule.includes('stemme') ||
      lowerRule.includes('tone') ||
      lowerRule.includes('personlighed') ||
      lowerRule.includes('personality') ||
      lowerRule.includes('friendly') ||
      lowerRule.includes('venlig') ||
      lowerRule.includes('professionel') ||
      lowerRule.includes('professional') ||
      lowerRule.includes('kortfattet') ||
      lowerRule.includes('concise') ||
      lowerRule.includes('autentisk') ||
      lowerRule.includes('authentic') ||
      lowerRule.includes('præfer') ||
      lowerRule.includes('prefer')
    ) {
      style.push(rule)
    }
    // Default: If unclear, treat as style rule (safer for enforcement)
    else {
      style.push(rule)
    }
  }
  
  return { structural, style }
}

// ============================================================================
// ANTI-PATTERN EXAMPLES GENERATION
// ============================================================================

/**
 * AI-generate avoid_examples showing what NOT to write
 * 
 * Creates 2-3 anti-pattern examples that demonstrate common voice violations
 */
export async function aiGenerateAvoidExamples(
  voice: V5Voice,
  businessCategory: string,
  openAiKey: string,
  language: string = 'da'
): Promise<string[]> {
  
  const systemPrompt = language === 'da'
    ? `Du er ekspert i at identificere stemme-fejl i restaurant/café sociale medier posts.

Din opgave er at skrive DÅRLIGE eksempler der viser hvad man IKKE skal gøre.

Disse er anti-patterns der demonstrerer:
- Brud på voice rules (f.eks. for lange sætninger hvis voice kræver korte)
- Brochure language hvis voice er direkte/casual
- Formel tone hvis voice er uformel
- Superlatives og overdrivelser

Skriv faktiske caption-eksempler der er FORKERTE for denne stemme.`
    : `You are an expert at identifying voice violations in restaurant/cafe social media posts.

Your task is to write BAD examples showing what NOT to do.

These are anti-patterns that demonstrate:
- Voice rule violations (e.g. long sentences if voice requires short)
- Brochure language if voice is direct/casual
- Formal tone if voice is informal
- Superlatives and exaggerations

Write actual caption examples that are WRONG for this voice.`

  const userPrompt = language === 'da'
    ? `Skriv 2-3 DÅRLIGE caption eksempler for en ${businessCategory}.

=== VOICE RULES DER SKAL BRYDES ===
${voice.tone_rules.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join('\n')}

Personlighed: ${voice.personality_traits.slice(0, 3).join(', ')}
Sætningsstruktur: ${voice.sentence_structure}

=== OPGAVE ===
Skriv 2-3 caption eksempler der GØR DET FORKERT:

1. ${voice.sentence_structure === 'short_declarative' ? 'Lang, svulstig caption med mange klichéer' : 'Caption med forkert tone'}
2. ${voice.formality_level === 'informal' ? 'Alt for formel/stiv caption' : 'Alt for casual caption'}
3. Caption fuld af superlatives og "brochure language"

Hver caption 2-4 sætninger.
Returner JSON objekt: { "avoid_examples": ["caption1", "caption2", "caption3"] }`
    : `Write 2-3 BAD caption examples for a ${businessCategory}.

=== VOICE RULES TO VIOLATE ===
${voice.tone_rules.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join('\n')}

Personality: ${voice.personality_traits.slice(0, 3).join(', ')}
Sentence structure: ${voice.sentence_structure}

=== TASK ===
Write 2-3 caption examples that DO IT WRONG:

1. ${voice.sentence_structure === 'short_declarative' ? 'Long, flowery caption with clichés' : 'Caption with wrong tone'}
2. ${voice.formality_level === 'informal' ? 'Too formal/stiff caption' : 'Too casual caption'}
3. Caption full of superlatives and "brochure language"

Each caption 2-4 sentences.
Return JSON object: { "avoid_examples": ["caption1", "caption2", "caption3"] }`

  console.log(`🎯 Generating avoid examples for ${businessCategory}...`)
  console.log(`   Voice rules: ${voice.tone_rules?.length || 0}, Personality: ${voice.personality_traits?.slice(0, 2).join(', ') || 'none'}`)
  
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
        temperature: 0.5,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ OpenAI API error ${response.status}: ${errorText}`)
      return []
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    console.log(`📝 AI response: ${content.substring(0, 200)}...`)
    const parsed = JSON.parse(content)
    
    // Extract array from various possible JSON formats
    let examples: string[] = []
    if (Array.isArray(parsed)) {
      examples = parsed
      console.log(`   Format: direct array`)
    } else if (parsed.examples && Array.isArray(parsed.examples)) {
      examples = parsed.examples
      console.log(`   Format: {examples: [...]}`)
    } else if (parsed.avoid_examples && Array.isArray(parsed.avoid_examples)) {
      examples = parsed.avoid_examples
      console.log(`   Format: {avoid_examples: [...]}`)
    } else if (parsed.bad_examples && Array.isArray(parsed.bad_examples)) {
      examples = parsed.bad_examples
      console.log(`   Format: {bad_examples: [...]}`)
    } else if (parsed.bad_captions && Array.isArray(parsed.bad_captions)) {
      examples = parsed.bad_captions
      console.log(`   Format: {bad_captions: [...]} (English variant)`)
    } else if (parsed.dårlige_captions && Array.isArray(parsed.dårlige_captions)) {
      examples = parsed.dårlige_captions
      console.log(`   Format: {dårlige_captions: [...]} (Danish)`)
    } else if (parsed.dårlige_eksempler && Array.isArray(parsed.dårlige_eksempler)) {
      examples = parsed.dårlige_eksempler
      console.log(`   Format: {dårlige_eksempler: [...]} (Danish)`)
    } else if (parsed.captions && Array.isArray(parsed.captions)) {
      examples = parsed.captions
      console.log(`   Format: {captions: [...]} (generic wrapper)`)
    } else {
      console.error(`❌ Unexpected JSON format:`, Object.keys(parsed))
      console.error(`   Full response:`, JSON.stringify(parsed).substring(0, 500))
      // Fallback: try to extract first array found
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
          examples = parsed[key]
          console.log(`   🔄 Fallback: using array from field "${key}"`)
          break
        }
      }
      if (examples.length === 0) {
        return []
      }
    }
    
    // Filter and clean
    const cleaned = examples
      .map(e => String(e).trim())
      .filter(e => e.length > 20 && e.length < 600)
      .slice(0, 3)
    
    console.log(`✅ Generated ${cleaned.length} avoid examples:`)
    cleaned.forEach((ex, i) => console.log(`   ${i + 1}. ${ex.substring(0, 80)}...`))
    return cleaned

  } catch (error) {
    console.error('❌ Avoid examples generation failed:', error)
    return []
  }
}

/**
 * Repair invalid menu_description_examples to meet hard constraints
 * 
 * Takes examples that failed validation and fixes them:
 * - Splits if too long
 * - Adds variations if count is wrong
 * - Simplifies multiple sentences into single sentences
 * - PRESERVES voice personality from profile
 */
async function repairMenuExamples(
  invalidExamples: string[],
  sampleItems: any[],
  expectedCount: number,
  openAiKey: string,
  voiceProfile?: Partial<V5Voice>
): Promise<string[]> {
  
  console.log(`🔧 Attempting to repair ${invalidExamples.length} examples (need ${expectedCount})...`)
  
  const personalityContext = voiceProfile ? `
VOICE PERSONALITY (BEVAR dette i reparerede eksempler):
- Personlighed: ${voiceProfile.personality_traits?.join(', ') || 'venlig, direkte'}
- Humor: ${voiceProfile.humor_style || 'none'}
- Formalitet: ${voiceProfile.formality_level || 'semi-formal'}

VARIATION REQUIREMENTS:
- Par 1A+1B skal starte FORSKELLIGT
- Undgå "serveret med" i flere end 1 eksempel
- Vis forskellige tilgange: ingredient-led, technique-led, texture-led
${voiceProfile.humor_style === 'playful' ? '- Brug evt. tankesteg (-) for conversational tone' : ''}
- Match personligheden: hvis "moderne, lokal" → brug moderne vendinger
` : ''

  const repairPrompt = `Du er ekspert i at skrive KORTE, PRÆCISE menu-beskrivelser med personlighed.

OPGAVE: Reparer disse menu-eksempler så de overholder HARD CONSTRAINTS OG viser personlighed.

INVALID EKSEMPLER (skal repareres):
${invalidExamples.map((ex, i) => `${i + 1}. "${ex}"`).join('\n')}

MENU ITEMS (brug ${sampleItems.length} retter):
${sampleItems.map((item, i) => `${i + 1}. ${item.name}${item.description ? ` - ${item.description}` : ''}`).join('\n')}
${personalityContext}
HARD CONSTRAINTS (SKAL overholdes):
✓ Returner PRÆCIS ${expectedCount} beskrivelser (${sampleItems.length} retter × 2 variationer)
✓ Hver beskrivelse SKAL være 5-12 ord (ikke længere!)
✓ Hver beskrivelse SKAL være ÉN sætning (ikke 2+ sætninger med punktum i midten)
✓ Par af samme ret (1A+1B, 2A+2B) SKAL starte forskelligt

REPAIR STRATEGY:
- Hvis beskrivelse > 12 ord: Fjern overflødige ord, hold kun det essentielle (men bevar personlighed!)
- Hvis beskrivelse har 2+ sætninger: Kombiner til én sætning eller vælg den vigtigste
- Hvis mangler variationer: Skriv anden version med forskellig struktur
- Hvis for mange beskrivelser: Vælg de ${expectedCount} bedste

OUTPUT FORMAT:
Returner valid JSON:
{
  "repaired_examples": [
    "Beskrivelse 1 (5-12 ord, én sætning)",
    "Beskrivelse 2 (5-12 ord, én sætning)",
    ...total ${expectedCount} strings
  ]
}

EKSEMPEL PÅ REPAIR:
BEFORE: "Ovnbagt laks serveret med kogte kartofler, sprøde gulerødder og forårsløg. En grillet citron og cremet hollandaise fuldender retten." (24 ord, 2 sætninger)
AFTER: "Ovnbagt laks med hollandaise og citron" (6 ord, 1 sætning) ${voiceProfile?.humor_style === 'playful' ? 'ELLER "Laks fra ovnen - cremet og saftig" (6 ord, playful dash)' : ''}

START REPAIR NU - returner JSON med ${expectedCount} korte beskrivelser med personlighed.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',  // Use mini for fast repair
        messages: [
          { role: 'system', content: 'Du er ekspert i at skrive korte, præcise menu-beskrivelser. Følg altid word count constraints præcist.' },
          { role: 'user', content: repairPrompt }
        ],
        temperature: 0.1,  // Very low temp for precise constraint following
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error(`❌ Repair API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    const parsed = JSON.parse(content)
    
    const repaired = parsed.repaired_examples || []
    
    console.log(`🔧 Repair complete:`)
    console.log(`   - Input: ${invalidExamples.length} invalid examples`)
    console.log(`   - Output: ${repaired.length} repaired examples`)
    
    // Validate repaired examples
    const stillInvalid = repaired.filter((ex: string) => {
      const wordCount = ex.split(/\s+/).length
      const periodCount = (ex.match(/\./g) || []).length
      return wordCount > 12 || wordCount < 5 || (periodCount > 1 || (periodCount === 1 && !ex.endsWith('.')))
    })
    
    if (stillInvalid.length > 0) {
      console.error(`❌ Repair failed: ${stillInvalid.length} examples still invalid`)
      return []
    }
    
    console.log(`✅ All repaired examples valid`)
    repaired.forEach((ex: string, i: number) => {
      const wordCount = ex.split(/\s+/).length
      console.log(`   ${i + 1}. (${wordCount} words) ${ex}`)
    })
    
    return repaired

  } catch (error) {
    console.error('❌ Repair failed:', error)
    return []
  }
}
