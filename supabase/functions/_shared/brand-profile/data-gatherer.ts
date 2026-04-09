/**
 * Brand Profile Data Gatherer
 * 
 * Fetches all data sources needed for brand profile generation.
 * Handles parallel database fetching and menu structure parsing.
 */

import type { DataSources } from './types.ts'
import { computeLocationEnrichment } from '../location/location-enrichment.ts'
import { jsonEquals } from '../utils/hash.ts'

// Extract menu data from business_profile.menu_structure (JSONB field)
function parseMenuStructure(menuStructure: unknown): any[] {
  const menuItems: any[] = []
  
  if (!menuStructure) {
    return menuItems
  }
  
  try {
    const parsed = typeof menuStructure === 'string'
      ? JSON.parse(menuStructure)
      : menuStructure
    
    // Flatten categories into individual menu items
    if (Array.isArray(parsed)) {
      parsed.forEach((category: any) => {
        if (Array.isArray(category.items)) {
          category.items.forEach((item: any) => {
            menuItems.push({
              name: item.name,
              description: item.description || null,
              price: item.price || null,
              category: category.name || null,
              dietary: item.dietary || []
            })
          })
        }
      })
    }
    
    console.log(`✅ Extracted ${menuItems.length} menu items from menu_structure`)
  } catch (e) {
    console.error('Failed to parse menu_structure:', e)
  }
  
  return menuItems
}

/**
 * Compute location enrichment and persist if changed.
 * Uses hash comparison to avoid unnecessary database writes.
 * 
 * @param supabase - Supabase client
 * @param location - Primary business location
 * @returns Updated location with enrichment
 */
async function computeAndPersistEnrichment(
  supabase: any,
  location: any
): Promise<any> {
  if (!location) {
    console.log('⚠️  No primary location found, skipping enrichment')
    return null
  }

  // Compute fresh enrichment
  const newEnrichment = computeLocationEnrichment({
    address_line1: location.address_line1,
    address_line2: location.address_line2,
    city: location.city || 'Unknown',
    country: location.country || 'Denmark',
    latitude: location.latitude,
    longitude: location.longitude
  })

  // Compare with existing enrichment using stable JSON comparison
  const existingEnrichment = location.enrichment
  
  if (existingEnrichment && jsonEquals(newEnrichment, existingEnrichment)) {
    console.log('✅ Location enrichment unchanged (hash match), skipping write')
    return location
  }

  // Enrichment changed - persist to database
  console.log('📝 Location enrichment changed, updating database...')
  console.log(`   - City: ${newEnrichment.macro.city} (${newEnrichment.macro.city_tier})`)
  console.log(`   - Area type: ${newEnrichment.micro.area_type}`)
  console.log(`   - Confidence: ${newEnrichment.micro.confidence}`)
  console.log(`   - Signals: ${newEnrichment.micro.nearby_signals.slice(0, 3).join(', ')}${newEnrichment.micro.nearby_signals.length > 3 ? '...' : ''}`)

  const { error } = await supabase
    .from('business_locations')
    .update({ enrichment: newEnrichment })
    .eq('id', location.id)

  if (error) {
    console.error('❌ Failed to persist enrichment:', error.message)
    // Non-fatal: return location with new enrichment for current run
    return { ...location, enrichment: newEnrichment }
  }

  console.log('✅ Location enrichment persisted successfully')
  return { ...location, enrichment: newEnrichment }
}

/**
 * Fetches all data sources for a business in parallel.
 * 
 * Data sources:
 * - businesses: Core business info (name, category, location)
 * - business_profile: User-provided profile data
 * - website_analyses: AI-extracted website data
 * - media_assets: Uploaded images with AI labels
 * - social_accounts: Connected social media accounts
 * - third_party_evidence: Google Maps & Instagram data (conditional)
 * 
 * @param supabase - Supabase client instance
 * @param businessId - UUID of the business
 * @param allowThirdParty - Whether to fetch third-party evidence
 * @returns Promise<DataSources> - All gathered data
 */
export async function gatherDataSources(
  supabase: any, 
  businessId: string,
  allowThirdParty: boolean = false
): Promise<DataSources> {
  // Fetch all data in parallel for performance
  const [
    businessResult,
    locationResult,
    profileResult,
    websiteResult,
    imagesResult,
    socialResult,
    thirdPartyResult,
    operationsResult,
    locationIntelResult,
    menuResultsV2Result,
    existingBrandProfileResult,
    openingHoursResult,
    locationsCountResult
  ] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    supabase.from('business_locations').select('*').eq('business_id', businessId).eq('is_primary', true).maybeSingle(),
    supabase.from('business_profile').select('*').eq('business_id', businessId).maybeSingle(),
    supabase.from('website_analyses').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('media_assets').select('id, type, category_tags, ai_labels, is_hero').eq('business_id', businessId).limit(20),
    supabase.from('social_accounts').select('platform, handle, profile_url').eq('business_id', businessId).eq('is_connected', true),
    // Conditionally fetch third-party evidence
    allowThirdParty 
      ? supabase.from('third_party_evidence').select('*').eq('business_id', businessId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // Operations: establishment type + physical features that affect audience occasions
    supabase.from('business_operations').select('establishment_type, has_outdoor_seating, has_takeaway, has_table_service, has_english_menu, has_kids_menu').eq('business_id', businessId).maybeSingle(),
    // Rich location intelligence: category_scores, neighborhood, location_marketing_hooks, concept_fit_by_category
    supabase.from('business_location_intelligence').select('neighborhood, area_type, category_scores, location_marketing_hooks, concept_fit_by_category').eq('business_id', businessId).maybeSingle(),
    // menu_results_v2: AI helicopter summaries + structured data (always fetched in parallel)
    supabase.from('menu_results_v2').select('ai_summary, source_url, service_period_name, structured_data').eq('business_id', businessId).eq('status', 'done').order('created_at', { ascending: false }),
    // Existing brand profile — fetch sample_posts (Tier 1 tone signal) + business_character (WP2: seed for Prompt B)
    supabase.from('business_brand_profile').select('sample_posts, business_character').eq('business_id', businessId).maybeSingle(),
    // Opening hours — late-night closing is a critical bar/nightlife signal for Prompt A
    supabase.from('opening_hours').select('weekday, open_time, close_time').eq('business_id', businessId),
    // Physical location count (number of distinct branches)
    supabase.from('business_locations').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
  ])

  // Check for errors on all queries
  if (businessResult.error) {
    throw new Error(`Failed to fetch business: ${businessResult.error.message}`)
  }
  if (locationResult.error) {
    console.warn('⚠️ Failed to fetch business_locations (non-fatal):', locationResult.error.message)
  }
  if (profileResult.error) {
    console.warn('⚠️ Failed to fetch business_profile (non-fatal):', profileResult.error.message)
  }
  if (websiteResult.error) {
    console.warn('⚠️ Failed to fetch website_analyses (non-fatal):', websiteResult.error.message)
  }
  if (imagesResult.error) {
    console.warn('⚠️ Failed to fetch media_assets (non-fatal):', imagesResult.error.message)
  }
  if (socialResult.error) {
    console.warn('⚠️ Failed to fetch social_accounts (non-fatal):', socialResult.error.message)
  }
  if (thirdPartyResult.error) {
    console.warn('⚠️ Failed to fetch third_party_evidence (non-fatal):', thirdPartyResult.error.message)
  }
  if (operationsResult.error) {
    console.warn('⚠️ Failed to fetch business_operations (non-fatal):', operationsResult.error.message)
  }
  if (locationIntelResult.error) {
    console.warn('⚠️ Failed to fetch business_location_intelligence (non-fatal):', locationIntelResult.error.message)
  }
  if (menuResultsV2Result.error) {
    console.warn('⚠️ Failed to fetch menu_results_v2 (non-fatal):', menuResultsV2Result.error.message)
  }
  if (existingBrandProfileResult.error) {
    console.warn('⚠️ Failed to fetch existing brand profile sample_posts (non-fatal):', existingBrandProfileResult.error.message)
  }
  if (openingHoursResult.error) {
    console.warn('⚠️ Failed to fetch opening_hours (non-fatal):', openingHoursResult.error.message)
  }

  // Compute and persist location enrichment
  const location = await computeAndPersistEnrichment(supabase, locationResult.data)

  // Extract menu data from business_profile.menu_structure
  let menuItems = parseMenuStructure(profileResult.data?.menu_structure)
  
  // Fallback 2: menu_extractions table
  if (menuItems.length === 0) {
    console.log('⚠️  No menu_structure found in business_profile, checking menu_extractions...')
    
    const { data: menuExtractions, error: menuExtractionsError } = await supabase
      .from('menu_extractions')
      .select('extracted_data, menu_name')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    
    if (menuExtractionsError) {
      console.warn('⚠️ Failed to fetch menu_extractions:', menuExtractionsError.message)
    } else if (menuExtractions && menuExtractions.length > 0) {
      // Extract items from JSON structure: { categories: [{ name, items: [...] }] }
      for (const extraction of menuExtractions) {
        const data = extraction.extracted_data as any
        const categories = data?.categories || []
        
        for (const category of categories) {
          const items = category.items || []
          const categoryName = category.name || 'Øvrigt'
          
          for (const item of items) {
            menuItems.push({
              name: item.name,
              description: item.description || item.short_desc || null,
              price: item.price || null,
              category: categoryName,
              dietary: []
            })
          }
        }
      }
      console.log(`✅ Loaded ${menuItems.length} items from menu_extractions table`)
    } else {
      console.log('⚠️  No menu data found in menu_extractions either')
    }
  }

  // Fallback 3: profiles.business_offerings (the "Hvad vi tilbyder" setup section)
  // This is the richest source for businesses that filled in offerings manually.
  if (menuItems.length === 0 && businessResult.data?.owner_id) {
    console.log('⚠️  Checking profiles.business_offerings (Hvad vi tilbyder)...')
    const { data: profileRow, error: profilesError } = await supabase
      .from('profiles')
      .select('business_offerings')
      .eq('id', businessResult.data.owner_id)
      .maybeSingle()

    if (profilesError) {
      console.warn('⚠️ Failed to fetch profiles.business_offerings:', profilesError.message)
    } else if (profileRow?.business_offerings) {
      const offerings = typeof profileRow.business_offerings === 'string'
        ? JSON.parse(profileRow.business_offerings)
        : profileRow.business_offerings
      const categories: any[] = offerings?.categories || []
      for (const category of categories) {
        const items: any[] = category.items || []
        const categoryName = category.name || 'Øvrigt'
        for (const item of items) {
          if (!item.name) continue
          menuItems.push({
            name: item.name,
            description: item.short_desc || item.description || null,
            price: item.price || null,
            category: categoryName,
            dietary: []
          })
        }
      }
      if (menuItems.length > 0) {
        console.log(`✅ Loaded ${menuItems.length} items from profiles.business_offerings`)
      } else {
        console.log('⚠️  profiles.business_offerings exists but has no items')
      }
    }
  }

  // menu_results_v2: Single loop — ai_summary first (summaries + proof tokens), structured_data second (raw items if still needed)
  // ai_summary is always collected regardless of whether fallbacks 1-3 found raw items.
  // structured_data fills menuItems only if they are still empty after fallbacks 1-3.
  const menuSummaries: { title: string; summary: string }[] = []
  const aiSummaryItems: string[] = []
  let menuSource: 'ai_summary' | 'structured_data' | 'fallback' | 'none' =
    menuItems.length > 0 ? 'fallback' : 'none'

  const menuResultsV2Rows = menuResultsV2Result.data || []
  if (menuResultsV2Rows.length > 0) {
    for (const result of menuResultsV2Rows) {
      // --- ai_summary: helicopter view (always collect when present) ---
      if (result.ai_summary && typeof result.ai_summary === 'string' && result.ai_summary.trim().length > 0) {
        const rawPath = result.source_url
          ? (() => { try { return new URL(result.source_url).pathname.split('/').filter(Boolean).pop() || 'Menu' } catch { return 'Menu' } })()
          : 'Menu'
        const title = result.service_period_name || rawPath
        menuSummaries.push({ title, summary: result.ai_summary.trim() })

        // Extract bullet lines (strip • / – / - prefix) for proof tokens
        const bulletLines = result.ai_summary
          .split('\n')
          .map((line: string) => line.replace(/^[\s•\-\u2013]+/, '').trim())
          .filter((line: string) => line.length > 5)
        aiSummaryItems.push(...bulletLines)
      }

      // --- structured_data: raw menu items (only if menuItems still empty from fallbacks 1-3) ---
      if (menuItems.length === 0) {
        const rawData = result.structured_data
        const data: any = typeof rawData === 'string'
          ? (() => { try { return JSON.parse(rawData) } catch { return {} } })()
          : (rawData ?? {})
        const categories: any[] = data?.categories || []
        const periodLabel = result.service_period_name || null

        for (const category of categories) {
          const items: any[] = category.items || []
          const categoryName = category.name || periodLabel || 'Menu'
          for (const item of items) {
            if (!item.name) continue
            menuItems.push({
              name: item.name,
              description: item.description || item.short_desc || null,
              price: item.price || null,
              category: categoryName,
              dietary: []
            })
          }
        }
      }
    }

    if (menuSummaries.length > 0) {
      menuSource = 'ai_summary'
      console.log(`✅ Loaded ${menuSummaries.length} menu AI summaries from menu_results_v2 (${aiSummaryItems.length} bullet lines)`)
    }
    if (menuItems.length > 0 && menuSource === 'none') {
      menuSource = 'structured_data'
      console.log(`✅ Loaded ${menuItems.length} items from menu_results_v2 structured_data`)
    } else if (menuItems.length > 0) {
      console.log(`✅ Also have ${menuItems.length} structured menu items (source: ${menuSource})`)
    }
    if (menuSummaries.length === 0 && menuItems.length === 0) {
      console.log('⚠️  menu_results_v2 rows found but no usable ai_summary or structured_data')
    }
  } else {
    console.log('⚠️  No done rows in menu_results_v2')
  }

  // Parse third-party evidence if available
  let thirdPartyEvidence = undefined
  if (allowThirdParty && thirdPartyResult.data) {
    thirdPartyEvidence = {
      googleMaps: thirdPartyResult.data.google_maps_data || undefined,
      instagram: thirdPartyResult.data.instagram_data || undefined
    }
    console.log(`✅ Loaded third-party evidence: Google Maps (${thirdPartyEvidence.googleMaps?.photos?.length || 0} photos, ${thirdPartyEvidence.googleMaps?.reviews?.length || 0} review patterns), Instagram (${thirdPartyEvidence.instagram?.businessPosts?.length || 0} posts)`)
  }

  if (locationIntelResult.data) {
    console.log(`✅ Loaded location_intelligence: area_type=${locationIntelResult.data.area_type}, neighborhood=${locationIntelResult.data.neighborhood || '—'}, category_scores_keys=${Object.keys(locationIntelResult.data.category_scores || {}).join(', ') || 'none'}, marketing_hooks=${(locationIntelResult.data.location_marketing_hooks || []).length}`)
  }

  // Parse sample_posts from existing brand profile (Tier 1 tone signal, V2)
  let existingSamplePosts: Array<{ post_text: string; why_this_works?: string }> | null = null
  if (existingBrandProfileResult.data?.sample_posts) {
    const raw = existingBrandProfileResult.data.sample_posts
    const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return null } })() : raw
    if (Array.isArray(parsed) && parsed.length > 0) {
      existingSamplePosts = parsed.slice(0, 10) // Cap at 10 posts to control token usage
      console.log(`✅ Loaded ${existingSamplePosts.length} existing sample_posts as Tier 1 tone signal`)
    }
  }

  // Extract menu_signal.programmes from business_profile (WP1: operational programme signals)
  const menuSignalProgrammes: Array<{ role: string; timeContext: string | null; items: string[] }> | null =
    profileResult.data?.menu_signal?.programmes ?? null
  if (menuSignalProgrammes && menuSignalProgrammes.length > 0) {
    console.log(`✅ Loaded ${menuSignalProgrammes.length} menu_signal programmes:`, menuSignalProgrammes.map(p => p.role).join(', '))
  }

  // Extract existing business_character from brand profile (WP2: seed for Prompt A + B)
  const existingBusinessCharacter: string | null =
    existingBrandProfileResult.data?.business_character || null
  if (existingBusinessCharacter) {
    console.log(`✅ Loaded existing business_character (${existingBusinessCharacter.length} chars) as Prompt A seed`)
  }

  // Process opening hours rows (WP1: late-night signal for Prompt A)
  const openingHoursRows: Array<{ weekday: string; open_time: string; close_time: string }> =
    openingHoursResult.data || []
  if (openingHoursRows.length > 0) {
    console.log(`✅ Loaded ${openingHoursRows.length} opening_hours rows`)
  }

  return {
    business: businessResult.data,
    location,  // Includes enrichment (fresh or cached)
    profile: profileResult.data,
    menu: menuItems,
    images: imagesResult.data || [],
    websiteAnalysis: websiteResult.data,
    socialAccounts: socialResult.data || [],
    thirdPartyEvidence,
    operations: operationsResult.data || null,
    locationIntelligenceRow: locationIntelResult.data || null,
    menuSummaries: menuSummaries.length > 0 ? menuSummaries : null,
    aiSummaryItems: aiSummaryItems.length > 0 ? aiSummaryItems : null,
    menuSource,
    existingSamplePosts,
    menuSignalProgrammes,
    existingBusinessCharacter,
    openingHoursRows,
    locationsCount: locationsCountResult.count ?? 1
  }
}

/**
 * Builds a summary of menu data for prompts.
 * 
 * @param menu - Array of menu items
 * @param limit - Max items to include (default 15)
 * @returns Formatted menu summary string
 */
export function buildMenuSummary(menu: any[], limit: number = 15): string {
  if (menu.length === 0) {
    return 'No menu data available'
  }

  // Group by category to ensure representative spread across service periods
  const byCategory = new Map<string, any[]>()
  for (const item of menu) {
    const key = item.category || 'Øvrigt'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(item)
  }

  // Round-robin across categories until we hit limit
  const selected: any[] = []
  const categoryQueues = [...byCategory.values()]
  let round = 0
  while (selected.length < limit) {
    let added = false
    for (const queue of categoryQueues) {
      if (round < queue.length && selected.length < limit) {
        selected.push(queue[round])
        added = true
      }
    }
    if (!added) break
    round++
  }

  return selected.map(item => {
    let line = `- ${item.name}`
    if (item.description) line += `: ${item.description}`
    if (item.price) line += ` (${item.price})`
    if (item.category) line += ` [${item.category}]`
    return line
  }).join('\n')
}

/**
 * Builds a complete menu grouped by service period / category.
 * Deduplicates items by normalised name within each category.
 * Descriptions are truncated to 120 chars to control token usage.
 *
 * @param menu - Array of menu items
 * @returns Formatted full menu string
 */
export function buildFullMenuByCategory(menu: any[]): string {
  if (menu.length === 0) {
    return 'No menu data available'
  }

  // Group by category
  const byCategory = new Map<string, any[]>()
  for (const item of menu) {
    const key = item.category || 'Øvrigt'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(item)
  }

  const sections: string[] = []
  for (const [category, items] of byCategory) {
    // Deduplicate by normalised name (removes EN/DA duplicates with same name)
    const seen = new Set<string>()
    const unique = items.filter(item => {
      const key = String(item.name || '').toLowerCase().trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    const lines = unique.map(item => {
      let line = `  • ${item.name}`
      if (item.price) line += ` (${item.price})`
      if (item.description) {
        const desc = String(item.description).replace(/\n/g, ', ').trim()
        line += `: ${desc.length > 120 ? desc.slice(0, 120) + '…' : desc}`
      }
      return line
    })
    sections.push(`[${category}]\n${lines.join('\n')}`)
  }

  return sections.join('\n\n')
}

/**
 * Builds a lightweight menu type summary for understanding business type.
 * Focuses on categories and signature items only.
 * 
 * @param menu - Array of menu items
 * @returns Formatted business type summary
 */
export function buildMenuTypeSummary(menu: any[]): string {
  if (menu.length === 0) {
    return 'No menu data available'
  }
  
  // Extract unique categories
  const categories = [...new Set(menu.map(item => item.category).filter(Boolean))]
  
  // Find signature/premium items (highest priced or special categories)
  const prices = menu.map(item => item.price).filter(Boolean)
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
  
  const signatureItems = menu
    .filter(item => 
      item.price > avgPrice * 1.3 || // Premium items
      item.category?.toLowerCase().includes('special') ||
      item.category?.toLowerCase().includes('signatur')
    )
    .slice(0, 5)
  
  // Build summary
  let summary = `BUSINESS TYPE (based on menu):\n`
  summary += `Categories: ${categories.join(', ') || 'uncategorized'}\n`
  summary += `Total items: ${menu.length}\n`
  
  if (signatureItems.length > 0) {
    summary += `\nSignature/Premium items:\n`
    summary += signatureItems.map(item => 
      `- ${item.name}${item.category ? ` [${item.category}]` : ''}`
    ).join('\n')
  }
  
  return summary
}

/**
 * Builds a summary of uploaded images for prompts.
 * 
 * @param images - Array of media assets
 * @param limit - Max items to include (default 5)
 * @returns Formatted images summary string
 */
export function buildImagesSummary(images: any[], limit: number = 5): string {
  if (images.length === 0) {
    return 'No images uploaded'
  }
  
  return images.slice(0, limit).map(img => {
    const labels = img.ai_labels 
      ? Object.values(img.ai_labels).flat().slice(0, 5).join(', ') 
      : 'no labels'
    const tags = img.category_tags ? img.category_tags.join(', ') : ''
    return `- ${img.type}${img.is_hero ? ' (HERO)' : ''}: ${labels}${tags ? ` [${tags}]` : ''}`
  }).join('\n')
}

/**
 * Builds a summary of connected social accounts for prompts.
 * 
 * @param socialAccounts - Array of social account objects
 * @returns Formatted social accounts summary string
 */
export function buildSocialSummary(socialAccounts: any[]): string {
  if (socialAccounts.length === 0) {
    return 'No social accounts connected'
  }
  
  return socialAccounts.map(acc => 
    `- ${acc.platform}: ${acc.handle || acc.profile_url || 'connected'}`
  ).join('\n')
}
