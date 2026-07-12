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
  localLocationReference?: string | null  // NEW: Extracted local place name (e.g., "ved åen")
}

// Language-specific system prompts for better output quality
const LANGUAGE_PROMPTS: Record<string, { system: string; descriptionInstruction: string }> = {
  da: {
    system: `Du er en virksomhedsinformationsekstraktor. Returner KUN gyldig JSON.
KRITISK: Udtræk ALTID beskrivelsen på DANSK. Oversæt ALDRIG til engelsk. Bevar originale danske vendinger og udtryk.
FORBUD MOD OPDIGTNING: Opfind ALDRIG information. Udtræk KUN fakta der rent faktisk findes på hjemmesiden.`,
    descriptionInstruction: 'Udtræk en kort beskrivelse på 2-4 sætninger på DANSK baseret UDELUKKENDE på information der faktisk står på hjemmesiden: hvad stedet er, hvad det serverer, hvilken stemning/oplevelse det tilbyder, og hvor det ligger hvis det er tydeligt. Brug de præcise udtryk fra hjemmesiden. Opfind IKKE information. Hvis information mangler, skriv NULL.'
  },
  no: {
    system: `Du er en virksomhetsinformasjonsekstraktor. Returner KUN gyldig JSON.
KRITISK: Trekk ut beskrivelsen ALLTID på NORSK. Oversett ALDRI til engelsk. Bevar originale norske vendinger og uttrykk.
FORBUD MOT OPPFINNING: Finn ALDRI opp informasjon. Trekk KUN ut fakta som faktisk finnes på nettstedet.`,
    descriptionInstruction: 'Trekk ut en kort beskrivelse på 2-4 setninger på NORSK basert UTELUKKENDE på informasjon som faktisk står på nettstedet: hva stedet er, hva det serverer, hvilken stemning/opplevelse det tilbyr, og hvor det ligger hvis det er tydelig. Bruk de presise uttrykkene fra nettstedet. IKKE finn opp informasjon. Hvis informasjon mangler, skriv NULL.'
  },
  sv: {
    system: `Du är en företagsinformationsextraktor. Returnera ENDAST giltig JSON.
KRITISKT: Extrahera beskrivningen ALLTID på SVENSKA. Översätt ALDRIG till engelska. Bevara svenska uttryck och fraser.
FÖRBUD MOT PÅHITT: Hitta ALDRIG på information. Extrahera ENDAST fakta som faktiskt finns på webbplatsen.`,
    descriptionInstruction: 'Extrahera en kort beskrivning på 2-4 meningar på SVENSKA baserat UTESLUTANDE på information som faktiskt finns på webbplatsen: vad platsen är, vad den serverar, vilken känsla/upplevelse den erbjuder, och var den ligger om det framgår tydligt. Använd de exakta uttrycken från webbplatsen. Hitta INTE på information. Om information saknas, skriv NULL.'
  },
  de: {
    system: `Sie sind ein Geschäftsinformationsextraktor. Geben Sie NUR gültiges JSON zurück.
KRITISCH: Extrahieren Sie die Beschreibung IMMER auf DEUTSCH. Übersetzen Sie NIEMALS ins Englische. Bewahren Sie deutsche Ausdrücke und Redewendungen.
VERBOT VON ERFINDUNG: Erfinden Sie NIEMALS Informationen. Extrahieren Sie NUR Fakten, die tatsächlich auf der Website vorhanden sind.`,
    descriptionInstruction: 'Extrahieren Sie eine kurze Beschreibung in 2-4 Sätzen auf DEUTSCH, basierend AUSSCHLIESSLICH auf Informationen, die tatsächlich auf der Website stehen: was der Ort ist, was er serviert, welche Atmosphäre/Erfahrung er bietet und wo er liegt, falls das klar erkennbar ist. Verwenden Sie die genauen Ausdrücke von der Website. Erfinden Sie KEINE Informationen. Wenn Informationen fehlen, schreiben Sie NULL.'
  },
  en: {
    system: `You are a business information extractor. Return only valid JSON.
CRITICAL: NEVER invent information. Extract ONLY facts that actually exist on the website.`,
    descriptionInstruction: 'Extract a concise 2-4 sentence description based EXCLUSIVELY on information actually found on the website: what the place is, what it serves, the vibe/experience it offers, and where it is located if that is clear. Use the exact phrases from the website. DO NOT invent information. If information is missing, write NULL.'
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
  
  // Build the prompt with pre-extracted homepage summary if available
  const aboutSection = hints.homepageAboutCandidate 
    ? `\n\nPRE-EXTRACTED HOMEPAGE SUMMARY (summarize the facts below - do not invent):\n"${hints.homepageAboutCandidate}"\n`
    : ''
  
  const prompt = `Extract basic business information from this website content.

⚠️ CRITICAL INSTRUCTION: Extract ONLY factual information that actually appears on the website. Do NOT invent, assume, or hallucinate any details. If information is not present, return null for that field.

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
  ? `${langPrompts.descriptionInstruction} The PRE-EXTRACTED HOMEPAGE SUMMARY above contains key facts - extract and combine them with other visible information from the website. CRITICAL: Only include information that actually appears on the website. Do NOT invent or hallucinate details.`
    : langPrompts.descriptionInstruction}
4. logoUrl: Include if an obvious logo image URL is visible in the content (or use the pre-extracted one)
5. localLocationReference: Extract EXACT local place name phrase if business describes its location (e.g., "ved åen", "i Nyhavn", "ved stranden"). ONLY extract if explicitly mentioned. Return null if not found. Look for patterns: "ved [landmark]", "i [area]", "på [street/area]", "beliggende [where]".

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
  "logoUrl": "logo URL or null",
  "localLocationReference": "exact local phrase or null"
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
