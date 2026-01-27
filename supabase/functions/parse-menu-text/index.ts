// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Import language configuration system
// @ts-ignore - Deno modules
import { getLanguageConfig } from './languages/index.ts'
// @ts-ignore - Deno modules
import type { LanguageConfig } from './types.ts'

// @ts-ignore - Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Escape regex special characters in a string for safe use in RegExp
 * Only escape actual regex metacharacters, not spaces
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse extracted menu text using OpenAI GPT-4o and create menu_extractions record
 */
async function parseMenuWithGPT4o(extractedText: string, menuName: string, languageConfig: LanguageConfig): Promise<any> {
  console.log(`🧠 Parsing menu "${menuName}" with GPT-4o...`)
  
  // PRE-PROCESS: Apply OCR corrections BEFORE sending to GPT
  const correctedText = preprocessTextWithOCRCorrections(extractedText, languageConfig)
  
  console.log('📄 CORRECTED TEXT SENT TO GPT:')
  console.log('---START CORRECTED---')
  console.log(correctedText)
  console.log('---END CORRECTED---')
  console.log(`📊 Total length: ${correctedText.length} characters`)
  
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable not set')
  }

  const prompt = `You are parsing a DANISH restaurant menu. All text is in Danish.

CRITICAL LANGUAGE RULES:
- This is a DANISH menu - expect Danish language text
- PRESERVE all Danish special characters: æ, ø, å
- PRESERVE all accents and diacritics
- DO NOT "correct" Danish characters to ASCII (e.g., "æ" is NOT "a" or "e")
- Common Danish ingredients: hvidløg, smør, fløde, grønkål, blåmuslinger, etc.

EXTRACTION RULES:
1. ONLY extract menu items that are EXPLICITLY WRITTEN in the content
2. DO NOT make up menu items
3. DO NOT infer or guess dishes
4. Preserve EXACT dish names as written - DO NOT modify or "correct" them
5. Preserve EXACT category names (e.g., "Forret", "Hovedret", "Dessert")

CRITICAL MULTI-LINE RULE - MOST IMPORTANT:
**Danish menus often have item names on one line and descriptions on following lines.**
- An item NAME is typically SHORT (1-3 words, sometimes with "og" or commas)
- A DESCRIPTION comes AFTER the name, on the same line or following lines
- ALWAYS GROUP consecutive lines together until you hit a blank line or category header
- DO NOT treat each line as a separate item

EXAMPLES OF CORRECT GROUPING:
✓ CORRECT:
  name: "Koldrøget laks"
  description: "dildmayo, syltede sennepsfrø, rødbede, karse og croutons"

✓ CORRECT (multi-line):
  name: "Langtidsstegt gris"
  description: "æblekompot, hasselnødder og sauce på stegt kylling og æblemost"

✗ WRONG:
  name: "Koldrøget laks" (without the description that follows)
  name: "dildmayo, syltede sennepsfrø..." (treating description as item)

PARSING ALGORITHM:
1. Find category headers (usually CAPITALIZED or in bold)
2. For each non-category line: is it an item name or continuation?
3. Item names are typically SHORT phrases (max 5 words usually)
4. If a line looks like ingredients/description (contains commas, "og", "med", etc), GROUP it with the previous item as description
5. Continue until blank line or next category

Return ONLY valid JSON structure:
{
  "categories": [
    {
      "name": "exact category name from text",
      "timeRange": "time if present, else null",
      "items": [
        {"name": "exact item name (SHORT)", "description": "ALL following details, ingredients, etc."}
      ]
    }
  ],
  "dietaryOptions": ["only if explicitly mentioned"],
  "takeaway": true/false/null
}

Content to analyze:
${correctedText}

Extract menu items by GROUPING multi-line items correctly. Include FULL descriptions with all ingredients and details.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are a precise menu extraction expert. ONLY extract menu items that are explicitly written in the provided content. DO NOT invent, guess, or infer menu items. If no clear menu is found, return empty arrays. Return only valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.0, // Maximum precision
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`❌ OpenAI API error ${response.status}:`, errorData)
      throw new Error(`OpenAI API failed: ${response.status}`)
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    console.log('✅ GPT-4o extraction successful')
    console.log('🤖 AI returned menu structure:', result.categories?.length, 'categories')
    console.log('🔍 GPT RESPONSE (raw):')
    console.log(JSON.stringify(result, null, 2))

    // Validate and clean menu structure
    if (Array.isArray(result.categories)) {
      result.categories = result.categories.filter(
        (cat: any) => cat && cat.name && Array.isArray(cat.items) && cat.items.length > 0
      )
    }

    return result
  } catch (error) {
    console.error('Error parsing menu:', error)
    throw error
  }
}

/**
 * Pre-process extracted text with OCR corrections BEFORE parsing
 */
function preprocessTextWithOCRCorrections(text: string, languageConfig: LanguageConfig): string {
  console.log('🔧 Pre-processing text with OCR corrections...')
  console.log(`📊 Applying ${Object.keys(languageConfig.ocrCorrections).length} OCR corrections...`)
  console.log('📄 RAW TEXT FROM TIKA (BEFORE CORRECTIONS):')
  console.log('---START RAW---')
  console.log(text)
  console.log('---END RAW---')
  
  let result = text
  let totalReplacements = 0
  
  // Apply corrections in order of specificity (longer patterns first)
  const sortedKeys = Object.keys(languageConfig.ocrCorrections).sort(
    (a, b) => b.length - a.length
  )
  
  for (const error of sortedKeys) {
    const correction = languageConfig.ocrCorrections[error]
    const escapedError = escapeRegex(error)
    
    // Try multiple matching strategies from most specific to most general
    const patterns = [
      // 1. Standalone word: space+word+space, start+word+space, space+word+end
      new RegExp(`(^|\\s)${escapedError}($|\\s)`, 'gi'),
      // 2. Word before punctuation: space+word+punct
      new RegExp(`(^|\\s)${escapedError}([,.:;!?\\-])`, 'gi'),
      // 3. Exact substring match (last resort, catches typos in middle of words)
      new RegExp(escapedError, 'gi'),
    ]
    
    for (const regex of patterns) {
      const before = result
      result = result.replace(regex, (match, ...args) => {
        // When pattern has capture groups: (match, prefix, suffix, offset, string)
        // When pattern has no capture groups: (match, offset, string)
        // Check if first arg is a string (prefix) or number (offset)
        
        if (typeof args[0] === 'number') {
          // Pattern 3: exact match (no capture groups)
          return correction
        }
        
        // Patterns 1 & 2: have capture groups (prefix, suffix)
        const prefix = args[0]
        const suffix = args[1]
        
        // Preserve casing of the error term
        let correctedValue = correction
        if (error[0] === error[0].toUpperCase() && correction.length > 0) {
          correctedValue = correction.charAt(0).toUpperCase() + correction.slice(1)
        }
        
        // Reconstruct with surrounding characters
        return prefix + correctedValue + suffix
      })
      
      if (result !== before) {
        totalReplacements++
        console.log(`  ✓ Fixed "${error}" → "${correction}"`)
        break // Move to next error once we've made a fix
      }
    }
  }
  
  console.log(`✅ Pre-processing complete - ${totalReplacements} patterns matched`)
  return result
}

/**
 * Apply OCR corrections to individual text fields
 */
function applyOCRCorrections(text: string, languageConfig: LanguageConfig): string {
  if (!text) return text

  let result = text
  
  // Apply corrections in order of specificity (longer patterns first)
  const sortedKeys = Object.keys(languageConfig.ocrCorrections).sort(
    (a, b) => b.length - a.length
  )
  
  for (const error of sortedKeys) {
    const correction = languageConfig.ocrCorrections[error]
    const escapedError = escapeRegex(error)
    
    // Try multiple matching strategies
    const patterns = [
      // 1. Standalone word: space+word+space, start+word+space, space+word+end
      new RegExp(`(^|\\s)${escapedError}($|\\s)`, 'gi'),
      // 2. Word before punctuation: space+word+punct
      new RegExp(`(^|\\s)${escapedError}([,.:;!?\\-])`, 'gi'),
      // 3. Exact substring match (catches typos in middle of words)
      new RegExp(escapedError, 'gi'),
    ]
    
    for (const regex of patterns) {
      const before = result
      result = result.replace(regex, (match, ...args) => {
        // When pattern has capture groups: (match, prefix, suffix, offset, string)
        // When pattern has no capture groups: (match, offset, string)
        // Check if first arg is a string (prefix) or number (offset)
        
        if (typeof args[0] === 'number') {
          // Pattern 3: exact match (no capture groups)
          return correction
        }
        
        // Patterns 1 & 2: have capture groups (prefix, suffix)
        const prefix = args[0]
        const suffix = args[1]
        
        // Preserve original casing
        let correctedValue = correction
        if (error[0] === error[0].toUpperCase() && correction.length > 0) {
          correctedValue = correction.charAt(0).toUpperCase() + correction.slice(1)
        }
        
        return prefix + correctedValue + suffix
      })
      
      if (result !== before) {
        break // Move to next error once we've made a fix
      }
    }
  }

  return result
}

/**
 * Correct spelling/OCR errors in menu items using language-specific dictionary
 */
async function correctMenuSpelling(menuData: any, languageConfig: LanguageConfig): Promise<any> {
  console.log(`✅ Applying ${languageConfig.name} OCR corrections...`)

  const correctedMenu = JSON.parse(JSON.stringify(menuData))

  // Apply OCR corrections to category names and item names/descriptions
  for (const category of correctedMenu.categories) {
    category.name = applyOCRCorrections(category.name, languageConfig)

    for (const item of category.items) {
      item.name = applyOCRCorrections(item.name, languageConfig)

      if (item.short_desc) {
        item.short_desc = applyOCRCorrections(item.short_desc, languageConfig)
      }
    }
  }

  console.log('✅ OCR corrections applied')
  return correctedMenu
}

/**
 * Verify and refine menu items using GPT-4o with language-specific expertise
 */
async function verifyMenuWithGPT4o(
  menuData: any,
  languageConfig: LanguageConfig
): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    console.warn('⚠️ OPENAI_API_KEY not set, skipping verification')
    return menuData
  }

  // Flatten all items for verification
  const allItems = menuData.categories.flatMap((cat: any) => 
    cat.items.map((item: any) => ({
      categoryName: cat.name,
      itemName: item.name,
      itemDesc: item.short_desc || ''
    }))
  )

  if (allItems.length === 0) return menuData

  const itemsJson = JSON.stringify(allItems, null, 2)

  const prompt = `You are a ${languageConfig.name} culinary language expert. Review these menu items for spelling, terminology, and grammar.

${languageConfig.correctionInstructions}

Menu items to verify (already partially corrected):
${itemsJson}

If corrections are needed, return corrected JSON:
[
  {"categoryName": "...", "itemName": "corrected name", "itemDesc": "corrected description"},
  ...
]

Otherwise, return: {"status": "all_correct"}

Focus on accuracy and authentic culinary terminology for ${languageConfig.name} menus.
`

  try {
    console.log(`🔍 Verifying with GPT-4o (${languageConfig.name} culinary expert mode)...`)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: languageConfig.systemPrompt
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2, // Low temperature for accuracy
        max_tokens: 2500,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.warn(`⚠️ Verification API error ${response.status}, using corrections as-is`)
      return menuData
    }

    const data = await response.json()
    const verifiedData = JSON.parse(data.choices[0].message.content)

    if (verifiedData.status === 'all_correct') {
      console.log(`✅ Verification complete - menu items are correctly spelled for ${languageConfig.name}`)
      return menuData
    }

    // Apply any additional corrections from GPT-4o
    const verifiedMenu = JSON.parse(JSON.stringify(menuData))
    
    if (Array.isArray(verifiedData)) {
      verifiedData.forEach((corrected: any) => {
        const category = verifiedMenu.categories.find((c: any) => c.name === corrected.categoryName)
        if (category) {
          const item = category.items.find((i: any) => i.name === corrected.itemName)
          if (item) {
            console.log(`✅ Verified: "${item.name}" → "${corrected.itemName}"`)
            item.name = corrected.itemName
            if (corrected.itemDesc) {
              item.short_desc = corrected.itemDesc
            }
          }
        }
      })
    }

    return verifiedMenu
  } catch (error) {
    console.error('Error in GPT-4o verification:', error)
    return menuData
  }
}

/**
 * Main handler for parse-menu-text Edge Function
 */
async function handler(req: Request): Promise<Response> {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    const { extractedText, menuName, language = 'da' } = await req.json()

    if (!extractedText || !menuName) {
      return new Response(
        JSON.stringify({ error: 'Missing extractedText or menuName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get language configuration (falls back to English if not found)
    const languageConfig = getLanguageConfig(language, 'da')
    console.log(`📍 Using language configuration: ${languageConfig.name}`)

    // Step 1: Parse menu with GPT-4o (with OCR pre-processing)
    let menuData = await parseMenuWithGPT4o(extractedText, menuName, languageConfig)

    // Step 2: Apply language-specific OCR corrections to parsed data
    menuData = await correctMenuSpelling(menuData, languageConfig)

    // Step 3: Verify with GPT-4o using language expertise
    menuData = await verifyMenuWithGPT4o(menuData, languageConfig)

    console.log('✅ Menu parsing complete')

    return new Response(
      JSON.stringify(menuData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

serve(handler)
