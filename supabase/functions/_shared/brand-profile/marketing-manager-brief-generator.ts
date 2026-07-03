/**
 * Marketing Manager Brief Generator (Layer 6: Stage 2 Preparation)
 * 
 * Synthesizes all brand intelligence layers into ONE instruction brief
 * that tells Stage 2 AI how to act as the marketing manager for this business.
 * 
 * INPUT: All brand profile layers (business_identity_persona, voice, commercial, audience, USPs)
 * OUTPUT: marketing_manager_brief (~200 words role instruction in business language)
 * 
 * PURPOSE:
 * - Replaces scattered 15+ field lookup in Stage 2 (get-quick-suggestions, generate-weekly-plan)
 * - Provides clear, prescriptive role definition for post generation AI
 * - Single source of truth for "how to market this business"
 * 
 * MULTI-LANGUAGE SUPPORT:
 * - Danish (da): "Du er marketingansvarlig for..."
 * - Swedish (sv): "Du är marknadsansvarig för..."
 * - Norwegian (no): "Du er markedsansvarlig for..."
 * - German (de): "Sie sind der Marketingleiter für..."
 * - English (en): "You are the marketing manager for..."
 * 
 * @version 1.0.0
 * @date June 21, 2026
 */

import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts'

export interface MarketingManagerBriefInput {
  businessIdentityPersona: string  // From Layer 0 - business facts
  voiceProfile: {
    tone_rules: string[]
    personality_traits: string[]
    formality_level: string
    humor_style?: string
    sentence_structure?: string
  }
  voiceGuardrails?: {  // NEW V5.9: Forbidden words and patterns for quality enforcement
    never_say?: Array<string>
    generic_marketing?: Array<string>
    superlatives?: Array<string>
    avoid_patterns?: {
      strip_from_output?: {
        ai_tells?: string[]
        superlatives?: string[]
        generic_marketing?: string[]
      }
    }
  }
  commercialMode: string  // 'footfall', 'brand', 'balanced'
  primaryUSP?: string  // From Layer 0 USP extraction
  contentStrategy?: {
    goal_blend?: Record<string, number>
    brand_anchors?: string[]
    loyalty_hooks?: string[]
  }
  bookingStrategy?: {
    trigger_configuration?: any
  }
  locationStrategy?: {  // NEW V5.7: Location strategy from Layer 0
    positioning_angles: string[]
    content_triggers: string[]
    competitive_gap: string | null
    reachable_demographics: string[]
  }
  programmes?: Array<{  // NEW V5.3: Per-programme pricing for tone calibration
    programme_name: string
    programme_type: string
    time_windows: string[]
    price_positioning: {
      tier: 'budget' | 'value' | 'moderate' | 'upscale' | 'premium'
      avg: number | null
      min: number | null
      max: number | null
    }
  }>
  selectedPlatforms?: string[]  // NEW V5.8: Platform guidance (from profiles.selected_platforms)
  servicePeriods?: string[]     // NEW V5.8: Active service periods (from programmes or menu_results_v2)
  businessName: string
  businessCategory: string
  language?: string  // ISO 639-1 code (da, sv, no, de, en) - defaults to 'da'
}

export interface MarketingManagerBrief {
  marketing_manager_brief: string  // ~200 words Danish
  metadata: {
    word_count: number
    generated_at: string
    source_layers: string[]
  }
}

/**
 * Generate Marketing Manager Brief
 * 
 * System: Business DNA Analyst (multi-language)
 * Task: Synthesize brand intelligence → marketing role instruction
 */
export async function generateMarketingManagerBrief(
  input: MarketingManagerBriefInput,
  openaiClient: OpenAI,
  requestId?: string
): Promise<MarketingManagerBrief> {
  
  const logPrefix = requestId ? `[${requestId}] ` : ''
  const lang = input.language || 'da'
  console.log(`${logPrefix}📋 Generating Marketing Manager Brief (${lang})...`)
  console.log(`${logPrefix}   V5.8 Data: platforms=${input.selectedPlatforms?.length || 0}, servicePeriods=${input.servicePeriods?.length || 0}`)
  if (input.selectedPlatforms && input.selectedPlatforms.length > 0) {
    console.log(`${logPrefix}   Platforms: ${input.selectedPlatforms.join(', ')}`)
  }
  if (input.servicePeriods && input.servicePeriods.length > 0) {
    console.log(`${logPrefix}   Service Periods: ${input.servicePeriods.join(', ')}`)
  }
  
  // Build system prompt (Business DNA Analyst in target language)
  const systemPrompt = getBusinessDNAAnalystPrompt(lang)
  
  // Build user prompt with all context
  const userPrompt = buildMarketingBriefPrompt(input, lang)
  
  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',  // Fast, cost-effective for synthesis task
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,  // Low temp for consistent, professional output
      max_tokens: 500,   // ~200 words output + buffer
    })
    
    const rawBrief = completion.choices[0]?.message?.content?.trim()
    
    if (!rawBrief) {
      throw new Error('No response from OpenAI')
    }
    
    // Validate output
    const wordCount = rawBrief.split(/\s+/).length
    
    if (wordCount < 100) {
      console.warn(`${logPrefix}⚠️  Brief too short (${wordCount} words) - may be incomplete`)
    }
    
    if (wordCount > 300) {
      console.warn(`${logPrefix}⚠️  Brief too long (${wordCount} words) - truncating`)
    }
    
    console.log(`${logPrefix}✅ Generated marketing manager brief (${wordCount} words)`)
    console.log(`${logPrefix}   Preview: ${rawBrief.substring(0, 100)}...`)
    
    // NEW V5.9: Validate brief against voice guardrails
    if (input.voiceGuardrails) {
      console.log(`${logPrefix}🔍 Validating marketing brief against voice guardrails...`)
      const validation = await validateMarketingBrief(rawBrief, input.voiceGuardrails, openaiClient, lang, requestId)
      
      if (!validation.valid) {
        console.warn(`${logPrefix}⚠️  Marketing brief has ${validation.violations.length} guardrail violations:`)
        validation.violations.forEach((v, idx) => {
          console.warn(`${logPrefix}     ${idx + 1}. ${v}`)
        })
        
        // If auto-fixes were suggested, log them
        if (validation.suggested_fixes) {
          console.log(`${logPrefix}💡 Suggested fixes: ${validation.suggested_fixes}`)
        }
        
        // For now, just log - in future we could auto-regenerate or apply fixes
        console.log(`${logPrefix}   Proceeding with brief despite violations (validation is advisory for now)`)
      } else {
        console.log(`${logPrefix}✅ Marketing brief passed all guardrail checks`)
      }
    }
    
    return {
      marketing_manager_brief: rawBrief,
      metadata: {
        word_count: wordCount,
        generated_at: new Date().toISOString(),
        source_layers: ['layer_0_intelligence', 'voice_profile', 'commercial_orientation', 'content_strategy']
      }
    }
    
  } catch (error) {
    console.error(`${logPrefix}❌ Marketing Manager Brief generation failed:`, error)
    throw error
  }
}

/**
 * Business DNA Analyst System Prompts (Multi-Language)
 * 
 * This is the central AI persona used across ALL brand profile generation.
 * Consistent role definition ensures coherent outputs across all layers.
 */
const BUSINESS_DNA_ANALYST_PROMPTS: Record<string, string> = {
  da: `Du er Business DNA Analytiker specialiseret i danske restauranter og caféer.

Din ekspertise:
- Analysere forretningsdata (menuer, lokation, åbningstider, gæster) for at udtrække strategiske indsigter
- Forstå dansk madkultur og gæsteadfærd på tværs af forskellige koncepter og målgrupper
- Identificere kommercielle muligheder og definere præcise audience segments
- Definere brand voice der matcher forretningens unikke karakter og positionering
- Skabe handlingsrettet marketing guidance der kan bruges direkte i content creation

Din tilgang:
- Professionel, analytisk, datadrevet - baserer alle konklusioner på konkrete beviser
- Fokuserer på hvad der gør denne specifikke forretning unik (ikke generiske best practices)
- Tænker som en erfaren marketing konsulent der bygger et omfattende brand brief
- Udtrykker alt på dansk for at undgå sprogforurening i outputs

Dit output:
- Strategiske brand intelligence layers der informerer marketing beslutninger
- Koncis, handlingsrettet marketing brief (~200 ord) der kan bruges direkte i content generation
- Klar struktur: VIRKSOMHED, DIN OPGAVE, FREMHÆV, STEMME, STRATEGI, UNDGÅ`,

  sv: `Du är Business DNA-analytiker specialiserad på svenska restauranger och kaféer.

Din expertis:
- Analysera företagsdata (menyer, lokalisering, öppettider, gäster) för att extrahera strategiska insikter
- Förstå svensk matkultur och gästbeteende över olika koncept och målgrupper
- Identifiera kommersiella möjligheter och definiera precisa målgruppssegment
- Definiera brand voice som matchar företagets unika karaktär och positionering
- Skapa handlingsinriktad marknadsföringsvägledning som kan användas direkt i innehållsskapande

Din approach:
- Professionell, analytisk, datadriven - baserar alla slutsatser på konkreta bevis
- Fokuserar på vad som gör denna specifika verksamhet unik (inte generiska best practices)
- Tänker som en erfaren marknadskonsult som bygger ett omfattande brand brief
- Uttrycker allt på svenska för att undvika språkföroreningar i outputs

Ditt output:
- Strategiska brand intelligence-lager som informerar marknadsföringsbeslut
- Koncist, handlingsinriktat marknadsföringsbrev (~200 ord) som kan användas direkt i innehållsgenerering
- Tydlig struktur: FÖRETAG, DIN UPPGIFT, FRAMHÄV, RÖST, STRATEGI, UNDVIK`,

  no: `Du er Business DNA-analytiker spesialisert på norske restauranter og kaféer.

Din ekspertise:
- Analysere forretningsdata (menyer, lokasjon, åpningstider, gjester) for å trekke ut strategiske innsikter
- Forstå norsk matkultur og gjesteadferd på tvers av ulike konsepter og målgrupper
- Identifisere kommersielle muligheter og definere presise målgruppesegmenter
- Definere brand voice som matcher virksomhetens unike karakter og posisjonering
- Skape handlingsrettet marketingveiledning som kan brukes direkte i innholdskreasjon

Din tilnærming:
- Profesjonell, analytisk, datadrevet - baserer alle konklusjoner på konkrete bevis
- Fokuserer på hva som gjør denne spesifikke virksomheten unik (ikke generiske best practices)
- Tenker som en erfaren marketingkonsulent som bygger et omfattende brand brief
- Uttrykker alt på norsk for å unngå språkforurensning i outputs

Ditt output:
- Strategiske brand intelligence-lag som informerer marketingbeslutninger
- Konsis, handlingsrettet marketingbrief (~200 ord) som kan brukes direkte i innholdsgenerering
- Klar struktur: VIRKSOMHET, DIN OPPGAVE, FREMHEV, STEMME, STRATEGI, UNNGÅ`,

  de: `Sie sind Business-DNA-Analyst spezialisiert auf deutsche Restaurants und Cafés.

Ihre Expertise:
- Geschäftsdaten analysieren (Menüs, Standort, Öffnungszeiten, Gäste), um strategische Erkenntnisse zu gewinnen
- Deutsche Esskultur und Gästeverhalten über verschiedene Konzepte und Zielgruppen hinweg verstehen
- Kommerzielle Chancen identifizieren und präzise Zielgruppensegmente definieren
- Brand Voice definieren, die den einzigartigen Charakter und die Positionierung des Unternehmens widerspiegelt
- Handlungsorientierte Marketing-Anleitung erstellen, die direkt in der Content-Erstellung verwendet werden kann

Ihr Ansatz:
- Professionell, analytisch, datengetrieben - alle Schlussfolgerungen auf konkreten Beweisen basierend
- Fokus auf das, was dieses spezifische Unternehmen einzigartig macht (keine generischen Best Practices)
- Denken wie ein erfahrener Marketingberater, der ein umfassendes Brand Brief erstellt
- Alles auf Deutsch ausdrücken, um Sprachverschmutzung in Outputs zu vermeiden

Ihr Output:
- Strategische Brand-Intelligence-Ebenen, die Marketingentscheidungen informieren
- Prägnantes, handlungsorientiertes Marketing-Briefing (~200 Wörter) für direkte Verwendung in Content-Generierung
- Klare Struktur: UNTERNEHMEN, IHRE AUFGABE, HERVORHEBEN, STIMME, STRATEGIE, VERMEIDEN`,

  en: `You are a Business DNA Analyst specialized in restaurants and cafés.

Your expertise:
- Analyze business data (menus, location, hours, guests) to extract strategic insights
- Understand food culture and guest behavior across different concepts and target groups
- Identify commercial opportunities and define precise audience segments
- Define brand voice that matches the business's unique character and positioning
- Create actionable marketing guidance that can be used directly in content creation

Your approach:
- Professional, analytical, data-driven - base all conclusions on concrete evidence
- Focus on what makes this specific business unique (not generic best practices)
- Think like an experienced marketing consultant building a comprehensive brand brief
- Express everything in the target language to avoid linguistic pollution in outputs

Your output:
- Strategic brand intelligence layers that inform marketing decisions
- Concise, actionable marketing brief (~200 words) for direct use in content generation
- Clear structure: BUSINESS, YOUR ROLE, HIGHLIGHT, VOICE, STRATEGY, AVOID`
}

/**
 * Get Business DNA Analyst prompt in target language
 */
function getBusinessDNAAnalystPrompt(language: string = 'da'): string {
  return BUSINESS_DNA_ANALYST_PROMPTS[language] || BUSINESS_DNA_ANALYST_PROMPTS['en']
}

/**
 * Legacy export for backwards compatibility
 */
export const BUSINESS_DNA_ANALYST_SYSTEM_PROMPT = BUSINESS_DNA_ANALYST_PROMPTS.da

/**
 * Validate Marketing Brief Against Voice Guardrails (V5.9)
 * 
 * Uses lightweight AI call to check if generated brief violates forbidden words/patterns.
 * Returns structured validation result with specific violations and suggested fixes.
 * 
 * @param brief - The generated marketing manager brief text
 * @param guardrails - Voice guardrails with forbidden words/patterns
 * @param openaiClient - OpenAI client for validation call
 * @param language - Language code for validation prompt
 * @param requestId - Optional request ID for logging
 * @returns Validation result with violations list and fix suggestions
 */
async function validateMarketingBrief(
  brief: string,
  guardrails: NonNullable<MarketingManagerBriefInput['voiceGuardrails']>,
  openaiClient: OpenAI,
  language: string = 'da',
  requestId?: string
): Promise<{
  valid: boolean
  violations: string[]
  suggested_fixes?: string
}> {
  const logPrefix = requestId ? `[${requestId}] ` : ''
  
  // Collect all forbidden words/patterns
  const forbiddenWords: string[] = []
  if (guardrails.never_say) forbiddenWords.push(...guardrails.never_say)
  if (guardrails.generic_marketing) forbiddenWords.push(...guardrails.generic_marketing)
  if (guardrails.superlatives) forbiddenWords.push(...guardrails.superlatives)
  if (guardrails.avoid_patterns?.strip_from_output?.superlatives) {
    forbiddenWords.push(...guardrails.avoid_patterns.strip_from_output.superlatives)
  }
  if (guardrails.avoid_patterns?.strip_from_output?.generic_marketing) {
    forbiddenWords.push(...guardrails.avoid_patterns.strip_from_output.generic_marketing)
  }
  
  const uniqueForbidden = [...new Set(forbiddenWords)]
  
  // Build validation prompt
  const validationPrompt = `Du skal validere om følgende marketing manager brief overholder voice guardrails OG strukturkrav.

MARKETING BRIEF TIL VALIDERING:
"""
${brief}
"""

VOICE GUARDRAILS - FORBUDTE ORD OG FRASER:
${uniqueForbidden.slice(0, 50).join(', ')}${uniqueForbidden.length > 50 ? ` ...og ${uniqueForbidden.length - 50} flere` : ''}

STRUKTURKRAV:
1. OBLIGATORISK FØRSTE LINJE: Skal starte med "Du er marketingansvarlig for [business]"
2. OBLIGATORISKE SEKTIONER: **VIRKSOMHED**, **DIN OPGAVE**, **FREMHÆV ALTID**, **DIN STEMME**, **STRATEGI**, **UNDGÅ ALTID**
3. INGEN goal_blend percentages i teksten (fx "67%" eller "33%" - dette er slot allocation data, ikke guidance)
4. INGEN generiske placeholder-eksempler (fx "Fisk grillet over åben ild" - brug kun business-specifikke eksempler)
5. ALLE engelske termer skal oversættes til dansk (fx "city centre"→"i centrum", "waterfront"→"ved vandet")
6. STRATEGISK niveau - ALDRIG taktisk (ingen specifikke åbningstider, programnavne)
7. Hvis flere serviceperioder: Behandl dem lige (ikke fokus på kun én)
8. Hvis flere programmer: Nævn primære målgrupper (ikke niche-segmenter)

KRITISK REGEL: Selv "replacement" ord fra guardrails (højre side af →) er FORBUDT.
Eksempel: "lækker → saftig" betyder at BÅDE "lækker" OG "saftig" er forbudt.
Brug KUN konkrete beskrivelser uden generiske adjektiver.

TJEK EFTER:
1. ❌ Mangler brief'et åbningslinjen "Du er marketingansvarlig for..."?
2. ❌ Indeholder brief'et goal_blend percentages (67%, 33%, osv.)?
3. ❌ Indeholder brief'et engelske termer ("city centre", "waterfront", "shopping district") i stedet for dansk?
4. ❌ Indeholder brief'et taktiske detaljer (specifikke åbningstider som "09:00-17:30", programnavne, fokus på kun én serviceperiode)?
5. ❌ Nævner brief'et niche-segmenter fra ét program (fx "arbejdende gæster") i stedet for primære målgrupper?
6. ❌ Bruger brief'et nogen af de forbudte ord (både venstre OG højre side af →)?
7. ❌ Bruger eksempler i brief'et generiske adjektiver som "saftig", "frisk", "god", "lækker"?
8. ❌ Bruger eksempler generiske placeholder-tekster ("Fisk grillet over åben ild" når business er noget andet)?
9. ❌ Starter eksempler med imperativer som "Kom forbi", "Oplev", "Tag", "Nyd"?
10. ❌ Mangler brief'et explicit guidance: "Brug ALDRIG generiske adjektiver - kun konkrete beskrivelser"?
11. ❌ Mangler brief'et UNDGÅ ALTID sektion?

GODE EKSEMPLER (til suggested_fixes):
- "Pariserbøf lavet med dansk oksekød, serveret med hjemmelavet remoulade" (konkret, business-specifik)
- "Burger med sprøde fritter og karamelliserede løg" (konkret tilberedning)
- "Kaffe brygget på bønner fra [lokal risteri]" (oprindelse/teknik)
- "Fremhæv central beliggenhed ved åen for både stemningsindhold og bekvemmelighed" (strategisk niveau - ikke taktisk)
- "Appellerer til lokale beboere, turister og shoppere" (primære målgrupper - ikke niche-segmenter)

DÅRLIGE EKSEMPLER (skal flagges):
- "Saftig steak" (saftig er generisk adjektiv)
- "Frisk fisk grillet over åben ild" (både generisk adjektiv OG placeholder-tekst)
- "Lækker burger" (lækker er forbudt)
- "Balancer fokus mellem at drive footfall (67%) og styrke brandet (33%)" (goal_blend percentages)
- "Brug 'central location in ved åen'" (blanding af engelsk og dansk - skal være rent dansk)
- "waterfront proximity" (engelsk term - skal være "ved vandet" eller "ved åen")
- "frokostprogrammet fra kl. 09:00-17:30, der appellerer til arbejdende gæster" (taktiske detaljer - specifikke tider + niche segment fra ét program)
- "Fremhæv brunchmenu" (programnavn - for taktisk)

SVAR I DETTE FORMAT:
{
  "valid": true/false,
  "violations": [
    "Mangler obligatorisk åbningslinje 'Du er marketingansvarlig for...'",
    "Brief indeholder goal_blend percentages (67%, 33%) - disse skal IKKE i output",
    "Brief indeholder engelske termer 'city centre' og 'waterfront proximity' - skal oversættes til dansk",
    "Brief indeholder taktiske detaljer 'frokostprogrammet fra kl. 09:00-17:30' - hold det strategisk",
    "Brief nævner niche-segment 'arbejdende gæster' fra ét program - brug primære målgrupper",
    "Brief eksempel bruger generisk adjektiv 'saftig' (forbudt selvom det er replacement for 'lækker')",
    "Eksempel bruger placeholder 'Fisk grillet over åben ild' - brug business-specifikke retter"
  ],
  "suggested_fixes": "Tilføj åbningslinje først. Fjern percentages fra STRATEGI-sektion. Oversæt 'city centre' til 'i centrum' eller 'central beliggenhed', 'waterfront proximity' til 'ved vandet' eller 'ved åen'. Fjern specifikke åbningstider og programfokus - hold det strategisk på tværs af alle serviceperioder. Brug primære målgrupper (lokale, turister) ikke niche-segmenter (arbejdende gæster). Udskift 'saftig bøf' med konkret beskrivelse fra faktisk menu: 'Pariserbøf lavet med dansk oksekød'. Brug faktiske retter fra business."
}

SVAR NUR MED JSON - INGEN ANDEN TEKST.`

  try {
    const validation = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du er en brand voice quality assurance specialist. Du validerer marketing briefs og returnerer struktureret JSON.'
        },
        { role: 'user', content: validationPrompt }
      ],
      temperature: 0.1,  // Very low for consistent validation
      max_tokens: 400,
      response_format: { type: 'json_object' }
    })
    
    const resultText = validation.choices[0]?.message?.content?.trim()
    if (!resultText) {
      console.warn(`${logPrefix}⚠️  Validation call returned empty response`)
      return { valid: true, violations: [] }  // Assume valid if validation fails
    }
    
    const result = JSON.parse(resultText)
    
    return {
      valid: result.valid === true,
      violations: Array.isArray(result.violations) ? result.violations : [],
      suggested_fixes: result.suggested_fixes || undefined
    }
    
  } catch (error) {
    console.error(`${logPrefix}❌ Marketing brief validation failed:`, error)
    // Don't block generation if validation fails - just log and continue
    return { valid: true, violations: [] }
  }
}

/**
 * Build user prompt for marketing brief generation
 */
function buildMarketingBriefPrompt(input: MarketingManagerBriefInput, language: string = 'da'): string {
  const parts: string[] = []
  
  parts.push(`Du skal nu skabe et marketing manager role brief for ${input.businessName}.`)
  parts.push(``)
  parts.push(`Dette brief skal fortælle en AI hvordan den skal agere som marketingansvarlig for denne forretning når den skaber Instagram-posts.`)
  parts.push(``)
  
  // Business context (provide FULL persona for proper synthesis)
  parts.push(`=== VIRKSOMHED ===`)
  parts.push(`Forretningsfakta (business_identity_persona - SYNTESÉR dette til 1-2 sætninger i VIRKSOMHED-sektionen):`)
  parts.push(``)
  parts.push(input.businessIdentityPersona)  // Full persona for context
  parts.push(``)
  parts.push(`VIGTIGT: Brug den GASTRONOMISKE BESKRIVELSE fra persona (hvis til stede) - opfind ikke en ny.`)
  parts.push(`VIGTIGT: Reference kun essensen - gentag ikke hele persona-teksten i brief'et.`)
  parts.push(``)
  
  // Voice profile
  parts.push(`=== STEMME-PROFIL ===`)
  parts.push(`Tone rules (${input.voiceProfile.tone_rules.length} regler):`)
  input.voiceProfile.tone_rules.slice(0, 5).forEach(rule => {
    parts.push(`- ${rule}`)
  })
  if (input.voiceProfile.tone_rules.length > 5) {
    parts.push(`... og ${input.voiceProfile.tone_rules.length - 5} flere`)
  }
  parts.push(``)
  parts.push(`Personlighed: ${input.voiceProfile.personality_traits.join(', ')}`)
  parts.push(`Formalitet: ${input.voiceProfile.formality_level}`)
  if (input.voiceProfile.humor_style) {
    parts.push(`Humor: ${input.voiceProfile.humor_style}`)
  }
  parts.push(``)
  
  // Commercial mode
  parts.push(`=== KOMMERCIEL STRATEGI ===`)
  parts.push(`Baseline mode: ${input.commercialMode}`)
  if (input.contentStrategy?.goal_blend) {
    parts.push(`Goal blend: ${JSON.stringify(input.contentStrategy.goal_blend)}`)
  }
  parts.push(``)
  
  // NEW V5.3: Per-programme pricing (if available)
  if (input.programmes && input.programmes.length > 0) {
    const programmesWithPricing = input.programmes.filter(p => p.price_positioning && p.price_positioning.avg != null)
    if (programmesWithPricing.length > 0) {
      parts.push(`=== PRIS-POSITIONERING (PER PROGRAM) ===`)
      programmesWithPricing.forEach(prog => {
        const tierLabels: Record<string, string> = {
          budget: 'Budget',
          value: 'Værdi',
          moderate: 'Moderat',
          upscale: 'Upscale',
          premium: 'Premium'
        }
        const tierLabel = tierLabels[prog.price_positioning.tier] || prog.price_positioning.tier
        parts.push(`- ${prog.programme_name} (${prog.time_windows.join(', ')}): ${tierLabel} (${prog.price_positioning.avg} kr gns, ${prog.price_positioning.min}-${prog.price_positioning.max} kr)`)
      })
      parts.push(``)
      parts.push(`Tone guidance: Tilpas sprog til prisniveau - premium programmes skal have elevated tone, value programmes skal fremhæve tilgængelighed.`)
      parts.push(``)
    }
  }
  
  // Primary USP
  if (input.primaryUSP) {
    parts.push(`=== PRIMÆR USP ===`)
    parts.push(input.primaryUSP)
    parts.push(``)
  }
  
  // Booking strategy
  if (input.bookingStrategy?.trigger_configuration) {
    parts.push(`=== BOOKING STRATEGI ===`)
    parts.push(`Triggers konfigureret: Ja`)
    parts.push(``)
  }
  
  // NEW V5.7: Location strategy
  if (input.locationStrategy) {
    parts.push(`=== LOKATIONSPOSITIONERING ===`)
    parts.push(`Målgrupper der KAN nås: ${input.locationStrategy.reachable_demographics.join(', ')}`)
    if (input.locationStrategy.positioning_angles.length > 0) {
      parts.push(`Positioneringsvinkler:`)
      input.locationStrategy.positioning_angles.forEach(angle => {
        parts.push(`- ${angle}`)
      })
    }
    if (input.locationStrategy.content_triggers.length > 0) {
      parts.push(`Content triggers:`)
      input.locationStrategy.content_triggers.forEach(trigger => {
        parts.push(`- ${trigger}`)
      })
    }
    if (input.locationStrategy.competitive_gap) {
      parts.push(`Konkurrencemæssig fordel: ${input.locationStrategy.competitive_gap}`)
    }
    parts.push(``)
    parts.push(`VIGTIGT: Brug disse positioneringsvinkler i dit brief. Opfind ikke modsatrettede positioner.`)
    parts.push(``)
  }
  
  // NEW V5.8: Platform context
  if (input.selectedPlatforms && input.selectedPlatforms.length > 0) {
    parts.push(`=== PLATFORME ===`)
    parts.push(`Aktive kanaler: ${input.selectedPlatforms.join(', ')}`)
    parts.push(``)
    
    if (input.selectedPlatforms.length > 1) {
      parts.push(`VIGTIGT: Samme caption-tekst bruges på alle platforme.`)
      parts.push(`Kun hashtags og booking-CTA format varierer.`)
      parts.push(`Skriv derfor universelt - ikke platform-specifikt.`)
      parts.push(`Fokus på klarhed og substans frem for dogmatisk korthed.`)
    } else if (input.selectedPlatforms[0] === 'instagram') {
      parts.push(`Platform: Kun Instagram. Visuelt understøttende tekst.`)
    } else if (input.selectedPlatforms[0] === 'facebook') {
      parts.push(`Platform: Kun Facebook. Community-orienteret tone tilladt.`)
    }
    parts.push(``)
  }
  
  // NEW V5.8: Service period context
  if (input.servicePeriods && input.servicePeriods.length > 1) {
    parts.push(`=== AKTIVE SERVICEPERIODER ===`)
    parts.push(`Perioder: ${input.servicePeriods.join(', ')}`)
    parts.push(``)
    parts.push(`OVERVEJ: Tone-forskelle mellem perioder (fx casual frokost, elevated aften).`)
    parts.push(``)
  }
  
  // Instructions
  parts.push(`=== OPGAVE ===`)
  parts.push(``)
  parts.push(`Skriv et marketing manager brief (~200 ord) med PRÆCIS denne struktur:`)
  parts.push(``)
  parts.push(`OUTPUT FORMAT (følg NØJAGTIGT):`)
  parts.push(`────────────────────────────────────────`)
  parts.push(`Du er marketingansvarlig for ${input.businessName}.`)
  parts.push(``)
  parts.push(`**VIRKSOMHED:**`)
  parts.push(`[Skriv 1-2 sætninger som synteserer business_identity_persona. Brug EKSAKT den gastronomiske beskrivelse fra persona - opfind ikke en ny. Eksempel format: "${input.businessName} tilbyder [hvad de serverer] med fokus på [deres unikke tilgang]. Stedet [atmosphære/målgruppe]."`)
  parts.push(``)
  parts.push(`**DIN OPGAVE:**`)
  parts.push(`[Beskriv target audience konkret (fx "lokale beboere, turister og shoppere"). Forklar hvad posts skal opnå (drive footfall/styrke brand). Hvis positioning_angles viser central location, nævn det naturligt.]`)
  parts.push(``)
  parts.push(`**FREMHÆV ALTID:**`)
  parts.push(`[List primære USP'er baseret på positioning_angles og location_gap. Hvis der er culinary technique data, skriv: "Fremhæv tilberedningsmetoder og råvarer konkret".]`)
  parts.push(`[VIGTIGT: Hold det STRATEGISK - IKKE taktisk. Undgå ALTID: specifikke åbningstider (fx "09:00-17:30") og programnavne.]`)
  if (input.servicePeriods && input.servicePeriods.length > 1) {
    parts.push(`[Denne business har ${input.servicePeriods.length} serviceperioder (${input.servicePeriods.map(sp => sp.service_period_name).join(', ')}): Behandl dem LIGE - fokusér ikke kun på én periode.]`)
  }
  if (input.programmes && input.programmes.length > 1) {
    parts.push(`[Denne business har ${input.programmes.length} programmer: Nævn primære målgrupper på tværs - ikke niche-segmenter fra ét program.]`)
  }
  if (input.locationStrategy?.positioning_angles && input.locationStrategy.positioning_angles.length > 0) {
    parts.push(`[VIGTIGT: Brug ALLE disse positioning angles: ${input.locationStrategy.positioning_angles.join(', ')}.]`)
    parts.push(`[OVERSÆT til dansk: "city centre" → "i centrum", "waterfront" → "ved vandet/ved åen", "shopping district" → "i shoppingområdet", "tourist area" → "i turistområdet", osv.]`)
    parts.push(`[Forklar hvordan hver angle kan bruges naturligt i posts. Reference når kontekst tillader det - ikke tvunget i HVERT opslag.]`)
    parts.push(`[Eksempel: "city centre" kan bruges som "central beliggenhed" eller "midt i byen", "waterfront" som "ved åen" eller "med udsigt til vandet".]`)
  }
  parts.push(``)
  parts.push(`**DIN STEMME:**`)
  parts.push(`[Syntesér tone rules til actionable guidance. Prioritér KLARHED. Forklar hvordan tone rules anvendes i praksis.]`)
  parts.push(`[OBLIGATORISK: Skriv explicit: "Brug konkrete beskrivelser af tilberedning og oprindelse - ALDRIG generiske adjektiver."]`)
  parts.push(`[Hvis business har menu data: Brug FAKTISKE retter som eksempler fra business_identity_persona. OPFIND IKKE generiske eksempler som "Fisk grillet over åben ild".]`)
  parts.push(`[Hvis INGEN menu data: Brug format-eksempel: "Ret tilberedt med [ingrediens], serveret med [tilbehør]" - men brug IKKE konkrete retter du ikke kender.]`)
  
  // NEW V5.9: Voice guardrails - inject forbidden words to prevent AI from using them in brief examples
  if (input.voiceGuardrails) {
    const forbiddenWords: string[] = []
    if (input.voiceGuardrails.never_say && input.voiceGuardrails.never_say.length > 0) {
      forbiddenWords.push(...input.voiceGuardrails.never_say)
    }
    if (input.voiceGuardrails.generic_marketing && input.voiceGuardrails.generic_marketing.length > 0) {
      forbiddenWords.push(...input.voiceGuardrails.generic_marketing)
    }
    if (input.voiceGuardrails.superlatives && input.voiceGuardrails.superlatives.length > 0) {
      forbiddenWords.push(...input.voiceGuardrails.superlatives)
    }
    if (input.voiceGuardrails.avoid_patterns?.strip_from_output?.superlatives && input.voiceGuardrails.avoid_patterns.strip_from_output.superlatives.length > 0) {
      forbiddenWords.push(...input.voiceGuardrails.avoid_patterns.strip_from_output.superlatives)
    }
    if (input.voiceGuardrails.avoid_patterns?.strip_from_output?.generic_marketing && input.voiceGuardrails.avoid_patterns.strip_from_output.generic_marketing.length > 0) {
      forbiddenWords.push(...input.voiceGuardrails.avoid_patterns.strip_from_output.generic_marketing)
    }
    
    if (forbiddenWords.length > 0) {
      const uniqueForbidden = [...new Set(forbiddenWords)]
      // Extract BOTH sides of → mappings as forbidden
      const allForbiddenWords: string[] = []
      uniqueForbidden.forEach(rule => {
        if (rule.includes('→')) {
          const [left, right] = rule.split('→').map(s => s.trim())
          allForbiddenWords.push(left)
          // Don't add right side if it's "(slet)" or similar
          if (right && !right.includes('(') && right.length > 1) {
            allForbiddenWords.push(right)
          }
        } else {
          allForbiddenWords.push(rule)
        }
      })
      
      const finalForbidden = [...new Set(allForbiddenWords)]
      parts.push(``)
      parts.push(`[⚠️ KRITISK: UNDGÅ DISSE ORD i dine eksempler og beskrivelser:]`)
      parts.push(`[Forbudt (BÅDE sider af →): ${finalForbidden.slice(0, 20).join(', ')}${finalForbidden.length > 20 ? `, ...og ${finalForbidden.length - 20} flere` : ''}]`)
      parts.push(`[INGEN generiske adjektiver - kun handling + oprindelse + teknik]`)
    }
  }
  
  if (input.selectedPlatforms && input.selectedPlatforms.length > 1) {
    parts.push(`[Multi-platform: Samme tekst bruges begge steder - skriv universelt, substansrigt, scanbart]`)
  }
  if (input.servicePeriods && input.servicePeriods.length > 1) {
    parts.push(`[Service period tone: Frokost=casual/tilgængelig, Aften=elevated/sofistikeret]`)
  }
  parts.push(``)
  parts.push(`**STRATEGI:**`)
  parts.push(`[Forklar HVORNÅR booking nævnes (fx "ved aftenmenuen" eller "til weekend brunch"). Beskriv CTA-strategi. VIGTIGT: Skriv IKKE goal blend percentages - de er kun for slot allocation, ikke caption guidance.]`)
  if (input.programmes && input.programmes.length > 1) {
    parts.push(`[Programme-tone: ${input.programmes.find(p => p.price_positioning.tier === 'premium' || p.price_positioning.tier === 'upscale')?.programme_name || 'Premium programmes'} kræver elevated language, ${input.programmes.find(p => p.price_positioning.tier === 'budget' || p.price_positioning.tier === 'value')?.programme_name || 'Value programmes'} kræver tilgængelighedsfokus]`)
  }
  parts.push(``)
  parts.push(`**UNDGÅ ALTID:**`)
  parts.push(`[OBLIGATORISK SEKTION - skriv explicit forbudte ord/mønstre:]`)
  parts.push(`[Line 1: "Brug ALDRIG generiske adjektiver som lækker, saftig, god, frisk, hyggelig, perfekt."]`)
  parts.push(`[Line 2: "Start ALDRIG med imperativer: Kom forbi, Oplev, Tag, Nyd, Prøv."]`)
  parts.push(`[Line 3: "Brug kun konkrete beskrivelser med handling, teknik og oprindelse."]`)
  if (input.servicePeriods && input.servicePeriods.length > 1) {
    parts.push(`[Line 4 (hvis flere serviceperioder): Tone-forskelle mellem perioder - specificer hvad]`)
  }
  if (input.locationStrategy?.competitive_gap && input.locationStrategy.competitive_gap.includes('premium')) {
    parts.push(`[Premium positioning: Undgå budget-framing, discount-fokus]`)
  }
  parts.push(`────────────────────────────────────────`)
  parts.push(``)
  parts.push(``)
  parts.push(`KRITISKE REGLER FOR DIG (ikke output - instruktioner til GPT):`)
  parts.push(`1. OBLIGATORISK FØRSTE LINJE: "Du er marketingansvarlig for ${input.businessName}." (må IKKE springes over)`)
  parts.push(`2. Skriv PRÆSKRIPTIVT (fortæl hvad der skal gøres, ikke hvad virksomheden er)`)
  parts.push(`3. Skriv på DANSK (dette læses af dansk AI) - oversæt ALLE engelske termer til dansk`)
  parts.push(`4. Vær SPECIFIK (brug forretningens faktiske data, ikke generiske råd)`)
  parts.push(`5. Hold det HANDLINGSRETTET (fokus på hvad marketing manager skal gøre)`)
  parts.push(`6. Hold det STRATEGISK - IKKE taktisk (ALDRIG specifikke åbningstider eller programnavne)`)
  parts.push(`7. Syntesér tone rules (ikke bare list dem) - forklar hvordan de anvendes)`)
  parts.push(`8. Referér business_identity_persona kortfattet (gentag ikke hele teksten, syntesér kun essensen)`)
  parts.push(`9. ~200 ord total (ikke længere - dette skal være let at parse for AI)`)
  parts.push(`10. SKRIV IKKE goal_blend percentages i output - de er kun til slot allocation`)
  parts.push(`11. BRUG FAKTISKE retter/data fra business hvis tilgængelige - OPFIND IKKE generiske eksempler`)
  parts.push(`12. OVERSÆT positioning_angles til dansk: "city centre"→"i centrum", "waterfront"→"ved vandet", "shopping district"→"i shoppingområdet"`)
  if (input.servicePeriods && input.servicePeriods.length > 1) {
    parts.push(`13. Business har ${input.servicePeriods.length} serviceperioder - behandl dem LIGE (nævn ikke kun én periode med specifikke tider/segmenter)`)
  }
  if (input.programmes && input.programmes.length > 1) {
    parts.push(`14. Business har ${input.programmes.length} programmer - nævn primære målgrupper (ikke niche-segmenter fra ét program)`)
  }
  parts.push(`9. SKRIV IKKE goal_blend percentages i output - de er kun til slot allocation`)
  parts.push(`10. BRU G FAKTISKE retter/data fra business hvis tilgængelige - OPFIND IKKE generiske eksempler`)
  
  return parts.join('\n')
}

/**
 * Extract simple commercial mode from baseline_goal_split
 */
export function extractCommercialMode(goalSplit: Record<string, number>): string {
  const sorted = Object.entries(goalSplit).sort(([, a], [, b]) => b - a)
  const primary = sorted[0][0]
  
  if (primary === 'drive_footfall') return 'footfall'
  if (primary === 'strengthen_brand') return 'brand'
  return 'balanced'
}
