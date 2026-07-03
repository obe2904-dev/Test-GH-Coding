/**
 * Menu Signal Extractor (Gemini 2.5 Flash)
 * 
 * Lightweight text-based menu signal extraction for Free tier
 * Returns plain text description (not structured JSON like paid menu extraction)
 * 
 * Purpose:
 * - Quick menu overview without full OCR/parsing
 * - Free tier: Single API call vs expensive full extraction
 * - Paid tier: Quick preview before detailed extraction
 * 
 * Usage:
 * const signal = await extractMenuSignal(htmlContent, { businessName, businessType, languageHint })
 */

export interface Programme {
  role: string          // AI-detected label, e.g. "brunch", "aftensmenu", "tapas + bar"
  timeContext: string | null  // e.g. "til kl. 14", "17:30-21:30", "ons-lør"
  items: string[]       // 2-5 representative menu items for this programme
}

export interface MenuSignalResult {
  hasMenu: boolean
  placeSynopsis: string | null
  menuDescription: string | null
  menuCategories: string[] | null
  signatureItems: string[] | null
  programmes: Programme[] | null  // Structured operational programmes (brunch, frokost, aften, bar…)
  rawExtract: string | null
}

export interface MenuSignalContext {
  businessName?: string | null
  businessType?: string | null
  languageHint?: string | null
}

/**
 * Extract menu signal from website content using Gemini 2.5 Flash
 * 
 * @param content - Raw HTML content or cleaned text from website
 * @param context - Business context for better extraction
 * @returns MenuSignalResult with menu information or null signals
 */
export async function extractMenuSignal(
  content: string,
  context: MenuSignalContext
): Promise<MenuSignalResult> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  
  if (!geminiApiKey) {
    console.warn('⚠️ GEMINI_API_KEY not found - skipping menu signal extraction')
    return createEmptyResult()
  }

  if (!content || content.trim().length < 100) {
    console.log('⏭️ Content too short for menu signal extraction')
    return createEmptyResult()
  }

  const language = context.languageHint || 'da'
  const businessType = context.businessType || 'restaurant'
  const businessName = context.businessName || 'Unknown'

  // Construct language-aware prompt
  const promptLanguageMap: Record<string, string> = {
    'da': 'dansk',
    'no': 'norsk',
    'sv': 'svensk',
    'de': 'tysk',
    'en': 'engelsk'
  }
  const languageName = promptLanguageMap[language] || 'dansk'

  const contentToSend = content.slice(0, 15000)
  
  const prompt = `Analyser dette website-indhold og udtræk menu-information.

Virksomhed: ${businessName}
Type: ${businessType}
Sprog: ${languageName}

Indhold:
${contentToSend}

Instruktioner:
1. Afgør om der er menu-indhold på websitet (JA/NEJ)
2. Hvis JA, udtræk:
   - Kort overordnet menubeskrivelse (2-3 sætninger)
   - Kort stedssynopsis (1-2 sætninger): hvad stedet er, hvad det tilbyder, og den overordnede stemning
   - Hovedkategorier på menuen (liste)
   - 3-5 signatur-/fremhævede retter
   - Separate driftsprogrammer (fx brunch, frokost, aften, bar, drinks, tapas)
     Hvert program på sin egen linje i formatet: [navn]|[tidsramme eller "ingen"]|[vare1, vare2, vare3]
     Maksimum 5 programmer. Brug kun programmer der er tydeligt adskilt i tid, format eller sortiment.

Formatér dit svar som ren tekst med tydelige sektioner:
HAS_MENU: [JA/NEJ]
PLACE_SYNOPSIS: [1-2 sætninger]
DESCRIPTION: [tekst]
CATEGORIES: [kommasepareret liste]
SIGNATURE_ITEMS: [kommasepareret liste]
PROGRAMMES:
[programnavn]|[tidsramme]|[vare1, vare2, vare3]
[programnavn]|[tidsramme]|[vare1, vare2]

Hvis NEJ til menu, svar kun: "HAS_MENU: NEJ"`

  try {
    console.log(`🔍 Extracting menu signal with Gemini 2.5 Flash (sending ${contentToSend.length} of ${content.length} chars)...`)
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2500,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!text) {
      console.warn('⚠️ Empty response from Gemini')
      return createEmptyResult()
    }

    console.log(`✅ Gemini response received (${text.length} chars)`)

    // Parse response
    const result = parseGeminiResponse(text)
    
    console.log(`📊 Menu signal extraction result:`, {
      hasMenu: result.hasMenu,
      categoriesCount: result.menuCategories?.length || 0,
      itemsCount: result.signatureItems?.length || 0,
      rawResponse: text.substring(0, 500) // Log first 500 chars of raw response
    })

    return result

  } catch (error) {
    console.error('❌ Menu signal extraction failed:', error)
    return createEmptyResult()
  }
}

/**
 * Parse Gemini's text response into structured format
 */
function parseGeminiResponse(text: string): MenuSignalResult {
  // Check if menu exists
  const hasMenuMatch = text.match(/HAS_MENU:\s*(JA|NEJ|YES|NO)/i)
  const hasMenuText = hasMenuMatch?.[1]?.toUpperCase()
  const hasMenu = hasMenuText === 'JA' || hasMenuText === 'YES'

  if (!hasMenu) {
    return createEmptyResult()
  }

  const synopsisMatch = text.match(/PLACE_SYNOPSIS:\s*(.+?)(?=\n[A-Z_]+:|$)/s)
  const placeSynopsis = synopsisMatch?.[1]?.trim().replace(/\n+/g, ' ') || null

  // Extract description (multi-line, stops at next section)
  const descMatch = text.match(/DESCRIPTION:\s*(.+?)(?=\n[A-Z_]+:|$)/s)
  const menuDescription = descMatch?.[1]?.trim().replace(/\n+/g, ' ') || null

  // Extract categories (comma-separated)
  const categoriesMatch = text.match(/CATEGORIES:\s*(.+?)(?=\n[A-Z_]+:|$)/s)
  const menuCategories = categoriesMatch?.[1]
    ?.split(/[,\n]/)
    .map(c => c.trim())
    .filter(c => c.length > 0 && c.length < 100) || null

  // Extract signature items (comma-separated)
  const itemsMatch = text.match(/SIGNATURE_ITEMS:\s*(.+?)(?=\n[A-Z_]+:|$)/s)
  const signatureItems = itemsMatch?.[1]
    ?.split(/[,\n]/)
    .map(i => i.trim())
    .filter(i => i.length > 0 && i.length < 150) || null

  // Extract programmes (pipe-separated lines)
  let programmes: Programme[] | null = null
  const programmesMatch = text.match(/PROGRAMMES:\s*\n([\s\S]+?)(?=\n[A-Z_]+:|$)/s)
  if (programmesMatch) {
    const lines = programmesMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && l.includes('|'))
    const parsed: Programme[] = lines.map(line => {
      const parts = line.split('|')
      const role = (parts[0] || '').trim()
      const timeContext = (parts[1] || '').trim().replace(/^ingen$/i, '') || null
      const items = (parts[2] || '')
        .split(',')
        .map(i => i.trim())
        .filter(i => i.length > 0 && i.length < 80)
      return { role, timeContext, items }
    }).filter(p => p.role.length > 0)
    if (parsed.length > 0) programmes = parsed
  }

  return {
    hasMenu: true,
    placeSynopsis,
    menuDescription,
    menuCategories: menuCategories && menuCategories.length > 0 ? menuCategories : null,
    signatureItems: signatureItems && signatureItems.length > 0 ? signatureItems : null,
    programmes,
    rawExtract: text
  }
}

/**
 * Create empty result structure
 */
function createEmptyResult(): MenuSignalResult {
  return {
    hasMenu: false,
    placeSynopsis: null,
    menuDescription: null,
    menuCategories: null,
    signatureItems: null,
    programmes: null,
    rawExtract: null
  }
}
