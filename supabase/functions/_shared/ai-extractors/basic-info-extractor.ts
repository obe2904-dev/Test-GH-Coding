/**
 * Basic Business Information Extractor
 * 
 * Extracts simple business identification data using OpenAI.
 * This includes: business name, type, description, and logo URL.
 * 
 * Language-aware: Detects and preserves original language (Danish, Swedish, Norwegian, German)
 * 
 * UPDATED: Now supports hybrid businessType structure for cafes that are also wine bars, etc.
 */

import { AI_TASKS, CONTENT_LIMITS, getLanguageCode, type LanguageCode } from '../ai-config.ts'
import type { BusinessType, HybridBusinessType } from '../business-type-helpers.ts'

export interface BasicBusinessInfo {
  businessName: string | null
  businessType: BusinessType | null  // Updated: Now supports both string and hybrid structure
  description: string | null
  logoUrl: string | null
}

// Language-specific system prompts for better output quality
const LANGUAGE_PROMPTS: Record<string, { system: string; descriptionInstruction: string }> = {
  da: {
    system: `Du er en virksomhedsinformationsekstraktor. Returner KUN gyldig JSON.
KRITISK: Skriv ALTID beskrivelsen på DANSK. Oversæt ALDRIG til engelsk. Bevar originale danske vendinger og udtryk.`,
    descriptionInstruction: 'Skriv en kort beskrivelse på 1-2 sætninger på DANSK der fanger hvad der gør denne virksomhed unik. Bevar danske udtryk.'
  },
  no: {
    system: `Du er en virksomhetsinformasjonsekstraktor. Returner KUN gyldig JSON.
KRITISK: Skriv ALLTID beskrivelsen på NORSK. Oversett ALDRI til engelsk. Bevar originale norske vendinger og uttrykk.`,
    descriptionInstruction: 'Skriv en kort beskrivelse på 1-2 setninger på NORSK som fanger hva som gjør denne virksomheten unik. Bevar norske uttrykk.'
  },
  sv: {
    system: `Du är en företagsinformationsextraktor. Returnera ENDAST giltig JSON.
KRITISKT: Skriv ALLTID beskrivningen på SVENSKA. Översätt ALDRIG till engelska. Bevara svenska uttryck och fraser.`,
    descriptionInstruction: 'Skriv en kort beskrivning på 1-2 meningar på SVENSKA som fångar vad som gör detta företag unikt. Bevara svenska uttryck.'
  },
  de: {
    system: `Sie sind ein Geschäftsinformationsextraktor. Geben Sie NUR gültiges JSON zurück.
KRITISCH: Schreiben Sie die Beschreibung IMMER auf DEUTSCH. Übersetzen Sie NIEMALS ins Englische. Bewahren Sie deutsche Ausdrücke und Redewendungen.`,
    descriptionInstruction: 'Schreiben Sie eine kurze Beschreibung in 1-2 Sätzen auf DEUTSCH, die erfasst, was dieses Unternehmen einzigartig macht. Bewahren Sie deutsche Ausdrücke.'
  },
  en: {
    system: `You are a business information extractor. Return only valid JSON.`,
    descriptionInstruction: 'Write a concise 1-2 sentence description capturing what makes this business unique.'
  }
}

export async function extractBasicInfo(
  content: string,
  metadata: { title?: string; description?: string },
  extractedLogoUrl: string | null,
  hints: { businessName?: string; businessType?: string; homepageAboutCandidate?: string; languageHint?: string | null },
  openaiApiKey: string
): Promise<BasicBusinessInfo> {
  // Detect language from the about text or content and return code
  const detectLanguage = (text: string): { code: LanguageCode; name: string } => {
    // Check for Danish characters and common Danish words
    const danishIndicators = /[æøå]|(?:\b(?:og|af|til|på|det|en|at|har|som|ikke|kan|fra|eller|være|også)\b)/i
    // Check for Swedish patterns (ä, ö without ø, and Swedish words)
    const swedishIndicators = /[äö]|(?:\b(?:och|är|av|till|för|det|en|att|har|som|inte|kan|från|eller|vara|också)\b)/i
    // Check for German patterns
    const germanIndicators = /[äöüß]|(?:\b(?:und|ist|von|mit|für|auf|die|das|ein|dass|haben|als|nicht|können|aus|oder|sein|auch)\b)/i
    // Check for Norwegian (similar to Danish but without æ often, uses å)
    const norwegianIndicators = /(?:\b(?:og|er|av|til|med|for|på|det|en|at|har|som|ikke|kan|fra|eller|være|også|etter)\b)/i
    
    // Priority order: Danish (æøå), Swedish (äö without ø), German (äöüß), Norwegian, English
    if (text.match(/[æø]/) || (danishIndicators.test(text) && text.match(/[å]/))) {
      return { code: 'da', name: 'Danish' }
    }
    if (text.match(/[äö]/) && !text.match(/[æø]/) && swedishIndicators.test(text)) {
      return { code: 'sv', name: 'Swedish' }
    }
    if (text.match(/[ß]/) || (germanIndicators.test(text) && text.match(/[äöü]/))) {
      return { code: 'de', name: 'German' }
    }
    if (norwegianIndicators.test(text) && text.match(/[å]/) && !text.match(/[æø]/)) {
      return { code: 'no', name: 'Norwegian' }
    }
    return { code: 'en', name: 'English' }
  }
  
  // PRIORITY 1: Use HTML lang attribute if provided (most reliable)
  let langCode: LanguageCode = 'en'
  let langName: string = 'English'
  
  const LANG_NAMES: Record<LanguageCode, string> = {
    da: 'Danish', no: 'Norwegian', sv: 'Swedish', de: 'German', en: 'English'
  }
  
  if (hints.languageHint) {
    const mappedCode = getLanguageCode(hints.languageHint, 'en')
    langCode = mappedCode
    langName = LANG_NAMES[langCode]
    console.log(`🌍 Using HTML lang attribute: ${langName} (${langCode})`)
  } else {
    // PRIORITY 2: Detect from content
    const sourceText = hints.homepageAboutCandidate || content
    const detected = detectLanguage(sourceText)
    langCode = detected.code
    langName = detected.name
    console.log(`🌍 Detected language from content: ${langName} (${langCode})`)
  }
  
  const langPrompts = LANGUAGE_PROMPTS[langCode] || LANGUAGE_PROMPTS.en
  
  // Build the prompt with pre-extracted about text if available
  const aboutSection = hints.homepageAboutCandidate 
    ? `\n\nPRE-EXTRACTED ABOUT TEXT (use this as the primary source for description - do not invent):\n"${hints.homepageAboutCandidate}"\n`
    : ''
  
  const prompt = `Extract basic business information from this website content.

${hints.businessName ? `Hint - Business name: ${hints.businessName}\n` : ''}${hints.businessType ? `Hint - Business type: ${hints.businessType}\n` : ''}${metadata.title ? `Page title: ${metadata.title}\n` : ''}${metadata.description ? `Meta description: ${metadata.description}\n` : ''}${aboutSection}
Content preview (first 3000 chars):
${content.slice(0, 3000)}

Extract:
1. businessName: The exact business/restaurant name as shown on the website
2. businessType: HYBRID STRUCTURE for businesses with multiple types (e.g., cafe+wine bar)
   - If single type: { "primary": "cafe", "secondary": [], "hybridLabel": "cafe" }
   - If hybrid: { "primary": "cafe", "secondary": ["vinbar", "cocktailbar"], "hybridLabel": "Kaffebar & Vinbar", "cuisineType": "Dansk", "conceptTags": ["specialty-coffee"] }
   - Primary types: restaurant, cafe, bar, hotel, bakery, coffee_shop, retail, beauty, fitness, services, other
3. description: ${hints.homepageAboutCandidate 
    ? `${langPrompts.descriptionInstruction} Use the PRE-EXTRACTED ABOUT TEXT above. Do NOT invent details not in the source text.`
    : langPrompts.descriptionInstruction}
4. logoUrl: Include if an obvious logo image URL is visible in the content (or use the pre-extracted one)

Return JSON:
{
  "businessName": "exact name",
  "businessType": {
    "primary": "main type",
    "secondary": ["additional", "types"],
    "hybridLabel": "Display label for hybrids",
    "cuisineType": "cuisine if restaurant/cafe",
    "conceptTags": ["relevant", "tags"]
  },
  "description": "brief description in ${langName}",
  "logoUrl": "logo URL or null"
}`

  const taskConfig = AI_TASKS.basicInfo
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: taskConfig.model,
        messages: [
          { role: 'system', content: langPrompts.system },
          { role: 'user', content: prompt }
        ],
        temperature: taskConfig.temperature,
        max_tokens: taskConfig.maxTokens,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error('❌ Basic info extraction failed:', response.status)
      return {
        businessName: hints.businessName || metadata.title || null,
        businessType: (hints.businessType as any) || null,
        description: metadata.description || null,
        logoUrl: extractedLogoUrl
      }
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    // Backwards compatibility: Handle both old string format and new object format
    // If AI returns old format (string), convert to new format
    if (result.businessType && typeof result.businessType === 'string') {
      const oldType = result.businessType
      result.businessType = {
        primary: oldType,
        secondary: [],
        hybridLabel: oldType
      }
      console.log(`🔄 Converted legacy businessType string to hybrid format: ${oldType}`)
    }

    // Validate hybrid format structure
    if (result.businessType && typeof result.businessType === 'object') {
      // Ensure required fields exist
      if (!result.businessType.primary) {
        console.warn('⚠️ Invalid businessType object - missing primary field')
        result.businessType = hints.businessType || null
      } else {
        // Normalize structure
        result.businessType = {
          primary: result.businessType.primary,
          secondary: Array.isArray(result.businessType.secondary) ? result.businessType.secondary : [],
          hybridLabel: result.businessType.hybridLabel || result.businessType.primary,
          cuisineType: result.businessType.cuisineType || undefined,
          conceptTags: Array.isArray(result.businessType.conceptTags) ? result.businessType.conceptTags : undefined
        }
      }
    }

    // Use pre-extracted logo if AI didn't find one
    if (!result.logoUrl && extractedLogoUrl) {
      result.logoUrl = extractedLogoUrl
    }

    const typeLabel = typeof result.businessType === 'string' 
      ? result.businessType 
      : result.businessType?.hybridLabel || result.businessType?.primary || 'unknown'
    
    console.log('✅ Basic info extracted:', result.businessName, '-', typeLabel)
    return result

  } catch (error) {
    console.error('❌ Error in basic info extraction:', error)
    return {
      businessName: hints.businessName || metadata.title || null,
      businessType: (hints.businessType as any) || null,
      description: metadata.description || null,
      logoUrl: extractedLogoUrl
    }
  }
}
