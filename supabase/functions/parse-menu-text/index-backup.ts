// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore - Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Parse extracted menu text using OpenAI GPT-4o and create menu_extractions record
 * Uses the proven extraction logic from menu-extractor.ts
 */
async function parseMenuWithGPT4o(extractedText: string, menuName: string): Promise<any> {
  console.log(`🧠 Parsing menu "${menuName}" with GPT-4o...`)
  
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable not set')
  }

  const prompt = `Extract menu information from this text.

CRITICAL RULES - MUST FOLLOW:
1. ONLY extract menu items that are EXPLICITLY WRITTEN in the content below
2. DO NOT make up menu items based on restaurant type or cuisine
3. DO NOT infer or guess dishes - if you can't find actual menu text, return empty array
4. Menu items are usually listed with names and may include prices (e.g., "Smørrebrød 95 kr.")
5. Preserve EXACT dish names as they appear - do not translate or modify
6. Preserve EXACT category names (e.g., "BRUNCH", "FROKOST", "AFTEN", "TAPAS")
7. Look for time ranges in category names (e.g., "BRUNCH 09.00-12.00")

If the content does NOT contain clear menu items with dish names, return:
{
  "categories": [],
  "dietaryOptions": [],
  "takeaway": null
}

Content to analyze:
${extractedText}

Return JSON with only items that are EXPLICITLY in the content:
{
  "categories": [
    {
      "name": "Exact category name from content",
      "timeRange": "time if in category name, else null",
      "items": [
        {"name": "exact dish name 1", "description": "description if available"},
        {"name": "exact dish name 2", "description": ""}
      ]
    }
  ],
  "dietaryOptions": ["only if explicitly mentioned"],
  "takeaway": true/false/null
}`

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

    // Validate and clean menu structure
    if (Array.isArray(result.categories)) {
      result.categories = result.categories.filter(
        (category: any) => category && category.name && Array.isArray(category.items) && category.items.length > 0
      )
    } else {
      result.categories = []
    }

    if (result.categories.length > 0) {
      console.log('📋 First category:', result.categories[0].name, 'with', result.categories[0].items.length, 'items')
      console.log('📋 First 3 items:', result.categories[0].items.slice(0, 3).map((i: any) => i.name))
    }

    // Transform to match menu_extractions schema
    return {
      categories: result.categories.map((cat: any) => ({
        id: `cat-${Math.random().toString(36).slice(2, 8)}`,
        name: cat.name,
        items: cat.items.map((item: any) => ({
          id: `item-${Math.random().toString(36).slice(2, 8)}`,
          name: item.name,
          short_desc: item.description || undefined
        }))
      }))
    }

  } catch (error) {
    console.error('❌ Error in menu parsing:', error)
    throw error
  }
}

/**
 * Apply comprehensive Danish menu-specific OCR error corrections
 * Fixes character substitutions, compound words, accents, and known menu misspellings
 */
function applyOCRCorrections(text: string): string {
  if (!text) return text

  // Extended Danish menu terminology dictionary
  const corrections: Record<string, string> = {
    // Character substitutions (OCR errors)
    'zble': 'æble',
    'zbler': 'æbler',
    'sennepsfro': 'sennepsfrø',
    'radbede': 'rødbede',
    'radbeder': 'rødbeder',
    'purlog': 'purløg',
    'hvidlog': 'hvidløg',
    'hvidlgg': 'hvidløg',
    'pa ': 'på ',
    'eblekompot': 'æblekompot',
    'eblemost': 'æblemost',
    'gronkal': 'grønkål',
    'gronne': 'grønne',
    'tytteber': 'tyttebær',
    'blamuslinger': 'blåmuslinger',
    'rode ber': 'røde bær',
    'smgr': 'smør',
    'smor': 'smør',
    'flode': 'fløde',
    'hasselngdder': 'hasselnødder',
    'Brodkurv': 'Brødkurv',
    'brodkurv': 'brødkurv',
    'Tilbehor': 'Tilbehør',
    'tilbehor': 'tilbehør',
    'Cesarsalat': 'Cæsarsalat',
    'cesarsalat': 'cæsarsalat',
    'cesardressing': 'cæsardressing',
    
    // French/Danish accents and special characters
    'Briilée': 'Brûlée',
    'briilée': 'brûlée',
    'crotitons': 'crôutons',
    'croutons': 'crôutons',  // Classic French spelling for Danish menus
    'a la mande': 'á la mande',  // French classic spelling
    'a\'la mande': 'á la mande',
    
    // Common compound word corrections
    'dildmayo': 'dild mayo',
    'urtemayo': 'urte mayo',
    'dilemayo': 'dil mayo',
    'sennepsfrø mayo': 'sennepsfrø mayo',
    
    // Common menu items - spelling fixes
    'koldroget': 'koldrøget',
    'koldrøget laks': 'koldrøget laks',
    'høns': 'høns',  // correct plural of høne
    'hons': 'høns',
    'tartelet': 'tartelet',
    'oksetatar': 'oksetatar',  // Modern spelling without "kødt"
    'oksekødtatar': 'oksetatar',  // Should be simplified
    'rort': 'rørt',
    'Rort': 'Rørt',
    
    // Meat and protein items
    'kalkun': 'kalkun',
    'kirsebzersorbet': 'kirsebærsorbet',
    'kirsebersauce': 'kirsebærsauce',
    'kirsebær': 'kirsebær',
    'solberkompot': 'solbærkompot',
    'solbær': 'solbær',
    'andesky': 'andesky',  // Keep as-is, already correct
    'andeskyst': 'andeskyst',
    'palmekal': 'palmekål',
    
    // Misc corrections
    'Zz Forret': 'Forretter',
    'zz forret': 'forretter',
    'karse': 'karse',
    'peberrod': 'peberrod',
    'velouté': 'velouté',
  }

  let result = text
  
  // Apply corrections in order of specificity (longer patterns first)
  const sortedKeys = Object.keys(corrections).sort((a, b) => b.length - a.length)
  
  for (const error of sortedKeys) {
    const correction = corrections[error]
    
    // Use regex to replace while respecting word boundaries
    // Case-insensitive but preserve original casing when possible
    const regex = new RegExp(`\\b${error}\\b`, 'gi')
    result = result.replace(regex, (match) => {
      // If original is uppercase, make correction uppercase
      if (match[0] === match[0].toUpperCase()) {
        return correction.charAt(0).toUpperCase() + correction.slice(1)
      }
      return correction
    })
  }

  return result
}

/**
 * Correct common Danish OCR/spelling errors in menu items
 */
async function correctDanishSpelling(menuData: any): Promise<any> {
  console.log('✅ Applying Danish OCR corrections...')
  
  try {
    // Deep clone to avoid mutations
    const correctedMenu = JSON.parse(JSON.stringify(menuData))
    
    // Apply corrections to all items
    correctedMenu.categories.forEach((category: any) => {
      // Correct category name
      category.name = applyOCRCorrections(category.name)
      
      // Correct each item
      category.items.forEach((item: any) => {
        console.log(`📝 Correcting: "${item.name}"`)
        item.name = applyOCRCorrections(item.name)
        
        if (item.short_desc) {
          item.short_desc = applyOCRCorrections(item.short_desc)
        }
        
        console.log(`   → "${item.name}"`)
      })
    })

    console.log('✅ OCR corrections complete')
    return correctedMenu

  } catch (error) {
    console.warn('⚠️ Error during OCR correction:', error)
    return menuData
  }
}

/**
 * Verify corrections using GPT-4o as a final check
 * Focuses on Danish menu terminology, compound words, accents, and plural forms
 */
async function verifyWithGPT4o(menuData: any): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
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

  const prompt = `You are a Danish culinary language expert. Review these Danish menu items for spelling, terminology, and grammar.

CRITICAL CORRECTIONS TO LOOK FOR:
1. **Compound words**: "dild mayo" (separate), "urte mayo", NOT "dildmayo" or "urtemayo"
2. **Accents/Diacritics**: "koldrøget", "crôutons" (French), "á la mande" (French classic spelling)
3. **Plurals**: "rødbeder" (plural) vs "rødbede" (singular) - use based on context
4. **Spelling**: "høns" (not "hons"), "oksetatar" (not "oksekødtatar"), "rørt" (not "rort")
5. **Danish food terms**: 
   - "Koldrøget laks" = Smoked salmon
   - "Tartelet" = Small tart
   - "Andesky" or "andeskyst" = Duck sauce (andesky is correct)
   - "Velouté sauce" = Classic French sauce term (keep as-is)
6. **French terms on Danish menus**: "brûlée", "crôutons", "á la mande" (use French accents for authenticity)

Menu items to verify (already partially corrected):
${itemsJson}

If corrections are needed, return corrected JSON:
[
  {"categoryName": "...", "itemName": "corrected name", "itemDesc": "corrected description"},
  ...
]

Otherwise, return: {"status": "all_correct"}

Focus on: compound words, accents, plurals, Danish terminology, and French terms.
`

  try {
    console.log('🔍 Verifying with GPT-4o (Danish menu expert mode)...')
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
            content: 'You are an expert in Danish culinary terminology and spelling. You understand Danish food culture, compound word conventions, French culinary terms used in Denmark, plural/singular usage in menus, and proper accents/diacritics. Review menu items for accuracy and return only valid JSON. Do NOT change correct spellings.'
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
      console.log('✅ Verification complete - menu items are correctly spelled')
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

    console.log('✅ Danish menu terminology verification complete')
    return verifiedMenu

  } catch (error) {
    console.warn('⚠️ Error during spell-check:', error, '- continuing without additional corrections')
    return menuData
  }
}

serve(async (req: any) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('📥 Parse menu request received')

    // Verify JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('❌ Auth error:', authError)
      throw new Error('Unauthorized')
    }

    console.log('✅ Authenticated user:', user.id)

    const { extractedText, menuName, menuType, businessId, menuSourceId } = await req.json()
    
    if (!extractedText) {
      throw new Error('extractedText is required')
    }
    if (!menuName) {
      throw new Error('menuName is required')
    }
    if (!businessId) {
      throw new Error('businessId is required')
    }

    // Parse menu with GPT-4o
    const parsedMenu = await parseMenuWithGPT4o(extractedText, menuName)
    
    console.log(`✅ Menu parsed: ${parsedMenu.categories?.length || 0} categories`)

    // Apply comprehensive OCR corrections
    let correctedMenu = await correctDanishSpelling(parsedMenu)
    
    // Verify and refine with GPT-4o if needed
    correctedMenu = await verifyWithGPT4o(correctedMenu)

    // Save to menu_extractions table
    const menuExtractionData = {
      business_id: businessId,
      menu_source_id: menuSourceId || null,
      menu_name: menuName,
      menu_type: menuType || 'standard',
      extracted_data: correctedMenu,
      created_by: user.id
    }

    const { data: savedExtraction, error: saveError } = await supabase
      .from('menu_extractions')
      .insert([menuExtractionData])
      .select()

    if (saveError) {
      console.error('❌ Failed to save menu extraction:', saveError)
      throw saveError
    }

    console.log('✅ Menu extraction saved:', savedExtraction?.[0]?.id)

    return new Response(
      JSON.stringify({ 
        success: true,
        extractionId: savedExtraction?.[0]?.id,
        categories: correctedMenu.categories?.length || 0,
        message: 'Menu successfully parsed, spelling corrected, and saved'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ Parse menu error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to parse menu',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
