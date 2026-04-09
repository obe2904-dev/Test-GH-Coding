/**
 * Proof-token building utilities.
 * Extracted from validators.ts (v4.14.0).
 */

import type { DataSources } from './types.ts'
import { extractStructuredWebsiteData } from './signal-extractor.ts'

/**
 * Build ALLOWED_PROOF_TOKENS for proof grounding validation (v4.9.0 Phase 2)
 * Extracted from validateBrandProfileOutput for reuse in proof-grounding.ts
 * 
 * MUST match the token extraction logic in Prompt B to ensure consistency
 * 
 * v4.10.0 Phase 1: Expanded to include ALL CTA tokens (not just primary)
 */
export function buildAllowedProofTokens(analysis: any, dataSources?: DataSources): string[] {
  const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ')
  
  // Get location-based proof tokens
  const locationData = (dataSources as any)?.location
  const locationPhraseProof = locationData?.enrichment?.micro?.area_type === 'waterfront' ? 'ved åen'
    : locationData?.enrichment?.micro?.area_type === 'transit_hub' ? 'ved stationen'
    : locationData?.enrichment?.micro?.area_type === 'shopping_street' ? 'på gågaden'
    : ''
  const cityProof = locationData?.enrichment?.macro?.city || ''
  const canonicalLocationHook = locationPhraseProof && cityProof ? `${locationPhraseProof} i ${cityProof}` : ''
  
  // Get menu/CTA anchors from analysis (must match Prompt B extraction logic)
  const menuAnchors = analysis?.signals?.core_offerings?.must_use_phrases || []
  const topMenuItems = ((dataSources as any)?.menu || [])
    .filter((item: any) => item.name && item.name.length > 3)
    .slice(0, 6)
    .map((item: any) => item.name)
  
  const ctaAnchors = analysis?.signals?.cta_anchors?.must_use_phrases || []
  
  // Get ALL CTA texts from website analysis (v4.10.0: expanded from just primary)
  const websiteAnalysis = (dataSources as any)?.websiteAnalysis
  const allCtaTexts = websiteAnalysis?.cta_texts || []
  
  // Also include headers as they often contain key phrases
  const headers = websiteAnalysis?.headers || []
  
  // v4.11.1: Add hook LABELS from Prompt A (not just evidence quotes)
  // AI often references hooks by label (e.g., "Distinctive hook #1: Dining by the river")
  // instead of quoting the exact Danish evidence ("ved åen i Aarhus")
  const hookLabels: string[] = []
  const addHookLabels = (items: any[], labelKey: string) => {
    if (!Array.isArray(items)) return
    items.slice(0, 8).forEach((item: any) => {
      const label = String(item?.[labelKey] || '').trim()
      if (label && label.length > 3) hookLabels.push(label)
      // Also add the evidence quote if different from label
      const evidence = String(item?.evidence || '').trim()
      if (evidence && evidence !== label && evidence.length > 3) hookLabels.push(evidence)
    })
  }
  
  addHookLabels(analysis?.distinctive_hooks || [], 'hook')
  addHookLabels(analysis?.physical_space_cues || [], 'cue')
  addHookLabels(analysis?.rituals_and_moments || [], 'moment')
  addHookLabels(analysis?.local_identity_cues || [], 'cue')
  addHookLabels(analysis?.copy_patterns || [], 'pattern')
  
  // v4.11.1: Also add usage occasion IDs (e.g., "brunch-to-work", "dinner-to-drinks")
  const usageOccasionIds = (analysis?.usage_occasions || [])
    .map((uo: any) => String(uo?.id || '').trim())
    .filter(Boolean)
  
  // v4.11.2: Add content trigger NAMES (e.g., "Waterfront Dining Experience")
  // AI references these by name in proof like "Based on content trigger 'X'"
  const contentTriggerNames = (analysis?.content_triggers || [])
    .map((ct: any) => String(ct?.trigger || '').trim())
    .filter((name: string) => name.length > 3)
  
  const finalTokens = [
    canonicalLocationHook,
    ...allCtaTexts, // All CTAs (including "BOOK DIT BORD", "BOOK BORD", etc.)
    ...ctaAnchors,
    ...menuAnchors,
    ...topMenuItems,
    ...headers.slice(0, 3), // Top 3 headers
    locationPhraseProof, // Also include just the phrase without city
    cityProof,
    ...hookLabels, // v4.11.1: Hook labels and evidence from Prompt A
    ...usageOccasionIds, // v4.11.1: Usage occasion IDs
    ...contentTriggerNames // v4.11.2: Content trigger names
  ].filter(Boolean).map(t => normalize(t))
  
  // v4.11.2: Debug logging to verify all expansions are included
  console.log(`🔧 v4.11.2 Proof tokens: ${finalTokens.length} total (${hookLabels.length} hooks, ${usageOccasionIds.length} occasions, ${contentTriggerNames.length} triggers)`)
  
  // Ensure we return at least one token for downstream validators/tests
  if (finalTokens.length === 0) {
    finalTokens.push('generic')
  }

  return finalTokens
}

/**
 * Build normalized reference pool from Prompt A analysis
 */
export function buildNormalizedRefs(analysis: any): string[] {
  const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ')
  
  const referencePool: string[] = []
  
  // Add hook tokens (support both structured and legacy top-level shapes)
  const hookTokens: Array<{ original: string; normalized: string }> = []
  const structuredHooks = analysis?.structured?.distinctive_hooks || analysis?.distinctive_hooks || []
  for (const hook of structuredHooks) {
    if (hook?.hook_text) hookTokens.push({ original: hook.hook_text, normalized: normalize(hook.hook_text) })
    if (hook?.hook) hookTokens.push({ original: hook.hook, normalized: normalize(hook.hook) })
    if (hook?.location) hookTokens.push({ original: hook.location, normalized: normalize(hook.location) })
    if (hook?.offering) hookTokens.push({ original: hook.offering, normalized: normalize(hook.offering) })
    if (hook?.reference) hookTokens.push({ original: hook.reference, normalized: normalize(hook.reference) })
  }

  // Add menu/CTA anchors (support structured or top-level)
  if (analysis?.structured?.menu_anchors) {
    referencePool.push(...analysis.structured.menu_anchors)
  } else if (analysis?.menu_anchors) {
    referencePool.push(...analysis.menu_anchors)
  }
  if (analysis?.structured?.cta_anchors) {
    referencePool.push(...analysis.structured.cta_anchors)
  } else if (analysis?.cta_anchors) {
    referencePool.push(...analysis.cta_anchors)
  }

  // Add content_triggers references and names (legacy and structured)
  if (Array.isArray(analysis?.content_triggers)) {
    for (const ct of analysis.content_triggers) {
      if (ct?.reference) referencePool.push(ct.reference)
      if (ct?.trigger) referencePool.push(ct.trigger)
    }
  }
  
  // Add hook tokens
  referencePool.push(...hookTokens.map(t => t.original))
  
  // Keep short numeric references like #1, #2 even if shorter than 4 chars
  return Array.from(new Set(referencePool.map(normalize))).filter(r => {
    if (!r) return false
    if (/^#\d+$/.test(r)) return true
    return r.length >= 4
  })
}

