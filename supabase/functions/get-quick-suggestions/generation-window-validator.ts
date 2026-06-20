/**
 * Generation Window Validator
 * 
 * Pre-check gate that validates whether Quick Suggestions should run at all.
 * 
 * Quick Suggestions are tactical, same-day content designed to drive customers
 * in TODAY during active service periods. They should NOT generate when:
 * - Too late to drive footfall (< 1.5h before last service ends)
 * - Business is closed
 * - No service periods remain
 * 
 * When the window is invalid, return a user-friendly message directing them
 * to "Write Yourself" for manual posting.
 */

export interface GenerationWindowCheck {
  isValid: boolean
  reason?: string
  errorCode?: string  // Translation key for frontend i18n
  userMessage?: string  // Deprecated: use errorCode instead
  lastServiceEnd?: string
  cutoffTime?: string
  currentTime?: string
}

/**
 * Check if current time is within the valid Quick Suggestions generation window
 * 
 * Rules:
 * - Valid: 00:01 → (last service end - 1.5 hours)
 * - Invalid: After cutoff → direct to "Write Yourself"
 * 
 * @param clientNow Current client time
 * @param programs Service periods from menu classification system
 * @param openTime Today's opening time (HH:MM)
 * @param closeTime Today's closing time (HH:MM)
 * @param isClosedToday Explicit closed flag
 * @returns Validation result with user message if invalid
 */
export function validateGenerationWindow(
  clientNow: Date,
  programs: Array<{ name: string; start: string; end: string }>,
  openTime: string | null,
  closeTime: string | null,
  isClosedToday: boolean
): GenerationWindowCheck {
  const nowMins = clientNow.getHours() * 60 + clientNow.getMinutes()
  const currentTime = `${clientNow.getHours().toString().padStart(2, '0')}:${clientNow.getMinutes().toString().padStart(2, '0')}`
  
  // ── Check 1: Closed today ──
  if (isClosedToday) {
    return {
      isValid: false,
      reason: 'business_closed_today',
      errorCode: 'businessClosedToday',
      userMessage: 'Virksomheden er lukket i dag. Brug "Skriv selv" for at oprette opslag til andre dage.',  // Fallback
      currentTime
    }
  }
  
  // ── Check 2: No service periods or hours ──
  if (programs.length === 0 && (!openTime || !closeTime)) {
    return {
      isValid: false,
      reason: 'no_hours_configured',
      errorCode: 'noHoursConfigured',
      userMessage: 'Ingen åbningstider konfigureret. Kontakt support eller brug "Skriv selv".',  // Fallback
      currentTime
    }
  }
  
  // ── Helper: Convert HH:MM to minutes ──
  const toMins = (hhmm: string): number => {
    const [h, m = 0] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  
  // ── Helper: Handle midnight-crossing times ──
  const safeEndMins = (end: string, start: string): number => {
    const endMins = toMins(end)
    const startMins = toMins(start)
    // If end < start and end is early morning (< 10:00), it crosses midnight
    return endMins < startMins && endMins < 600 ? endMins + 1440 : endMins
  }
  
  // ── Find last service period end time ──
  let lastServiceEndMins = 0
  let lastServiceName = ''
  
  if (programs.length > 0) {
    // Use programs from menu classification system
    const programEnds = programs.map(p => ({
      name: p.name,
      endMins: safeEndMins(p.end, p.start),
      endTime: p.end
    }))
    const latest = programEnds.reduce((max, p) => p.endMins > max.endMins ? p : max)
    lastServiceEndMins = latest.endMins
    lastServiceName = latest.name
  } else if (closeTime) {
    // Fallback to closing time
    const closeMins = toMins(closeTime)
    const openMins = openTime ? toMins(openTime) : 0
    lastServiceEndMins = closeMins < openMins && closeMins < 600 ? closeMins + 1440 : closeMins
    lastServiceName = 'lukning'
  }
  
  // ── Check 3: Calculate cutoff (last service end - 1.5 hours) ──
  const CUTOFF_BUFFER_MINS = 90  // 1.5 hours
  const cutoffMins = lastServiceEndMins - CUTOFF_BUFFER_MINS
  
  // Normalize current time for midnight-crossing venues
  // Only normalize if we're in early morning hours (< 6:00) AND close time is also early
  const isActualLateNight = nowMins < 360 && (lastServiceEndMins > 1440 || (closeTime && toMins(closeTime) < 360))
  const normalizedNow = isActualLateNight ? nowMins + 1440 : nowMins
  
  if (normalizedNow > cutoffMins) {
    const cutoffTime = `${Math.floor(cutoffMins / 60) % 24}:${(cutoffMins % 60).toString().padStart(2, '0')}`
    const lastServiceEnd = `${Math.floor(lastServiceEndMins / 60) % 24}:${(lastServiceEndMins % 60).toString().padStart(2, '0')}`
    
    return {
      isValid: false,
      reason: 'too_late_for_quick_suggestions',
      errorCode: 'tooLateForQuickSuggestions',
      userMessage: `For sent til hurtige forslag (${lastServiceName} slutter kl. ${lastServiceEnd}). Brug "Skriv selv" for at oprette dit opslag.`,  // Fallback
      currentTime,
      lastServiceEnd,
      cutoffTime
    }
  }
  
  // ── Valid generation window ──
  return {
    isValid: true,
    currentTime
  }
}
