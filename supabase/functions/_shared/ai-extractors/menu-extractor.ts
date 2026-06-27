/**
 * Menu Extractor
 * 
 * Extracts comprehensive menu information using OpenAI.
 * This is the most complex extraction task requiring deep understanding of menu structures.
 * 
 * Uses premium model (gpt-4o) for accuracy - handles ~70% of AI costs.
 */

import { AI_TASKS } from '../ai-config.ts'

/**
 * Classify establishment type based on menu structure, vocabulary, and about text
 * FSE = Full-Service Establishment (restaurants with complete meal courses)
 * SBO = Specialized Beverage Outlet (cafes, coffee shops, bars with limited food)
 */
function classifyEstablishmentType(
  menuStructure: MenuCategory[],
  allContent: string
): 'FSE' | 'SBO' | null {
  if (!menuStructure || menuStructure.length === 0) {
    return null
  }

  const contentLower = allContent.toLowerCase()
  const categoryNames = menuStructure.map(c => c.name.toLowerCase()).join(' ')
  const allItems = menuStructure.flatMap(c => c.items).join(' ').toLowerCase()
  const combinedText = `${categoryNames} ${allItems} ${contentLower}`
  
  // Extract about/description text for additional context
  // Look for common about section patterns in the content
  const aboutMatch = contentLower.match(/(?:about us|om os|about|our story|vores historie|who we are)[\s\S]{0,500}/i)
  const aboutText = aboutMatch ? aboutMatch[0] : ''

  // FSE indicators (Full-Service Establishment)
  const fseKeywords = {
    sections: ['appetizer', 'starter', 'forretter', 'entrée', 'main', 'hovedret', 'mains', 'dessert', 'desserter'],
    vocabulary: ['seasonal', 'plated', 'chef special', 'chefsspecial', 'course', 'gang', 'table d\'hôte', 'menu degustacion', 'tasting menu', 'smagsmenu'],
    wineList: ['wine list', 'vinliste', 'vinkort', 'sommelier'],
    aboutKeywords: ['fine dining', 'culinary experience', 'dining experience', 'gastronomic', 'restaurant', 'cuisine', 'kitchen', 'køkken', 'mad', 'gastronomi']
  }

  // SBO indicators (Specialized Beverage Outlet)
  const sboKeywords = {
    sections: ['roast profile', 'seasonal brew', 'signature cocktail', 'cocktails', 'kaffe', 'coffee', 'espresso', 'small bites', 'pastries', 'bakery', 'bagel'],
    vocabulary: ['origin', 'notes of', 'blend', 'craft beer', 'craft', 'house-made syrup', 'house made', 'beans', 'bønner', 'barista'],
    foodPlacement: ['snacks', 'accompaniment', 'tilbehør', 'smaller plates', 'små retter'],
    aboutKeywords: ['coffee shop', 'coffeehouse', 'café', 'cafe', 'kaffebar', 'bar', 'brewhouse', 'roastery', 'risteri', 'cocktail bar', 'wine bar', 'pub', 'brewery', 'bryggeri']
  }

  // Score each type
  let fseScore = 0
  let sboScore = 0

  // Check FSE sections
  for (const keyword of fseKeywords.sections) {
    if (categoryNames.includes(keyword)) fseScore += 3
  }
  
  // Check FSE vocabulary
  for (const keyword of fseKeywords.vocabulary) {
    if (combinedText.includes(keyword)) fseScore += 2
  }
  
  // Check wine list indicators
  for (const keyword of fseKeywords.wineList) {
  
  // Check FSE about text indicators
  for (const keyword of fseKeywords.aboutKeywords) {
    if (aboutText.includes(keyword) || combinedText.includes(keyword)) fseScore += 1
  }
    if (combinedText.includes(keyword)) fseScore += 2
  }

  // Check SBO sections
  for (const keyword of sboKeywords.sections) {
    if (categoryNames.includes(keyword)) sboScore += 3
  }
  
  // Check SBO vocabulary
  for (const keyword of sboKeywords.vocabulary) {
    if (combinedText.includes(keyword)) sboScore += 2
  }
  
  // Check SBO about text indicators
  for (const keyword of sboKeywords.aboutKeywords) {
    if (aboutText.includes(keyword) || combinedText.includes(keyword)) sboScore += 1
  }
  
  // Check SBO food placement indicators
  for (const keyword of sboKeywords.foodPlacement) {
    if (combinedText.includes(keyword)) sboScore += 1
  }

  // Additional heuristics
  // If food categories are at the end (last 2 categories), lean toward SBO
  if (menuStructure.length >= 3) {
    const lastTwoCategories = menuStructure.slice(-2).map(c => c.name.toLowerCase()).join(' ')
    if (lastTwoCategories.includes('food') || lastTwoCategories.includes('mad') || 
        lastTwoCategories.includes('snack') || lastTwoCategories.includes('bite')) {
      sboScore += 2
    }
  }

  // Beverage-heavy menu suggests SBO
  const beverageCategories = menuStructure.filter(c => {
    const name = c.name.toLowerCase()
    return name.includes('drink') || name.includes('coffee') || name.includes('kaffe') || 
           name.includes('cocktail') || name.includes('beer') || name.includes('øl') ||
           name.includes('wine') || name.includes('vin') || name.includes('tea') || name.includes('te')
  })
  if (beverageCategories.length > menuStructure.length * 0.5) {
    sboScore += 3
  }

  console.log('🏢 Establishment classification scores - FSE:', fseScore, 'SBO:', sboScore)

  // Determine type based on scores
  if (fseScore === 0 && sboScore === 0) {
    return null // Unclear
  }
  
  if (fseScore > sboScore) {
    console.log('✅ Classified as FSE (Full-Service Establishment)')
    return 'FSE'
  } else if (sboScore > fseScore) {
    console.log('✅ Classified as SBO (Specialized Beverage Outlet)')
    return 'SBO'
  } else {
    // Tie - use fallback heuristics
    // If has full appetizer + main + dessert structure = FSE
    const hasFullCourseStructure = categoryNames.includes('appetizer') || categoryNames.includes('forretter')
    if (hasFullCourseStructure) {
      console.log('✅ Classified as FSE (has full course structure)')
      return 'FSE'
    }
    console.log('⚠️ Classification inconclusive')
    return null
  }
}

export interface MenuCategory {
  name: string
  timeRange: string | null
  items: string[]
}

export interface MenuExtraction {
  menuStructure: MenuCategory[]
  dietaryOptions: string[]
  takeaway: boolean | null
  delivery: boolean | null
  hasTableService: boolean | null
  reservationRequired: boolean | null
  hasKidsMenu: boolean | null
  establishmentType: 'FSE' | 'SBO' | null  // FSE = Full-Service Establishment, SBO = Specialized Beverage Outlet
}

export async function extractMenu(
  content: string,
  menuUrl: string | null,
  businessType: string | null,
  openaiApiKey: string
): Promise<MenuExtraction> {
  // Only extract menu for food/beverage businesses
  const relevantTypes = ['restaurant', 'cafe', 'bar']
  if (businessType && !relevantTypes.includes(businessType)) {
    console.log('ℹ️ Skipping menu extraction for business type:', businessType)
    return {
      menuStructure: [],
      dietaryOptions: [],
      takeaway: null,
      delivery: null,
      hasTableService: null,
      reservationRequired: null,
      hasKidsMenu: null,
      establishmentType: null
    }
  }

  // Debug: Log what content we're receiving
  console.log('📋 Menu extractor received content length:', content.length)
  const pdfSections = content.match(/=== PDF Menu/g)
  console.log('📄 PDF menu sections found:', pdfSections?.length || 0)
  if (pdfSections) {
    // Show first 500 chars of PDF content
    const pdfStart = content.indexOf('=== PDF Menu')
    if (pdfStart >= 0) {
      console.log('📄 First PDF section preview:', content.substring(pdfStart, pdfStart + 500))
    }
  }

  const prompt = `Extract menu information from this website content.

${menuUrl ? `Detected menu page: ${menuUrl}\n` : ''}

CRITICAL RULES - MUST FOLLOW:
1. ONLY extract menu items that are EXPLICITLY WRITTEN in the content below
2. DO NOT make up menu items based on restaurant type or cuisine
3. DO NOT infer or guess dishes - if you can't find actual menu text, return empty array
4. Look for "=== PDF Menu" sections - these contain the actual menu text from PDF files
5. Menu items are usually listed with names and may include prices (e.g., "Smørrebrød 95 kr.")
6. Preserve EXACT dish names as they appear - do not translate or modify
7. Preserve EXACT category names (e.g., "BRUNCH", "FROKOST", "AFTEN", "TAPAS")
8. Look for time ranges in category names (e.g., "BRUNCH 09.00-12.00")

JAVASCRIPT GALLERY WIDGETS - SPECIAL HANDLING:
9. Some sites use JavaScript-rendered filterable gallery widgets for menu items
   - Dish names appear as link text inside <a> tags (often with href="javascript:void(0)" or misspelled "javascrpit:void(0)")
   - Extract ALL link text values from these anchor tags as menu items
   - Group items by their nearest preceding section heading, filter tab label, or category marker
   - DEDUPLICATE items - gallery widgets often render each item twice (thumbnail + label version)
   - Look for section markers like "Korean BBQ", "Sushi", "Drikkevarer" and subcategories like "Hosomaki", "Nigiri"
   - Even if links don't look like traditional menu markup, extract them if they appear to be dish names

If the content below DOES NOT contain clear menu items with dish names, return:
{
  "menuStructure": [],
  "dietaryOptions": [],
  "takeaway": null,
  "delivery": null,
  "hasTableService": null,
  "reservationRequired": null,
  "hasKidsMenu": null
}

Content to analyze:
${content}

Return JSON with only items that are EXPLICITLY in the content:
{
  "menuStructure": [
    {
      "name": "Exact category name from content",
      "timeRange": "time if in category name, else null",
      "items": ["exact dish name 1", "exact dish name 2"]
    }
  ],
  "dietaryOptions": ["only if explicitly mentioned"],
  "takeaway": true/false/null (if mentioned: takeaway, take away, take-away, to-go, afhentning, medbring),
  "delivery": true/false/null (if mentioned: delivery, levering, udbringning, just eat, wolt, food delivery),
  "hasTableService": true/false/null (if mentioned: table service, borddækning, servering, reservations, bookings),
  "reservationRequired": true/false/null (if mentioned: reservation required, booking required, kun med reservation),
  "hasKidsMenu": true/false/null (if mentioned: kids menu, børnemenu, children menu, barnmeny, menu for children, or if you see categories/sections like "BØRN", "KIDS", "CHILDREN", or menu items clearly for children)
}`

  const taskConfig = AI_TASKS.menu

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
          { role: 'system', content: 'You are a precise menu extraction expert. ONLY extract menu items that are explicitly written in the provided content. DO NOT invent, guess, or infer menu items. If no clear menu is found, return empty arrays. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: taskConfig.temperature,
        max_tokens: taskConfig.maxTokens,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error('❌ Menu extraction failed:', response.status)
      return {
        menuStructure: [],
        dietaryOptions: [],
        takeaway: null,
        delivery: null,
        hasTableService: null,
        reservationRequired: null,
        hasKidsMenu: null,
        establishmentType: null
      }
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    // Debug: Log what AI returned
    console.log('🤖 AI returned menu structure:', JSON.stringify(result.menuStructure, null, 2))

    // Validate and clean menu structure
    if (Array.isArray(result.menuStructure)) {
      result.menuStructure = result.menuStructure.filter(
        (category: any) => category && category.name && Array.isArray(category.items) && category.items.length > 0
      )
    } else {
      result.menuStructure = []
    }

    // Classify establishment type based on menu structure
    const establishmentType = classifyEstablishmentType(result.menuStructure, content)
    result.establishmentType = establishmentType

    console.log('✅ Menu extracted:', result.menuStructure.length, 'categories')
    if (result.menuStructure.length > 0) {
      console.log('📋 First category:', result.menuStructure[0].name, 'with', result.menuStructure[0].items.length, 'items')
      console.log('📋 First 3 items:', result.menuStructure[0].items.slice(0, 3))
    }
    return result

  } catch (error) {
    console.error('❌ Error in menu extraction:', error)
    return {
      menuStructure: [],
      dietaryOptions: [],
      takeaway: null,
      delivery: null,
      hasTableService: null,
      reservationRequired: null,
      hasKidsMenu: null,
      establishmentType: null
    }
  }
}
