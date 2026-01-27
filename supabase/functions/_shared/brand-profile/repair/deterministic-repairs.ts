/**
 * Deterministic Repairs
 * 
 * Post-processing repairs that fix structural issues before validation.
 * v4.10.0 Phase 1: Uses auto-repair formatters instead of template replacement.
 */

import type { DataSources } from '../types.ts'
import type { LocaleConfig } from '../locales.ts'
import { buildBrandEssenceFallback, buildSignatureShotFallback, buildToneOfVoiceFallback, buildContentFocusFallback, removeBannedWords } from '../fallbacks.ts'
import { extractBrandEssenceConstraints, validateBrandEssence, buildConstrainedBrandEssence } from '../constraints/brand-essence-constraints.ts'
import { formatAndRepairProfile, type FormatContext } from './auto-repair-formatters.ts'

export function applyDeterministicRepairs(sections: any, dataSources: any, analysis: any, language: string, locale: LocaleConfig): any {
  // Create fallback context for robust fallbacks
  const fallbackCtx = {
    dataSources,
    analysis,
    locale,
    errors: (globalThis as any).requestErrors  // Global error collector
  }
  
  // Extract canonical location and venue type
  const location = dataSources?.location || {}
  const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront' ? (locale.preferredPhrasing['location_waterfront'] || 'ved åen')
    : location?.enrichment?.micro?.area_type === 'transit_hub' ? (locale.preferredPhrasing['location_transit'] || 'ved stationen')
    : location?.enrichment?.micro?.area_type === 'shopping_street' ? (locale.preferredPhrasing['location_shopping'] || 'på gågaden')
    : ''
  const city = location?.enrichment?.macro?.city || dataSources?.business?.city || 'byen'
  const canonicalLocationHook = locationPhrase ? `${locationPhrase} ${locale.preferredPhrasing['location_city'] || 'i'} ${city}` : city
  
  const business = dataSources?.business || {}
  const rawVenueType = business?.vertical || business?.business_category || 'restaurant'
  const venueType = locale.venueTypes[rawVenueType.toLowerCase()] || rawVenueType

  // Build context for auto-repair formatters
  const formatCtx: FormatContext = {
    locationHook: canonicalLocationHook,
    offeringTokens: extractOfferingTokens(dataSources),
    actionVerbs: ['skåler', 'spiser', 'hælder op', 'serverer', 'deler', 'skærer', 'nyder'],
    menuItems: extractMenuItems(dataSources),
    ctaTokens: extractCtaTokens(dataSources)
  }

  // 1. Remove banned words from ALL text fields (locale-aware)
  const removeWords = (text: string) => removeBannedWords(text, locale)
  
  if (sections?.tone_of_voice?.value) {
    sections.tone_of_voice.value = removeWords(sections.tone_of_voice.value)
  }
  if (sections?.target_audience?.value) {
    sections.target_audience.value = removeWords(sections.target_audience.value)
  }
  if (sections?.brand_essence?.value) {
    sections.brand_essence.value = removeWords(sections.brand_essence.value)
  }
  if (sections?.core_offerings?.value) {
    sections.core_offerings.value = removeWords(sections.core_offerings.value)
  }
  if (sections?.content_focus?.value) {
    sections.content_focus.value = removeWords(sections.content_focus.value)
  }
  
  if (sections?.cta_style?.value) {
    sections.cta_style.value = removeWords(sections.cta_style.value)
  }

  // 2. Apply auto-repair formatters (v4.10.0 Phase 1: NEW - inject missing components)
  console.log(`🔧 Applying auto-repair formatters...`)
  const repairResult = formatAndRepairProfile(sections, formatCtx)
  sections = repairResult.profile
  
  if (repairResult.repairs.length > 0) {
    console.log(`✅ Auto-repairs applied:`)
    repairResult.repairs.forEach(r => console.log(`   - ${r}`))
  }
  
  if (repairResult.warnings.length > 0) {
    console.log(`⚠️  Auto-repair warnings:`)
    repairResult.warnings.forEach(w => console.log(`   - ${w}`))
  }

  // 3. Force content_focus to cover 3 areas (food/service, atmosphere/interior, moments/transitions)
  if (sections?.content_focus?.value) {
    const cf = sections.content_focus.value.toLowerCase()
    const hasFoodService = /mad|service|food|retter|menu|essen/i.test(cf)
    const hasAtmosphere = /stemning|atmosf[æä]re|interiør|interior|atmosphere/i.test(cf)
    const hasMoments = /folk|øjeblikke|moments|overgange|transitions|menschen|momente/i.test(cf)
    
    if (!hasFoodService || !hasAtmosphere || !hasMoments) {
      console.log(`⚠️ content_focus missing 3 required areas, applying robust fallback`)
      const fallbackResult = buildContentFocusFallback(fallbackCtx)
      sections.content_focus.value = fallbackResult.value
    }
  }

  // 4. Fallback for brand_essence if auto-repair didn't work (last resort)
  if (sections?.brand_essence?.value) {
    const constraints = extractBrandEssenceConstraints(dataSources)
    const validationResult = validateBrandEssence(sections.brand_essence.value, constraints)
    
    if (!validationResult.valid) {
      console.log(`⚠️ brand_essence still invalid after auto-repair: ${validationResult.errors.join(', ')}`)
      console.log(`🔧 Applying constraint-first template fallback`)
      sections.brand_essence.value = buildConstrainedBrandEssence(constraints)
    }
  } else {
    // No brand_essence generated at all - use constraint-first fallback
    console.log(`⚠️ brand_essence missing entirely, applying constraint-first fallback`)
    const constraints = extractBrandEssenceConstraints(dataSources)
    sections.brand_essence.value = buildConstrainedBrandEssence(constraints)
  }

  // 5. Fallback for signature_shot if auto-repair didn't work (removed old check)
  // Auto-repair handles this in formatAndRepairProfile above

  // 6. Auto-fill missing content_pillars notes (Fix #4 - ensure non-empty)
  if (Array.isArray(sections?.content_pillars)) {
    sections.content_pillars = sections.content_pillars.map((p: any) => {
      if (!p || typeof p !== 'object') return p
      if (p.encouraged !== true) return p
      
      const notes = typeof p.notes === 'string' ? p.notes.trim() : ''
      
      // Ensure notes is always non-empty string
      if (!notes) {
        const nextNotes = `Bygger på ${canonicalLocationHook} (#1)`
        return { ...p, notes: nextNotes }
      }
      
      // Ensure it has hook number OR location ref
      const hasHookNumber = /#\d+/.test(notes)
      const hasLocationRef = canonicalLocationHook && notes.toLowerCase().includes(canonicalLocationHook.toLowerCase())
      
      if (!hasHookNumber && !hasLocationRef) {
        const nextNotes = `${notes} (#1, ${canonicalLocationHook})`
        return { ...p, notes: nextNotes }
      }
      return p
    })
  }

  return sections
}

/**
 * Helper: Extract offering tokens from data sources
 */
function extractOfferingTokens(dataSources: any): string[] {
  const menu = dataSources?.menu || []
  const topItems = menu
    .filter((item: any) => item.name && item.name.length > 3)
    .slice(0, 5)
    .map((item: any) => item.name.toUpperCase())
  
  // Prefer BRUNCH > MIDDAG > COCKTAILS if present
  const priority = ['BRUNCH', 'MIDDAG', 'COCKTAILS', 'FROKOST', 'AFTEN']
  const sorted = [...topItems].sort((a, b) => {
    const aIdx = priority.findIndex(p => a.includes(p))
    const bIdx = priority.findIndex(p => b.includes(p))
    if (aIdx === -1 && bIdx === -1) return 0
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })
  
  return sorted.length > 0 ? sorted : ['MAD']
}

/**
 * Helper: Extract menu items (lowercase, natural form)
 */
function extractMenuItems(dataSources: any): string[] {
  const menu = dataSources?.menu || []
  return menu
    .filter((item: any) => item.name && item.name.length > 3)
    .slice(0, 8)
    .map((item: any) => item.name.toLowerCase())
}

/**
 * Helper: Extract CTA tokens from website analysis
 */
function extractCtaTokens(dataSources: any): string[] {
  const websiteAnalysis = dataSources?.websiteAnalysis
  return websiteAnalysis?.cta_texts || []
}
