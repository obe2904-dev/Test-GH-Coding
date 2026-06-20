/**
 * V5 PROFILE TO ACTIVATION ENGINE ADAPTER
 * 
 * Transforms V5 Brand Profile segments into ActivationEngine input format
 */

import type { BrandSegment } from '../types/activation-types.ts';
import type { V5BrandProfile } from '../../brand-profile/types-v5.ts';

/**
 * Transform V5 programme profiles into BrandSegments for activation engine
 */
export function transformV5ToActivationSegments(v5Profile: V5BrandProfile): BrandSegment[] {
  const segments: BrandSegment[] = [];
  
  if (!v5Profile.programmes || v5Profile.programmes.length === 0) {
    console.warn('[V5Adapter] No programmes found in V5 profile');
    return segments;
  }
  
  for (const programme of v5Profile.programmes) {
    const programmeType = programme.programme_type; // "brunch", "lunch", "dinner", "bar"
    const programmeName = programme.programme_name || programmeType; // "Frokost", "Brunch", etc.
    
    if (!programme.audience_segments || programme.audience_segments.length === 0) {
      console.warn(`[V5Adapter] No audience segments for programme: ${programmeName}`);
      continue;
    }
    
    for (const segment of programme.audience_segments) {
      // Map V5 segment to BrandSegment interface
      const brandSegment: BrandSegment = {
        segment_name: segment.label,
        programme_type: programmeType,
        programme_name: programmeName,
        
        // Timing windows (already in string format)
        timing_windows: segment.timing_windows || [],
        
        // Content angles (already in array format)
        content_angles: segment.content_angles || [],
        
        // Priority/size mapping
        segment_size: segment.segment_size || 'secondary',
        
        // Motivation mapping - normalize to standard values
        motivation: normalizeMotivation(segment.motivation),
        
        // Decision timing mapping
        decision_timing: segment.decision_timing || 'mixed',
        
        // Goal contribution mapping
        goal_contribution: segment.goal_contribution || 'drive_footfall',
        
        // Evidence (optional)
        evidence: segment.evidence || [],
      };
      
      segments.push(brandSegment);
    }
  }
  
  console.log(`[V5Adapter] Transformed ${segments.length} segments from ${v5Profile.programmes.length} programmes`);
  return segments;
}

/**
 * Normalize motivation to standard values
 */
function normalizeMotivation(motivation: string | undefined): string {
  if (!motivation) return 'convenience';
  
  const lowerMotivation = motivation.toLowerCase();
  
  // Map V5 values to activation engine standard values
  if (lowerMotivation.includes('social')) return 'social_gathering';
  if (lowerMotivation.includes('convenience')) return 'convenience';
  if (lowerMotivation.includes('experience')) return 'experience_seeking';
  if (lowerMotivation.includes('routine')) return 'routine';
  
  // Default
  return lowerMotivation;
}

/**
 * Extract offerings list from V5 profile
 */
export function extractOfferings(v5Profile: V5BrandProfile): string[] {
  if (!v5Profile.programmes) return [];
  
  return v5Profile.programmes
    .map(p => p.programme_name || p.programme_type)
    .filter((name, index, self) => self.indexOf(name) === index); // unique
}

/**
 * Extract features list from V5 profile
 * (This might need to come from business_operations or other sources)
 */
export function extractFeatures(businessOperations: any): string[] {
  const features: string[] = [];
  
  if (!businessOperations) return features;
  
  if (businessOperations.has_outdoor_seating) features.push('outdoor_seating');
  if (businessOperations.has_takeaway) features.push('takeaway');
  if (businessOperations.has_kids_menu) features.push('børnemenu');
  if (businessOperations.has_delivery) features.push('delivery');
  if (businessOperations.has_table_service) features.push('table_service');
  if (businessOperations.has_wifi) features.push('wifi');
  if (businessOperations.has_parking) features.push('parking');
  
  return features;
}
