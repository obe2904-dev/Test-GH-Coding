/**
 * TIMING CONTEXT HOOK
 * 
 * React hook for accessing timing context with strategic segments
 * Provides soft, reassuring UI data for post creation flows
 */

import { useMemo } from 'react'
import { useBusinessData } from './useBusinessData'
import { 
  getCurrentTimingContext, 
  type TimingContext 
} from '../lib/segmentTimingContext'

interface UseTimingContextOptions {
  /** Override current time (for testing or scheduled posts) */
  overrideTime?: { day: string; time: string }
}

export function useTimingContext(options: UseTimingContextOptions = {}): {
  context: TimingContext
  isLoading: boolean
  hasSegments: boolean
} {
  const businessData = useBusinessData()
  const { isLoading } = businessData
  
  const context = useMemo(() => {
    // TODO: strategic_audience_segments is in business_brand_profile table, not business_profile
    // For now, return default context
    const segments: any[] = []
    
    return getCurrentTimingContext(segments, options.overrideTime)
  }, [options.overrideTime])
  
  const hasSegments = useMemo(() => {
    return false // TODO: Load segments from business_brand_profile if needed
  }, [])
  
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
