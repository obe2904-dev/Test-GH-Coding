// V5 Data Fetchers
// Fetch Layer 3 (Identity) and Layer 4 (Segments) from database

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { IdentityProfile, ProgrammeProfile } from '../../../../src/types/brand-profile-v5.ts'
import { logV5 } from '../config/v5-flags.ts'

/**
 * Fetch V5 Layer 3 (Identity Profile) from business_brand_profile
 * 
 * @param supabase - Supabase client
 * @param businessId - Business UUID
 * @returns Identity profile or null if not found/incomplete
 */
export async function fetchV5IdentityProfile(
  supabase: SupabaseClient,
  businessId: string
): Promise<IdentityProfile | null> {
  try {
    logV5('fetch-layer3', { businessId })
    
    const { data, error } = await supabase
      .from('business_brand_profile')
      .select('brand_essence, positioning, core_values, what_makes_us_different, identity_confidence, identity_reasoning')
      .eq('business_id', businessId)
      .maybeSingle()
    
    if (error) {
      logV5('fetch-layer3-error', { businessId, error: error.message })
      return null
    }
    
    if (!data) {
      logV5('fetch-layer3-not-found', { businessId })
      return null
    }
    
    // Validate required fields
    const required = ['brand_essence', 'positioning', 'core_values', 'what_makes_us_different']
    const missing = required.filter(field => !data[field])
    
    if (missing.length > 0) {
      logV5('fetch-layer3-incomplete', { 
        businessId, 
        missingFields: missing,
        completeness: `${required.length - missing.length}/${required.length}`
      })
      return null
    }
    
    logV5('fetch-layer3-success', {
      businessId,
      confidence: data.identity_confidence
    })
    
    // Note: local_location_reference will be fetched from business_location_intelligence when needed
    return {
      brand_essence: data.brand_essence,
      positioning: data.positioning,
      core_values: data.core_values,
      what_makes_us_different: data.what_makes_us_different,
      identity_confidence: data.identity_confidence || 0.8,
      identity_reasoning: data.identity_reasoning,
      local_location_reference: await (async () => {
        const { data: locIntel } = await supabase
          .from('business_location_intelligence')
          .select('local_location_reference')
          .eq('business_id', businessId)
          .maybeSingle()
        return locIntel?.local_location_reference ?? undefined
      })()
    }
  } catch (err) {
    logV5('fetch-layer3-exception', { 
      businessId, 
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

/**
 * Fetch V5 Layer 4 (Programme Profiles) from business_programme_profiles
 * 
 * @param supabase - Supabase client
 * @param businessId - Business UUID
 * @param programmeTypeFilter - Optional filter for specific programme type
 * @returns Array of programme profiles with segments
 */
export async function fetchV5ProgrammeProfiles(
  supabase: SupabaseClient,
  businessId: string,
  programmeTypeFilter?: string
): Promise<ProgrammeProfile[]> {
  try {
    logV5('fetch-layer4', { businessId, programmeTypeFilter })
    
    let query = supabase
      .from('business_programme_profiles')
      .select('programme_type, programme_name, audience_segments, segment_confidence, segment_reasoning')
      .eq('business_id', businessId)
    
    if (programmeTypeFilter) {
      query = query.eq('programme_type', programmeTypeFilter)
    }
    
    const { data, error } = await query
    
    if (error) {
      logV5('fetch-layer4-error', { businessId, error: error.message })
      return []
    }
    
    if (!data || data.length === 0) {
      logV5('fetch-layer4-not-found', { businessId })
      return []
    }
    
    // Filter out programmes without segments
    const profiles = data
      .filter(p => p.audience_segments && Array.isArray(p.audience_segments) && p.audience_segments.length > 0)
      .map(p => ({
        programme_type: p.programme_type,
        programme_name: p.programme_name,
        audience_segments: p.audience_segments,
        segment_confidence: p.segment_confidence,
        segment_reasoning: p.segment_reasoning
      }))
    
    const totalSegments = profiles.reduce((sum, p) => sum + p.audience_segments.length, 0)
    
    logV5('fetch-layer4-success', {
      businessId,
      programmesFound: profiles.length,
      totalSegments,
      averageConfidence: profiles.reduce((sum, p) => sum + (p.segment_confidence || 0), 0) / profiles.length
    })
    
    return profiles
  } catch (err) {
    logV5('fetch-layer4-exception', { 
      businessId, 
      error: err instanceof Error ? err.message : String(err)
    })
    return []
  }
}

/**
 * Fetch complete V5 profile (Layer 3 + Layer 4)
 * 
 * @param supabase - Supabase client
 * @param businessId - Business UUID
 * @returns Object with identity and programmes, or null if Layer 3 missing
 */
export async function fetchCompleteV5Profile(
  supabase: SupabaseClient,
  businessId: string
): Promise<{
  identity: IdentityProfile
  programmes: ProgrammeProfile[]
} | null> {
  const identity = await fetchV5IdentityProfile(supabase, businessId)
  
  if (!identity) {
    logV5('fetch-complete-missing-layer3', { businessId })
    return null
  }
  
  const programmes = await fetchV5ProgrammeProfiles(supabase, businessId)
  
  logV5('fetch-complete-success', {
    businessId,
    hasProgrammes: programmes.length > 0
  })
  
  return {
    identity,
    programmes
  }
}

/**
 * Build Layer 3 identity section for prompts
 * Formats identity data for AI consumption
 * 
 * @param identity - Identity profile
 * @returns Formatted prompt section
 */
export function buildV5IdentitySection(identity: IdentityProfile): string {
  const sections = []
  
  sections.push('=== BRAND IDENTITY (Layer 3 - Verified) ===\n')
  
  sections.push(`Brand Essence:\n${identity.brand_essence}\n`)
  
  sections.push(`Positioning:\n${identity.positioning}\n`)
  
  sections.push('Core Values:')
  identity.core_values.forEach((value, i) => {
    sections.push(`${i + 1}. ${value}`)
  })
  sections.push('')
  
  sections.push(`What Makes Us Different:\n${identity.what_makes_us_different}\n`)
  
  if (identity.local_location_reference) {
    sections.push(`CRITICAL - Location Reference:\nALWAYS use: "${identity.local_location_reference}"\nNEVER add extra geographic specificity.\n`)
  }
  
  sections.push(`Identity Confidence: ${Math.round(identity.identity_confidence * 100)}%`)
  
  return sections.join('\n')
}

/**
 * Build Layer 4 audience section for prompts
 * Formats segment data for AI consumption
 * 
 * @param programmes - Programme profiles
 * @param currentDay - Current day of week (0-6)
 * @param currentHour - Current hour (0-23)
 * @returns Formatted prompt section
 */
export function buildV5AudienceSection(
  programmes: ProgrammeProfile[],
  currentDay?: number,
  currentHour?: number
): string {
  const sections = []
  
  sections.push('=== AUDIENCE SEGMENTS (Layer 4 - Programme-Specific) ===\n')
  
  for (const prog of programmes) {
    sections.push(`Programme: ${prog.programme_name} (${prog.programme_type})`)
    
    if (prog.audience_segments.length === 0) {
      sections.push('  No segments defined\n')
      continue
    }
    
    for (const segment of prog.audience_segments) {
      sections.push(`\n  Segment: ${segment.label}`)
      sections.push(`  Size: ${segment.segment_size}`)
      sections.push(`  Timing: ${segment.timing_windows.join(', ')}`)
      sections.push(`  Motivation: ${segment.motivation}`)
      sections.push(`  Decision: ${segment.decision_timing}`)
      sections.push(`  Goal: ${segment.goal_contribution}`)
      
      sections.push(`  Content Angles:`)
      segment.content_angles.forEach(angle => {
        sections.push(`    - ${angle}`)
      })
      
      if (segment.evidence && segment.evidence.length > 0) {
        sections.push(`  Evidence:`)
        segment.evidence.forEach(ev => {
          sections.push(`    ✓ ${ev}`)
        })
      }
    }
    
    sections.push('')
  }
  
  return sections.join('\n')
}
