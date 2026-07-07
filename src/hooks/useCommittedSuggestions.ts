/**
 * useCommittedSuggestions
 *
 * Queries published_posts for committed (published or scheduled) rows so the
 * UI can lock already-committed ideas and prevent duplicate posts.
 *
 * Returns:
 *   committedSuggestionIds   — suggestion_ids with a committed row today
 *   isCommittedForWrite      — true when the write-self path has a committed row today
 *   committedWeeklyPlanIdeaIds — per-idea weekly-plan ids that already have a committed row
 *   committedWeeklyPlanDates  — ISO date strings (YYYY-MM-DD) of weekly-plan slots
 *                               that already have a committed row (DB-backed, survives refresh)
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface WeeklyPlanPostInfo {
  postId: string
  scheduledFor?: Date
  postedAt?: Date
  hasCaption: boolean
}

export interface CommittedState {
  /** suggestion_ids that already have a published/scheduled row today */
  committedSuggestionIds: Set<number>
  /** true when the write-self path has a committed post today */
  isCommittedForWrite: boolean
  /** weekly_plan_idea_id values that are already committed */
  committedWeeklyPlanIdeaIds: Set<number>
  /** weekly_plan_slot_date values (YYYY-MM-DD) that are already committed */
  committedWeeklyPlanDates: Set<string>
  /** Map of weekly_plan_idea_id -> post details for created posts */
  weeklyPlanPostMap: Map<number, WeeklyPlanPostInfo>
  /** true while loading */
  isLoading: boolean
  /** Re-fetch — call after a publish to update state without a full remount */
  refresh: () => void
}

export function useCommittedSuggestions(businessId: string | null): CommittedState {
  const [committedSuggestionIds, setCommittedSuggestionIds] = useState<Set<number>>(new Set())
  const [isCommittedForWrite, setIsCommittedForWrite] = useState(false)
  const [committedWeeklyPlanIdeaIds, setCommittedWeeklyPlanIdeaIds] = useState<Set<number>>(new Set())
  const [committedWeeklyPlanDates, setCommittedWeeklyPlanDates] = useState<Set<string>>(new Set())
  const [weeklyPlanPostMap, setWeeklyPlanPostMap] = useState<Map<number, WeeklyPlanPostInfo>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Local YYYY-MM-DD for today (avoids UTC shift for CET users)
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayDateStr = `${todayStart.getFullYear()}-${pad(todayStart.getMonth() + 1)}-${pad(todayStart.getDate())}`

    // Fetch rows that are either created today (for suggestion / write-self locking)
    // OR have a future/current weekly plan slot date / idea id (for weekly-plan locking).
    // Using PostgREST .or() so a single round-trip covers both cases.
    // For weekly plan posts, include drafts to check if text has been generated
    const { data, error } = await supabase
      .from('posts')
      .select('id, suggestion_id, weekly_plan_idea_id, weekly_plan_slot_date, posted_at, scheduled_for, post_text, status')
      .eq('business_id', businessId)
      .or(`and(status.in.(published,scheduled),or(posted_at.gte.${todayStart.toISOString()},weekly_plan_slot_date.gte.${todayDateStr})),and(status.eq.draft,weekly_plan_idea_id.not.is.null)`)

    if (error || !data) {
      console.warn('[useCommittedSuggestions] query failed:', error?.message)
      setIsLoading(false)
      return
    }

    const ids = new Set<number>()
    const ideaIds = new Set<number>()
    const planDates = new Set<string>()
    const postMap = new Map<number, WeeklyPlanPostInfo>()
    let writeCommitted = false

    for (const row of data) {
      const isCommitted = row.status === 'published' || row.status === 'scheduled'
      const isDraft = row.status === 'draft'
      
      if (row.weekly_plan_idea_id != null) {
        const ideaId = Number(row.weekly_plan_idea_id)
        
        // Only lock committed posts, not drafts
        if (isCommitted) {
          ideaIds.add(ideaId)
        }
        
        // Store post details for both draft and committed posts
        postMap.set(ideaId, {
          postId: row.id as string,
          scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : undefined,
          postedAt: row.posted_at ? new Date(row.posted_at) : undefined,
          hasCaption: (row.post_text as string | null) != null && (row.post_text as string).trim().length > 0,
        })
      }

      // Weekly plan slot — date-keyed lock (survives refresh) - only for committed posts
      if (isCommitted && row.weekly_plan_slot_date != null) {
        planDates.add(row.weekly_plan_slot_date as string)
      }

      // Suggestion / write-self rows — only count if posted today
      const postedAt = row.posted_at ? new Date(row.posted_at) : null
      const isToday = postedAt != null && postedAt >= todayStart
      if (isCommitted && isToday) {
        if (row.suggestion_id != null) {
          ids.add(Number(row.suggestion_id))
        } else if (row.weekly_plan_slot_date == null) {
          // No suggestion_id and no plan slot = write-self path
          writeCommitted = true
        }
      }
    }

    setCommittedSuggestionIds(ids)
    setIsCommittedForWrite(writeCommitted)
    setCommittedWeeklyPlanIdeaIds(ideaIds)
    setCommittedWeeklyPlanDates(planDates)
    setWeeklyPlanPostMap(postMap)
    setIsLoading(false)
  }, [businessId])

  useEffect(() => { load() }, [load])

  return { committedSuggestionIds, isCommittedForWrite, committedWeeklyPlanIdeaIds, committedWeeklyPlanDates, weeklyPlanPostMap, isLoading, refresh: load }
}
