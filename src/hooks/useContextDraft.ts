/**
 * useContextDraft — source-keyed localStorage draft with debounced save.
 *
 * Replaces the old single-slot useDraftAutoRecover system.
 * - No modal, no recovery prompt, no interval.
 * - Saves only when content actually changes (debounced 1.5s after last change).
 * - Each context (Skriv Selv / AI idea / Weekly Plan post) gets its own isolated key.
 * - Drafts expire after 7 days and are cleared silently.
 */

import { useCallback, useEffect, useRef } from 'react'

const SAVE_DEBOUNCE_MS = 1500           // Save 1.5s after the last change
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000  // Expire after 7 days

interface DraftEntry {
  data: unknown
  savedAt: number
}

export function useContextDraft(contextKey: string | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')   // Track last serialised value to skip redundant writes

  /**
   * Schedule a debounced save. Calling this repeatedly (e.g. on every keystroke)
   * only triggers one write — 1.5s after the last call.
   */
  const save = useCallback((data: unknown) => {
    if (!contextKey) return

    const serialised = JSON.stringify(data)

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      // Skip write if content hasn't actually changed since last save
      if (serialised === lastSavedRef.current) return
      try {
        const entry: DraftEntry = { data, savedAt: Date.now() }
        localStorage.setItem(contextKey, JSON.stringify(entry))
        lastSavedRef.current = serialised
      } catch {
        // Quota exceeded or localStorage disabled — fail silently
      }
    }, SAVE_DEBOUNCE_MS)
  }, [contextKey])

  /**
   * Synchronously read the saved draft.
   * Returns null if no draft exists, if it has expired, or on any error.
   */
  const restoreNow = useCallback((): unknown | null => {
    if (!contextKey) return null
    try {
      const raw = localStorage.getItem(contextKey)
      if (!raw) return null
      const entry: DraftEntry = JSON.parse(raw)
      if (Date.now() - entry.savedAt > MAX_DRAFT_AGE_MS) {
        localStorage.removeItem(contextKey)
        return null
      }
      return entry.data
    } catch {
      return null
    }
  }, [contextKey])

  /**
   * Delete the saved draft (call after the post is published/scheduled).
   * Also cancels any pending debounced save.
   */
  const clear = useCallback(() => {
    if (!contextKey) return
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      localStorage.removeItem(contextKey)
      lastSavedRef.current = ''
    } catch { /* ignore */ }
  }, [contextKey])

  // Cancel pending save when the component using this hook unmounts
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { save, restoreNow, clear }
}
