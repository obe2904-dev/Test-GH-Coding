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
 * Build user prompt for marketing brief generation
 */
function buildMarketingBriefPrompt(input: MarketingManagerBriefInput, language: string = 'da'): string {
  const parts: string[] = []
  
  parts.push(`Du skal nu skabe et marketing manager role brief for ${input.businessName}.`)
  parts.push(``)
  parts.push(`Dette brief skal fortælle en AI hvordan den skal agere som marketingansvarlig for denne forretning når den skaber Instagram-posts.`)
  parts.push(``)
  
  // Business context (reference to full persona, don't repeat)
  parts.push(`=== VIRKSOMHED ===`)
  parts.push(`Forretningsfakta (fra business_identity_persona):`)
  parts.push(input.businessIdentityPersona.substring(0, 300) + '...')  // First ~300 chars as context
  parts.push(``)
  parts.push(`(Det fulde persona findes i systemet - du behøver ikke gentage alle detaljer)`)
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
  
  // Instructions
  parts.push(`=== OPGAVE ===`)
  parts.push(``)
  parts.push(`Skriv et marketing manager brief (~200 ord) med denne struktur:`)
  parts.push(``)
  parts.push(`Du er marketingansvarlig for ${input.businessName}.`)
  parts.push(``)
  parts.push(`VIRKSOMHED:`)
  parts.push(`[1-2 sætninger - kort reference til business_identity_persona, IKKE fuld gentagelse]`)
  parts.push(``)
  parts.push(`DIN OPGAVE:`)
  parts.push(`[Klar rolledefinition - hvad skal dine posts opnå? Hvem taler du til?]`)
  parts.push(``)
  parts.push(`FREMHÆV ALTID:`)
  parts.push(`[Primære USP'er der skal nævnes ofte - hvad gør jer unikke?]`)
  parts.push(`[Hvis location er primary USP: Nævn det i næsten hvert opslag]`)
  parts.push(``)
  parts.push(`DIN STEMME:`)
  parts.push(`[Syntesér tone rules til klar guidance - hvordan skriver du? Hvad undgår du?]`)
  parts.push(`[Inkludér konkrete eksempler på god og dårlig stemme hvis relevant]`)
  parts.push(``)
  parts.push(`STRATEGI:`)
  parts.push(`[Hvornår nævnes booking? Hvilke CTA'er bruges? Hvordan balanceres footfall/brand?]`)
  if (input.programmes && input.programmes.length > 1) {
    parts.push(`[Vigtigt: Tilpas tone til programme - ${input.programmes.find(p => p.price_positioning.tier === 'premium' || p.price_positioning.tier === 'upscale')?.programme_name || 'Premium programmes'} kræver elevated language, ${input.programmes.find(p => p.price_positioning.tier === 'budget' || p.price_positioning.tier === 'value')?.programme_name || 'Value programmes'} kræver tilgængelighedsfokus]`)
  }
  parts.push(``)
  parts.push(`UNDGÅ ALTID:`)
  parts.push(`[Konkret liste - hvad må du aldrig gøre i dine posts?]`)
  parts.push(``)
  parts.push(``)
  parts.push(`KRITISKE REGLER:`)
  parts.push(`1. Skriv PRÆSKRIPTIVT (fortæl hvad der skal gøres, ikke hvad virksomheden er)`)
  parts.push(`2. Skriv på DANSK (dette læses af dansk AI)`)
  parts.push(`3. Vær SPECIFIK (brug forretningens faktiske data, ikke generiske råd)`)
  parts.push(`4. Hold det HANDLINGSRETTET (fokus på hvad marketing manager skal gøre)`)
  parts.push(`5. Syntesér tone rules (ikke bare list dem) - forklar hvordan de anvendes`)
  parts.push(`6. Referér business_identity_persona kortfattet (gentag ikke hele teksten)`)
  parts.push(`7. ~200 ord total (ikke længere - dette skal være let at parse for AI)`)
  
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
