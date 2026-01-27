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
    thirdPartyResult
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
      : Promise.resolve({ data: null, error: null })
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

  // Compute and persist location enrichment
  const location = await computeAndPersistEnrichment(supabase, locationResult.data)

  // Extract menu data from business_profile.menu_structure
  let menuItems = parseMenuStructure(profileResult.data?.menu_structure)
  
  // Fallback: if menu_structure is empty, try menu_extractions table
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

  // Parse third-party evidence if available
  let thirdPartyEvidence = undefined
  if (allowThirdParty && thirdPartyResult.data) {
    thirdPartyEvidence = {
      googleMaps: thirdPartyResult.data.google_maps_data || undefined,
      instagram: thirdPartyResult.data.instagram_data || undefined
    }
    console.log(`✅ Loaded third-party evidence: Google Maps (${thirdPartyEvidence.googleMaps?.photos?.length || 0} photos, ${thirdPartyEvidence.googleMaps?.reviews?.length || 0} review patterns), Instagram (${thirdPartyEvidence.instagram?.businessPosts?.length || 0} posts)`)
  }

  return {
    business: businessResult.data,
    location,  // Includes enrichment (fresh or cached)
    profile: profileResult.data,
    menu: menuItems,
    images: imagesResult.data || [],
    websiteAnalysis: websiteResult.data,
    socialAccounts: socialResult.data || [],
    thirdPartyEvidence
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
  
  return menu.slice(0, limit).map(item => {
    let line = `- ${item.name}`
    if (item.description) line += `: ${item.description}`
    if (item.price) line += ` (${item.price})`
    if (item.category) line += ` [${item.category}]`
    return line
  }).join('\n')
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
