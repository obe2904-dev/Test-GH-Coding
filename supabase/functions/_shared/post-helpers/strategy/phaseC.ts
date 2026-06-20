/**
 * PHASE C: CONTENT TYPE ALLOCATION
 *
 * Assigns analytics content_type tags (PRODUCT/EXPERIENCE/OCCASION/RETENTION)
 * to strategic angles based on:
 * - Programme-specific commercial goal splits
 * - Historical type mix (staleness + drift correction)
 * - Target distribution from contentTypeSystem
 *
 * NOTE: content_type is for analytics tracking only.
 * Template routing uses content_category (assigned in Phase 1/2a).
 */

import type { StrategicBrief } from '../types/strategy-types.ts';
import { allocateContentTypes, DEFAULT_TYPE_MIX } from '../../contentTypeSystem.ts';
import { getTypeAnalytics } from '../../contentTypeTracking.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface TypeAllocation {
  content_type: string;
  type_rationale: string;
}

/**
 * Phase C: Allocate analytics content_type tags to strategic angles
 * 
 * @param strategicBrief - Strategic angles from Phase 1
 * @param supabase - Supabase client
 * @param businessId - Business ID for fetching type analytics
 * @param businessProgrammes - Programme profiles from context
 * @param brandProfile - Brand profile data for target mix
 * @returns Array of type allocations (one per angle)
 */
export async function allocateTypesToPosts(
  strategicBrief: StrategicBrief,
  supabase: SupabaseClient,
  businessId: string,
  businessProgrammes: any[],
  brandProfile: any
): Promise<TypeAllocation[]> {
  console.log('\n🎯 [PHASE C] Starting content type allocation...');
  
  try {
    // Get target type mix from brand profile
    const targetTypeMix = brandProfile?.target_type_mix 
      ? {
          product: brandProfile.target_type_mix.product ?? DEFAULT_TYPE_MIX.product,
          experience: brandProfile.target_type_mix.experience ?? DEFAULT_TYPE_MIX.experience,
          occasion: brandProfile.target_type_mix.occasion ?? DEFAULT_TYPE_MIX.occasion,
          retention: brandProfile.target_type_mix.retention ?? DEFAULT_TYPE_MIX.retention,
        }
      : { ...DEFAULT_TYPE_MIX };
    
    // Get type analytics (8-week drift + staleness)
    const typeAnalytics = await getTypeAnalytics(supabase, businessId, targetTypeMix);
    
    // Build programme goal_split map (NOT just dominant mode - full split for weighted allocation)
    const programmeGoalSplits: Record<string, any> = {};
    
    console.log('[Phase C Setup DEBUG] business_programmes:', {
      type: typeof businessProgrammes,
      isArray: Array.isArray(businessProgrammes),
      length: businessProgrammes.length,
      sample: businessProgrammes[0] ? {
        type: businessProgrammes[0].programme_type,
        name: businessProgrammes[0].programme_name,
        has_split: !!businessProgrammes[0].baseline_goal_split,
        split: businessProgrammes[0].baseline_goal_split
      } : 'empty'
    });
    
    businessProgrammes.forEach((prog: any) => {
      if (prog.programme_type && prog.baseline_goal_split) {
        // Store the FULL goal_split object, not just dominant mode
        programmeGoalSplits[prog.programme_type] = prog.baseline_goal_split;
        if (prog.programme_name) {
          programmeGoalSplits[prog.programme_name] = prog.baseline_goal_split;
        }
        console.log(`[Phase C Setup] Registered programme: type="${prog.programme_type}", name="${prog.programme_name}"`);
      }
    });

    // Build an 'all_day' fallback: weighted average across all active programmes.
    // This covers angles that aren't tied to a specific meal period (atmosphere,
    // team, loyalty, events) so they still receive the full goal-split weighting
    // rather than collapsing to a single dominant mode.
    const splitsWithData = businessProgrammes.filter((p: any) => p.baseline_goal_split);
    if (splitsWithData.length > 0) {
      const count = splitsWithData.length;
      programmeGoalSplits['all_day'] = {
        drive_footfall: Math.round(splitsWithData.reduce((sum: number, p: any) => sum + (p.baseline_goal_split.drive_footfall || 0), 0) / count),
        strengthen_brand: Math.round(splitsWithData.reduce((sum: number, p: any) => sum + (p.baseline_goal_split.strengthen_brand || 0), 0) / count),
        retain_regulars: Math.round(splitsWithData.reduce((sum: number, p: any) => sum + (p.baseline_goal_split.retain_regulars || 0), 0) / count),
      };
      console.log('[Phase C Setup] all_day fallback split:', JSON.stringify(programmeGoalSplits['all_day']));
    }

    console.log('[Phase C Setup] Available programme keys:', Object.keys(programmeGoalSplits).join(', '));
    
    console.log('[Phase C Setup] Programme goal splits:', 
      Object.entries(programmeGoalSplits).map(([prog, split]) => {
        const footfall = Math.round((split as any).drive_footfall || 0);
        const brand = Math.round((split as any).strengthen_brand || 0);
        const retention = Math.round((split as any).retain_regulars || 0);
        return `${prog}: ${footfall}% footfall, ${brand}% brand, ${retention}% retention`;
      }).join('; ')
    );
    
    // Parse analytics for allocator
    const stalenessData = typeAnalytics.staleness.map((s: any) => ({
      type: s.type,
      lastUsed: s.last_used,
      daysSince: s.days_since,
      priority: parseFloat(s.staleness_priority),
    }));
    
    const driftData = typeAnalytics.drift.map((d: any) => ({
      type: d.type,
      target: parseFloat(d.target_pct) / 100,
      actual: parseFloat(d.actual_pct) / 100,
      drift: parseFloat(d.drift_pct) / 100,
      correction: parseFloat(d.correction_multiplier),
    }));
    
    // Create pseudo post_ideas from angles for type allocation
    const angleIdeas = strategicBrief.angles.map((angle: any) => {
      // Map promoted_moment text to actual programme_type in database
      const moment = (angle.promoted_moment || '').toLowerCase();
      let programmeType = 'all_day'; // default
      
      if (moment.includes('brunch')) programmeType = 'morning';
      else if (moment.includes('frokost') || moment.includes('lunch')) programmeType = 'lunch';
      else if (moment.includes('aften') || moment.includes('dinner')) programmeType = 'dinner';
      
      console.log(`[Phase C Mapping] Angle "${angle.focus}" promoted_moment="${angle.promoted_moment}" → programme_type="${programmeType}", has_goal_split=${!!programmeGoalSplits[programmeType]}`);
      
      return {
        programme_type: programmeType,
        goal_mode: angle.goal_mode,
        _debug_promoted_moment: angle.promoted_moment, // DEBUG
        _debug_has_split: !!programmeGoalSplits[programmeType], // DEBUG
      };
    });
    
    // Allocate types
    const typedAngles = allocateContentTypes(angleIdeas, programmeGoalSplits, targetTypeMix, stalenessData, driftData);
    
    // Phase C: content_type (PRODUCT/EXPERIENCE/OCCASION/RETENTION) is for analytics only.
    // content_category for Phase 2b template routing stays with Phase 1/2a decisions.
    const typeAllocations: TypeAllocation[] = typedAngles.map((angle: any) => ({
      content_type: angle.content_type,
      type_rationale: angle.type_rationale,
    }));
    
    console.log('[PHASE C] ✅ Type allocation complete:', typeAllocations);
    console.log('[PHASE C] Distribution:', 
      typeAllocations.map(t => `${t.content_type}`).join(', ')
    );
    
    return typeAllocations;
    
  } catch (error: any) {
    console.error('[PHASE C] ❌ Type allocation failed:', error.message);
    console.warn('[PHASE C] Continuing without type allocation - Phase 2 will use default logic');
    
    // Return empty allocations on failure
    return [];
  }
}
