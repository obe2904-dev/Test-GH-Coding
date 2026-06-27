/**
 * TIMING CONTEXT HOOK
 * 
 * React hook for accessing timing context with strategic segments
 * Provides soft, reassuring UI data for post creation flows
 */

import { useMemo } from 'react'
import { useBusinessData } from '../useBusinessData'
import { 
  getCurrentTimingContext, 
  type TimingContext 
} from '../../lib/segmentTimingContext'

interface UseTimingContextOptions {
  /** Override current time (for testing or scheduled posts) */
  overrideTime?: { day: string; time: string }
}

export function useTimingContext(options: UseTimingContextOptions = {}): {
  context: TimingContext
  isLoading: boolean
  hasSegments: boolean
} {
  const { businessProfile, isLoading } = useBusinessData()
  
  const context = useMemo(() => {
    // Extract strategic segments from brand profile
    const segments = businessProfile?.strategic_audience_segments 
      || businessProfile?.brand_profile_v5?.layer_1_programmes?.[0]?.audienceProfile?.audience_segments
      || []
    
    return getCurrentTimingContext(segments, options.overrideTime)
  }, [businessProfile, options.overrideTime])
  
  const hasSegments = useMemo(() => {
    const segments = businessProfile?.strategic_audience_segments 
      || businessProfile?.brand_profile_v5?.layer_1_programmes?.[0]?.audienceProfile?.audience_segments
      || []
    return segments.length > 0
  }, [businessProfile])
  
  return {
    context,
    isLoading,
    hasSegments
  }
}

/**
 * Hook for weekly plan summary data
 */
export function useWeeklyPlanSummary(posts: any[] = []) {
  return useMemo(() => {
    const totalPosts = posts.length
    const targetedPosts = posts.filter(
      p => p.segmentCoverage?.mode === 'strategic_segment'
    ).length
    const broadAppealPosts = posts.filter(
      p => p.segmentCoverage?.mode === 'gap_capacity'
    ).length
    
    return {
      totalPosts,
      targetedPosts,
      broadAppealPosts
    }
  }, [posts])
}
