/**
 * Database persistence layer for website analysis results
 * Saves extracted data to multiple tables: website_analyses, business_profile,
 * business_locations, opening_hours, business_operations
 */

export interface PersistenceResult {
  success: boolean
  updated?: boolean
  inserted?: boolean
  lastRunAt?: string
  error?: string
  note?: string
}

export interface SaveWebsiteAnalysisParams {
  businessId: string
  url: string
  analysisResult: any
  bookingUrl?: string | null
  menuExtraction?: any | null
  menuSignal?: any | null
  toneOfVoice?: any | null
  supabase: any
  authHeader?: string | null
}

const MAX_KEY_OFFERINGS = 5

function compactText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeKeyOffering(value: string): string {
  return compactText(value).toLowerCase()
}

function dedupeOfferings(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    const cleaned = compactText(item)
    if (!cleaned || /^ingen$/i.test(cleaned)) continue

    const key = normalizeKeyOffering(cleaned)
    if (seen.has(key)) continue

    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function extractSnippet(source: string, needle: string): string | null {
  const haystack = compactText(source)
  const searchTerm = normalizeKeyOffering(needle)
  if (!haystack || !searchTerm) return null

  const index = haystack.toLowerCase().indexOf(searchTerm)
  if (index === -1) return null

  const start = Math.max(0, index - 80)
  const end = Math.min(haystack.length, index + searchTerm.length + 140)
  return compactText(haystack.slice(start, end))
}

function extractIngredientPhrase(source: string, needle: string): string | null {
  const snippet = extractSnippet(source, needle)
  if (!snippet) return null

  const ingredientPatterns = [
    /(?:med|serveres med|served with|fyldt med|toppet med|anrettet med|bestående af|indeholder)\s+([^\.\n;:]+)/i,
    /(?:with)\s+([^\.\n;:]+)/i,
  ]

  for (const pattern of ingredientPatterns) {
    const match = snippet.match(pattern)
    if (!match?.[1]) continue

    const phrase = compactText(match[1])
    if (phrase.length >= 8 && phrase.length <= 120) {
      return phrase.replace(/[,\s]+$/, '')
    }
  }

  return null
}

function isGenericCategoryDetail(detail: string): boolean {
  const normalized = normalizeKeyOffering(detail)
  if (!normalized) return true

  return /klassisk|signatur|frokostret|aftensret|dessert|burger|cocktail|snack|salat|pastaret|smørrebrød|smagemenu|skaldyr med pommes frites|grønt valg|børnevenlig ret/.test(normalized)
}

function canonicalIngredientHint(item: string): string | null {
  const normalized = normalizeKeyOffering(item)
  if (/pariserb[oø]f|parisarb[oø]f/.test(normalized)) return 'hakket oksekød, spejlæg, løg, rødbeder'
  if (/faustburger|burger/.test(normalized)) return 'bøf, burgerbolle, ost, salat'
  if (/moules?\s+frites/.test(normalized)) return 'blåmuslinger, pommes frites, hvidvin'
  if (/(gammeldags\s+)?æblekage/.test(normalized)) return 'æbler, makroner, flødeskum'
  if (/faust\s+stormy/.test(normalized)) return 'rom, ginger beer, lime'
  if (/smørrebrød/.test(normalized)) return 'rugbrød, pålæg, garniture'
  if (/brunch/.test(normalized)) return 'æg, brød, frugt, kaffe'
  return null
}

function buildMenuExtractionText(menuExtraction: any): string {
  const segments: string[] = []

  const categories = Array.isArray(menuExtraction?.menuStructure)
    ? menuExtraction.menuStructure
    : Array.isArray(menuExtraction?.categories)
      ? menuExtraction.categories
      : []

  for (const category of categories) {
    const categoryName = compactText(category?.name || category?.title || '')
    const categoryDescription = compactText(category?.categoryDescription || '')
    if (categoryName) segments.push(categoryName)
    if (categoryDescription) segments.push(categoryDescription)

    const items = Array.isArray(category?.items) ? category.items : Array.isArray(category?.dishes) ? category.dishes : []
    for (const item of items) {
      const itemName = compactText(item?.name || item?.title || '')
      const itemDescription = compactText(item?.description || item?.short_desc || '')
      if (itemName) segments.push(itemName)
      if (itemDescription) segments.push(itemDescription)
    }
  }

  return compactText(segments.join(' '))
}

async function inferIngredientDetailsWithAI(
  menuExtraction: any,
  menuSignal: any,
  candidates: string[]
): Promise<Record<string, string>> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    console.warn('⚠️ OpenAI API key not found - key_offerings will use fallback patterns only')
    return {}
  }

  const sourceText = [
    buildMenuExtractionText(menuExtraction),
    compactText(menuSignal?.menuDescription),
    compactText(menuSignal?.rawExtract),
    Array.isArray(menuSignal?.menuCategories) ? menuSignal.menuCategories.join(' ') : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 12000)

  if (!sourceText) return {}

  const prompt = `Du får en menu og en liste af tilbud. Din opgave er at returnere korte, konkrete ingrediens- eller komponentbeskrivelser for hvert tilbud.

Krav:
- Brug kun information der kan udledes fra teksten.
- Skriv ingrediens-/komponentniveau, ikke kategori-labels som "klassisk frokostret", "signaturburger", "signaturcocktail" eller "klassisk dessert".
- Hvis menuen ikke nævner ingredienser direkte, inferér de mest sandsynlige, almindeligt kendte komponenter for retter med tydeligt navn.
- Svar kun i JSON.
- Hvis der ikke kan udledes en ingrediens-/komponentbeskrivelse, returner tom streng for det tilbud.
- Hold beskrivelserne korte: 2-6 ord.

Tilbud:
${candidates.map((item, index) => `${index + 1}. ${item}`).join('\n')}

Tekst:
${sourceText}

Returner JSON på formen:
{
  "items": [
    { "name": "...", "detail": "..." }
  ]
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Du udtrækker korte ingrediens- og komponentbeskrivelser fra menutekst.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      console.warn('⚠️ Ingredient AI lookup failed:', response.status)
      return {}
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return {}

    const parsed = JSON.parse(content)
    const items = Array.isArray(parsed?.items) ? parsed.items : []
    const result: Record<string, string> = {}

    for (const row of items) {
      const name = compactText(row?.name || '')
      const detail = compactText(row?.detail || '')
      if (!name || !detail) continue
      if (!isGenericCategoryDetail(detail)) {
        result[name.toLowerCase()] = detail
      }
    }

    console.log(`✅ AI enriched ${Object.keys(result).length}/${candidates.length} offerings`)
    return result
  } catch (error) {
    console.warn('⚠️ Ingredient AI lookup error:', error)
    return {}
  }
}

function detailFromKeywords(item: string, menuSignal: any): string | null {
  const normalizedItem = normalizeKeyOffering(item)
  const combined = [
    compactText(menuSignal?.menuExtractionText),
    compactText(menuSignal?.menuDescription),
    compactText(menuSignal?.rawExtract),
    Array.isArray(menuSignal?.menuCategories) ? menuSignal.menuCategories.join(' ') : ''
  ].join(' ')
  const combinedNormalized = combined.toLowerCase()

  const ingredientPhrase = extractIngredientPhrase(combined, item)
  if (ingredientPhrase) {
    return ingredientPhrase
  }

  const snippet = extractSnippet(combined, item)
  if (!snippet) return null

  const retterMatch = snippet.match(/(\d+)\s*retter/i)
  if (retterMatch) {
    const parts = [`${retterMatch[1]}-retters menu`]
    const servingMatch = snippet.match(/serveres\s+([^\.\n]+)/i)
    if (servingMatch?.[1]) {
      parts.push(`serveres ${compactText(servingMatch[1])}`)
    }

    const serveringerMatch = snippet.match(/(\d+)\s*serveringer/i)
    if (serveringerMatch?.[1]) {
      parts.push(`${serveringerMatch[1]} serveringer`)
    }

    return parts.join(', ')
  }

  return null
}

async function buildEnrichedKeyOfferings(menuExtraction: any, menuSignal: any): Promise<string | null> {
  const signatureItems = Array.isArray(menuSignal?.signatureItems)
    ? menuSignal.signatureItems.map((item: string) => compactText(item))
    : []

  const programmeItems = Array.isArray(menuSignal?.programmes)
    ? menuSignal.programmes.flatMap((programme: any) => Array.isArray(programme?.items) ? programme.items : [])
    : []

  const fallbackItems = Array.isArray(menuSignal?.menuCategories)
    ? menuSignal.menuCategories
        .map((category: string) => compactText(category))
        .filter((category: string) => /cocktail|brunch|frokost|aften|dessert|smørrebrød|burger|sandwich|pasta|salat|nachos|børn|omakase|menu|retter/i.test(category))
        .slice(0, MAX_KEY_OFFERINGS)
    : []

  const candidates = dedupeOfferings([
    ...signatureItems,
    ...programmeItems,
    ...fallbackItems,
  ]).slice(0, MAX_KEY_OFFERINGS)

  if (candidates.length === 0) return null

  const aiDetails = await inferIngredientDetailsWithAI(menuExtraction, menuSignal, candidates)

  const enriched = candidates.map((item) => {
    const detail = aiDetails[item.toLowerCase()]
      || detailFromKeywords(item, {
        ...menuSignal,
        menuExtractionText: buildMenuExtractionText(menuExtraction),
      })
      || canonicalIngredientHint(item)

    return detail ? `${item} - ${detail}` : item
  })

  return enriched.join('\n')
}

/**
 * Save complete website analysis to database
 * 
 * Updates 5 tables:
 * 1. website_analyses - Raw analysis result
 * 2. business_profile - Short description, menu structure, booking URL, menu signal
 * 3. business_locations - Contact info (phone, email, address)
 * 4. opening_hours - Extracted hours
 * 5. business_operations - Establishment type classification
 */
export async function saveWebsiteAnalysis(
  params: SaveWebsiteAnalysisParams
): Promise<PersistenceResult> {
  const {
    businessId,
    url,
    analysisResult,
    bookingUrl,
    menuExtraction,
    menuSignal,
    toneOfVoice,
    supabase,
    authHeader
  } = params

  const result: PersistenceResult = { success: false }

  try {
    if (authHeader) {
      console.log('🔑 Persisting with provided auth header')
    } else {
      console.log('🔑 Persisting with service/anon key')
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. WEBSITE_ANALYSES - Store raw analysis result
    // ═══════════════════════════════════════════════════════════════════════════

    // Merge into existing raw_result to preserve other fields
    let mergedRawResult: Record<string, any> = {
      analysis: { ...analysisResult },
    }

    const { data: existingWA, error: existingWAError } = await supabase
      .from('website_analyses')
      .select('raw_result')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingWAError) {
      console.warn('⚠️ Could not read existing website_analyses.raw_result:', existingWAError.message)
    } else if (existingWA?.raw_result && typeof existingWA.raw_result === 'object') {
      const existingRawResult = existingWA.raw_result as Record<string, any>
      const existingAnalysis = (existingRawResult.analysis && typeof existingRawResult.analysis === 'object')
        ? (existingRawResult.analysis as Record<string, any>)
        : {}

      mergedRawResult = {
        ...existingRawResult,
        analysis: {
          ...existingAnalysis,
          ...analysisResult,
        },
      }
    }

    const runAt = new Date().toISOString()
    const websiteAnalysisUpdate = {
      source_url: url,
      status: 'success',
      last_run_at: runAt,
      raw_result: mergedRawResult,
    }
    result.lastRunAt = runAt

    const { data: updatedRows, error: waUpdateError } = await supabase
      .from('website_analyses')
      .update(websiteAnalysisUpdate)
      .eq('business_id', businessId)
      .select('id')

    if (waUpdateError) {
      console.warn('⚠️ Failed to update website_analyses:', waUpdateError.message)
      result.error = `update_failed: ${waUpdateError.message}`
    } else if (updatedRows && updatedRows.length > 0) {
      console.log('✅ Updated website_analyses')
      result.updated = true
    } else {
      // No existing row, insert new
      const { error: waInsertError } = await supabase
        .from('website_analyses')
        .insert({
          business_id: businessId,
          ...websiteAnalysisUpdate,
        })

      if (waInsertError) {
        console.warn('⚠️ Failed to insert website_analyses:', waInsertError.message)
        result.error = `insert_failed: ${waInsertError.message}`
      } else {
        console.log('✅ Inserted website_analyses')
        result.inserted = true
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. BUSINESS_PROFILE - Short description, menu, booking, menu signal
    // ═══════════════════════════════════════════════════════════════════════════

    const profileData: Record<string, any> = {
      business_id: businessId,
      updated_at: new Date().toISOString()
    }

    if (analysisResult.shortDescription) {
      profileData.long_description = analysisResult.shortDescription
    }

    if (menuExtraction?.menuStructure?.length > 0) {
      profileData.menu_structure = menuExtraction.menuStructure
    }

    if (menuSignal?.menuDescription) {
      profileData.menu_description = menuSignal.menuDescription
    }

    if (menuSignal?.placeSynopsis && typeof menuSignal.placeSynopsis === 'string') {
      const synopsis = menuSignal.placeSynopsis.trim()
      if (synopsis.length > 0) {
        profileData.ai_place_synopsis = synopsis
        console.log('🧠 Saving place synopsis to ai_place_synopsis')
      }
    }

    if (bookingUrl) {
      profileData.booking_url = bookingUrl
      console.log('🎫 Saving booking URL to profile:', bookingUrl)
    }

    if (menuSignal) {
      profileData.menu_signal = menuSignal
      console.log('🍽️ Saving menu signal to profile (hasMenu:', menuSignal.hasMenu, ')')
      
      // Auto-populate key_offerings from menu signal context.
      // Keep it to five concise offerings that are useful for Free-tier AI ideas.
      const keyOfferingsText = await buildEnrichedKeyOfferings(menuExtraction, menuSignal)
      if (keyOfferingsText) {
        profileData.key_offerings = keyOfferingsText
        analysisResult.keyOfferings = keyOfferingsText
        console.log('📋 Auto-populated key_offerings from menu signal context')
      }
    }

    const { error: bpError } = await supabase
      .from('business_profile')
      .upsert(profileData, { onConflict: 'business_id' })

    if (bpError) {
      console.warn('⚠️ Failed to save business_profile:', bpError.message)
    } else {
      console.log('✅ Saved to business_profile')
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2.5 BUSINESSES - Business name, website URL, logo, local location reference
    // ═══════════════════════════════════════════════════════════════════════════

    const businessUpdateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (analysisResult.businessName) {
      businessUpdateData.name = analysisResult.businessName
      console.log('🏢 Updating business name:', analysisResult.businessName)
    }

    if (url) {
      businessUpdateData.website_url = url
      console.log('🌐 Updating website URL:', url)
    }

    if (analysisResult.logoUrl) {
      businessUpdateData.logo_url = analysisResult.logoUrl
      console.log('🖼️ Updating logo URL:', analysisResult.logoUrl)
    }

    if (analysisResult.localLocationReference) {
      businessUpdateData.local_location_reference = analysisResult.localLocationReference
      console.log('📍 Updating local location reference:', analysisResult.localLocationReference)
    }

    // Only update if we have data beyond just the timestamp
    if (Object.keys(businessUpdateData).length > 1) {
      const { error: businessError } = await supabase
        .from('businesses')
        .update(businessUpdateData)
        .eq('id', businessId)

      if (businessError) {
        console.warn('⚠️ Failed to update businesses table:', businessError.message)
      } else {
        console.log('✅ Updated businesses table with', Object.keys(businessUpdateData).length - 1, 'fields')
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. BUSINESS_LOCATIONS - Contact info
    // ═══════════════════════════════════════════════════════════════════════════

    if (analysisResult.contact) {
      const contact = analysisResult.contact
      const locationUpdateData: Record<string, any> = {}

      if (contact.phone) locationUpdateData.phone = contact.phone
      if (contact.email) locationUpdateData.email = contact.email

      if (contact.address) {
        if (typeof contact.address === 'string') {
          locationUpdateData.address_line1 = contact.address
        } else {
          if (contact.address.street) locationUpdateData.address_line1 = contact.address.street
          if (contact.address.city) locationUpdateData.city = contact.address.city
          if (contact.address.postalCode) locationUpdateData.postal_code = contact.address.postalCode
          if (contact.address.country) locationUpdateData.country = contact.address.country
        }
      }

      // Only update if we have some contact data
      if (Object.keys(locationUpdateData).length > 0) {
        const { data: existingLoc } = await supabase
          .from('business_locations')
          .select('id')
          .eq('business_id', businessId)
          .eq('is_primary', true)
          .maybeSingle()

        let locError
        if (existingLoc) {
          // Update existing primary location
          const updateResult = await supabase
            .from('business_locations')
            .update(locationUpdateData)
            .eq('business_id', businessId)
            .eq('is_primary', true)
          locError = updateResult.error
        } else {
          // Insert new primary location
          const insertResult = await supabase
            .from('business_locations')
            .insert({
              business_id: businessId,
              is_primary: true,
              country: 'Denmark',
              ...locationUpdateData
            })
          locError = insertResult.error
        }

        if (locError) {
          console.warn('⚠️ Failed to save business_locations:', locError.message)
        } else {
          console.log('✅ Saved to business_locations')
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. OPENING_HOURS - Extracted hours
    // ═══════════════════════════════════════════════════════════════════════════

    if (analysisResult.openingHours && Object.keys(analysisResult.openingHours).length > 0) {
      const hoursToInsert = Object.entries(analysisResult.openingHours).map(([day, hours]: [string, any]) => ({
        business_id: businessId,
        weekday: day.toLowerCase(),
        open_time: hours.closed ? null : hours.open,
        close_time: hours.closed ? null : hours.close,
        closed: hours.closed || false,
        kind: 'normal'
      }))

      // Delete existing hours first, then insert new ones
      await supabase.from('opening_hours').delete().eq('business_id', businessId)

      const { error: ohError } = await supabase
        .from('opening_hours')
        .insert(hoursToInsert)

      if (ohError) {
        console.warn('⚠️ Failed to save opening_hours:', ohError.message)
      } else {
        console.log('✅ Saved', hoursToInsert.length, 'opening_hours entries')
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. BUSINESS_OPERATIONS - Establishment type, kitchen close time
    // ═══════════════════════════════════════════════════════════════════════════

    const operationsData: Record<string, any> = {
      business_id: businessId,
      updated_at: new Date().toISOString()
    }

    if (analysisResult.establishmentType) {
      operationsData.establishment_type = analysisResult.establishmentType
      console.log('🏢 Saving establishment type:', analysisResult.establishmentType)
    }

    if (analysisResult.kitchenCloseTime) {
      operationsData.kitchen_close_time = analysisResult.kitchenCloseTime
      console.log('🍳 Saving kitchen close time:', analysisResult.kitchenCloseTime)
    }

    if (Object.keys(operationsData).length > 2) {
      const { error: opsError } = await supabase
        .from('business_operations')
        .upsert(operationsData, { onConflict: 'business_id' })

      if (opsError) {
        console.warn('⚠️ Failed to save business_operations:', opsError.message)
      } else {
        console.log('✅ Saved business_operations fields')
      }
    }

    result.success = true
    return result

  } catch (error) {
    console.error('❌ Database persistence failed:', error)
    result.error = error instanceof Error ? error.message : String(error)
    return result
  }
}
