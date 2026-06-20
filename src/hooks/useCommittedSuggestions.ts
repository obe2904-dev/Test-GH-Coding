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

export interface CommittedState {
  /** suggestion_ids that already have a published/scheduled row today */
  committedSuggestionIds: Set<number>
  /** true when the write-self path has a committed post today */
  isCommittedForWrite: boolean
  /** weekly_plan_idea_id values that are already committed */
  committedWeeklyPlanIdeaIds: Set<number>
  /** weekly_plan_slot_date values (YYYY-MM-DD) that are already committed */
  committedWeeklyPlanDates: Set<string>
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
    const { data, error } = await supabase
      .from('posts')
      .select('suggestion_id, weekly_plan_idea_id, weekly_plan_slot_date, posted_at')
      .eq('business_id', businessId)
      .in('status', ['published', 'scheduled'])
      .or(`posted_at.gte.${todayStart.toISOString()},weekly_plan_slot_date.gte.${todayDateStr}`)

    if (error || !data) {
      console.warn('[useCommittedSuggestions] query failed:', error?.message)
      setIsLoading(false)
      return
    }

    const ids = new Set<number>()
    const ideaIds = new Set<number>()
    const planDates = new Set<string>()
    let writeCommitted = false

    for (const row of data) {
      if (row.weekly_plan_idea_id != null) {
        ideaIds.add(Number(row.weekly_plan_idea_id))
      }

      // Weekly plan slot — date-keyed lock (survives refresh)
      if (row.weekly_plan_slot_date != null) {
        planDates.add(row.weekly_plan_slot_date as string)
      }

      // Suggestion / write-self rows — only count if posted today
      const postedAt = row.posted_at ? new Date(row.posted_at) : null
      const isToday = postedAt != null && postedAt >= todayStart
      if (isToday) {
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
    setIsLoading(false)
  }, [businessId])

  useEffect(() => { load() }, [load])

  return { committedSuggestionIds, isCommittedForWrite, committedWeeklyPlanIdeaIds, committedWeeklyPlanDates, isLoading, refresh: load }
}
