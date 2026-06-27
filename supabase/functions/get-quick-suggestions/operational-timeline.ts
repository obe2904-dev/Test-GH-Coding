/**
 * Operational Timeline
 *
 * Computes the authoritative service state for a business at the current moment
 * and derives confirmed posting times for all three slots BEFORE any Gemini call.
 *
 * This is the single source of truth for:
 *   - Whether the business is open / in-gap / pre-service / post-service
 *   - Which service windows are food vs. drinks vs. atmosphere only
 *   - What the kitchen deadline actually is (≠ venue close)
 *   - Exactly what HH:MM each slot should be posted at
 *   - How many slots are meaningful today
 *
 * Rules that are enforced here (not by Gemini):
 *   - Food-content slots never land after kitchen close
 *   - No slot lands outside the venue's open hours
 *   - No two slots share the same time
 *   - Midnight-crossing venues (e.g. 09:30–01:00) are handled correctly
 *   - Cocktail bars opening at 21:00 spread correctly into AM hours
 */

export type ServiceWindow = {
  name: string        // Program name (e.g. "BRUNCH MENU", "AFTENSMENU")
  start: string       // HH:MM
  end: string         // HH:MM — may be past midnight (e.g. "02:00")
  isFoodService: boolean
  startMins: number   // minutes since midnight (0–1439)
  endMins: number     // minutes since midnight, +1440 if crosses midnight
}

export type ServiceState =
  | 'pre_opening'   // business hasn't opened yet today
  | 'in_gap'        // between service windows (e.g. Italian 15:00–17:30 break)
  | 'in_service'    // inside an active service window
  | 'post_service'  // all service windows finished, only bar/drinks remain
  | 'closed'        // explicitly closed today
  | 'unknown'       // no hours data

export type SlotTiming = {
  position: 1 | 2 | 3
  postAtMins: number  // confirmed posting time in minutes since midnight
  postAt: string      // HH:MM — exactly what goes in the database
  serviceWindow: ServiceWindow | null  // which window this slot targets
  isFoodEligible: boolean  // whether food content is valid at this time
  allowedContentTypes: string[]  // what content types can be posted (enforces kitchen close rules)
  isBarOnly: boolean       // only bar/atmosphere content valid
  label: string            // human-readable label for logging
}

export type OperationalTimeline = {
  // Raw inputs, normalised
  openMins: number        // venue open in minutes since midnight
  closeMins: number       // venue close, +1440 if crosses midnight
  kitchenCloseMins: number | null  // null = no kitchen close data
  nowMins: number         // current client time in minutes since midnight

  // Derived service state
  serviceState: ServiceState
  isClosedToday: boolean
  isMidnightCrossing: boolean  // venue closes after midnight

  // Service windows sorted by start time
  windows: ServiceWindow[]
  activeWindow: ServiceWindow | null    // currently active (now inside it)
  nextWindow: ServiceWindow | null      // next upcoming
  remainingWindows: ServiceWindow[]     // active + future

  // Gap detection
  inGap: boolean
  gapNextWindow: ServiceWindow | null   // what opens after the gap

  // Slot count decision
  effectiveSlotCount: number
  isLateNight: boolean  // all food service done, only bar content sensible
  isSocialDeadZone: boolean  // 00:00–05:59 local time — restaurant social media audience is negligible

  // The three confirmed slot times
  slots: SlotTiming[]

  // Debug summary
  summary: string
}

// ── Time math helpers ────────────────────────────────────────────────────────

export function toMins(hhmm: string): number {
  const [h, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMins(mins: number): string {
  // Wrap at 24h so midnight-crossing times (e.g. 1500 mins = 25:00) display as 01:00
  const wrapped = ((mins % 1440) + 1440) % 1440
  return `${Math.floor(wrapped / 60).toString().padStart(2, '0')}:${(wrapped % 60).toString().padStart(2, '0')}`
}

// ── Customer journey buffer ───────────────────────────────────────────────────
// Minimum minutes BEFORE kitchen close at which food content still makes sense.
// Customer journey: see post → decide → travel → get table → read menu → order ≈ 60–90 min.
// 75 min is a conservative but realistic middle ground for someone who isn't already there.
const FOOD_LEAD_MINS = 75

// ── Half-hour rounding ────────────────────────────────────────────────────────
// Social media posts look natural at :00 and :30. "14:24" signals automation.

/** Round UP to the next :00/:30 boundary. Use for Slot A (must not be in the past). */
function ceilToHalfHour(mins: number): number {
  return Math.ceil(mins / 30) * 30
}

/** Round to the nearest :00/:30 boundary. Use for future Slots B and C. */
function roundToHalfHour(mins: number): number {
  return Math.round(mins / 30) * 30
}

/** Normalise end-time to be > start for midnight-crossing windows */
function safeEndMins(startMins: number, rawEnd: string): number {
  const end = toMins(rawEnd)
  // end < 600 (before 10:00) and start > 800 → almost certainly crosses midnight
  return end < startMins && end < 600 ? end + 1440 : end
}

// ── Parse ServiceWindows from programsFromMenu + opening hours ───────────────

function buildWindows(
  programs: Array<{ name: string; start: string; end: string }>,
  openTime: string | null,
  closeTime: string | null,
  kitchenCloseTime: string | null,
): ServiceWindow[] {
  const kitchenCloseMins = kitchenCloseTime ? toMins(kitchenCloseTime) : null

  if (programs.length > 0) {
    return programs.map(p => {
      const startMins = toMins(p.start)
      const endMins = safeEndMins(startMins, p.end)
      // A window is food-eligible unless its start is at or after kitchen close
      const isFoodService = kitchenCloseMins === null || startMins < kitchenCloseMins
      return { name: p.name, start: p.start, end: p.end, isFoodService, startMins, endMins }
    }).sort((a, b) => a.startMins - b.startMins)
  }

  // No named programs — synthesise one window from opening hours
  if (!openTime || !closeTime) return []
  const startMins = toMins(openTime)
  const rawClose = toMins(closeTime)
  const endMins = rawClose <= startMins && rawClose < 600 ? rawClose + 1440 : rawClose
  const isFoodService = kitchenCloseMins === null || startMins < kitchenCloseMins
  return [{ name: 'DAGSPROGRAM', start: openTime, end: closeTime, isFoodService, startMins, endMins }]
}

// ── Core: build the complete OperationalTimeline ─────────────────────────────

export function buildOperationalTimeline(
  clientNow: Date,
  openTime: string | null,
  closeTime: string | null,
  kitchenCloseTime: string | null,
  programs: Array<{ name: string; start: string; end: string }>,
  isClosedToday: boolean,
  isPaidTier: boolean,
  isProTier: boolean,
): OperationalTimeline {
  const nowMins = clientNow.getHours() * 60 + clientNow.getMinutes()

  // ── Handle closed day ──
  if (isClosedToday) {
    return closedTimeline(nowMins, isClosedToday)
  }

  // ── No hours at all ──
  if (!openTime && !closeTime && programs.length === 0) {
    return unknownTimeline(nowMins)
  }

  // ── Normalise venue bounds ──
  const openMins = openTime ? toMins(openTime) : 0
  const rawClose = closeTime ? toMins(closeTime) : 24 * 60
  // Midnight-crossing: close time looks earlier than open (e.g. open 09:30, close 01:00)
  const isMidnightCrossing = rawClose < openMins && rawClose < 600
  const closeMins = isMidnightCrossing ? rawClose + 1440 : rawClose
  const kitchenCloseMins = kitchenCloseTime ? toMins(kitchenCloseTime) : null

  // Normalise nowMins for midnight-crossing venues, but ONLY for actual late-night times.
  // For a 09:30-00:00 venue: normalize 01:00 (post-service late night) but NOT 07:00 (pre-opening morning).
  // Key insight: only normalize if BOTH current time AND close time are early hours (< 6 AM).
  // This distinguishes late-night service continuation from early morning pre-opening.
  const isActualLateNight = nowMins < 360 && rawClose < 360  // Both before 6:00 AM
  const normalizedNow = isMidnightCrossing && isActualLateNight ? nowMins + 1440 : nowMins

  // ── Build service windows ──
  const windows = buildWindows(programs, openTime, closeTime, kitchenCloseTime)

  // ── Categorise remaining vs ended ──
  const remainingWindows = windows.filter(w => w.endMins > normalizedNow)
  const activeWindow = windows.find(w => w.startMins <= normalizedNow && w.endMins > normalizedNow) ?? null
  const nextWindow = windows.find(w => w.startMins > normalizedNow) ?? null

  // ── Service state ──
  let serviceState: ServiceState
  if (normalizedNow < openMins) {
    serviceState = 'pre_opening'
  } else if (normalizedNow >= closeMins) {
    serviceState = 'post_service'
  } else if (activeWindow) {
    serviceState = 'in_service'
  } else if (nextWindow) {
    serviceState = 'in_gap'
  } else {
    serviceState = 'post_service'
  }

  // Social dead zone: 00:00–05:59 local time. Restaurant social media has near-zero
  // reach at these hours regardless of whether a bar is technically still open.
  // Uses raw (non-normalized) nowMins so a midnight-crossing bar at 01:00 is caught.
  const isSocialDeadZone = nowMins < 5 * 60

  // Dead zone collapses to late-night mode ONLY when the venue is currently active
  // (e.g. a bar that is literally open at 01:00). For pre-opening scenarios (user
  // opens app at 01:10, venue opens at 07:00) we treat it as pre_opening so the
  // full day's slots are generated anchored to morning/lunch/dinner.
  const isLateNight = serviceState === 'post_service' || closeMins <= normalizedNow ||
    (isSocialDeadZone && serviceState !== 'pre_opening')

  // ── Gap detection ──
  const inGap = serviceState === 'in_gap'
  const gapNextWindow = inGap ? nextWindow : null

  // ── Slot count ──
  let effectiveSlotCount = computeSlotCount(
    normalizedNow, openMins, closeMins, kitchenCloseMins,
    remainingWindows, windows, isPaidTier, isProTier, isLateNight,
  )

  // ── Compute confirmed slot times ──
  let slots = computeSlotTimings(
    effectiveSlotCount, normalizedNow, openMins, closeMins, kitchenCloseMins,
    windows, remainingWindows, serviceState, nextWindow, gapNextWindow,
    isMidnightCrossing,
  )

  // Dead zone override: generate slots for the UPCOMING service day rather than
  // the current (ended) one. This applies when we're in 00:00–04:59 and the
  // current service day is post_service (all programs ended, bar still open or not).
  // Pre-opening dead zones (01:10, venue opens at 09:00) are handled naturally by
  // the pre_opening path in computeSlotA — no override needed there.
  if (isSocialDeadZone && serviceState !== 'pre_opening') {
    const dayOpenMins = openMins > 0 ? openMins : 9 * 60
    const foodDeadline = kitchenCloseMins ? kitchenCloseMins - FOOD_LEAD_MINS : closeMins - 90
    const venueDead   = closeMins - 30

    // Slot A: just after opening
    const slotAMins = ceilToHalfHour(dayOpenMins + 15)
    const deadZoneSlots: SlotTiming[] = [{
      position: 1,
      postAtMins: slotAMins,
      postAt: fromMins(slotAMins),
      serviceWindow: windows[0] ?? null,
      isFoodEligible: true,
      allowedContentTypes: ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'],
      isBarOnly: false,
      label: `Slot A (dead zone → ${fromMins(slotAMins)})`,
    }]

    if (isPaidTier) {
      // Slot B: ~40% through the food window
      const slotBRaw = roundToHalfHour(dayOpenMins + (foodDeadline - dayOpenMins) * 0.40)
      const slotBMins = Math.max(slotBRaw, slotAMins + 90)
      if (slotBMins <= venueDead) {
        const win = windows.find(w => w.startMins <= slotBMins && w.endMins > slotBMins) ?? null
        const slotBFoodEligible = slotBMins <= foodDeadline
        deadZoneSlots.push({
          position: 2,
          postAtMins: slotBMins,
          postAt: fromMins(slotBMins),
          serviceWindow: win,
          isFoodEligible: slotBFoodEligible,
          allowedContentTypes: slotBFoodEligible ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'] : ['atmosphere', 'behind_scenes'],
          isBarOnly: slotBMins > foodDeadline,
          label: `Slot B (dead zone spread: ${fromMins(slotBMins)})`,
        })
      }

      // Slot C: ~72% through the food window
      const lastMins = deadZoneSlots[deadZoneSlots.length - 1].postAtMins
      const slotCRaw = roundToHalfHour(dayOpenMins + (foodDeadline - dayOpenMins) * 0.72)
      const slotCMins = Math.max(slotCRaw, lastMins + 90)
      if (deadZoneSlots.length >= 2 && slotCMins <= venueDead) {
        const win = windows.find(w => w.startMins <= slotCMins && w.endMins > slotCMins) ?? null
        const slotCFoodEligible = slotCMins <= foodDeadline
        deadZoneSlots.push({
          position: 3,
          postAtMins: slotCMins,
          postAt: fromMins(slotCMins),
          serviceWindow: win,
          isFoodEligible: slotCFoodEligible,
          allowedContentTypes: slotCFoodEligible ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'] : ['atmosphere', 'behind_scenes'],
          isBarOnly: slotCMins > foodDeadline,
          label: `Slot C (dead zone spread: ${fromMins(slotCMins)})`,
        })
      }
    }

    slots = deadZoneSlots
    effectiveSlotCount = deadZoneSlots.length
  }

  const summary = buildSummary(
    serviceState, normalizedNow, openMins, closeMins, kitchenCloseMins,
    windows, remainingWindows, effectiveSlotCount, slots, isMidnightCrossing,
  )

  console.log(`🗓️ OperationalTimeline: ${summary}`)

  return {
    openMins, closeMins, kitchenCloseMins, nowMins: normalizedNow,
    serviceState, isClosedToday, isMidnightCrossing,
    windows, activeWindow, nextWindow, remainingWindows,
    inGap, gapNextWindow,
    effectiveSlotCount, isLateNight, isSocialDeadZone,
    slots,
    summary,
  }
}

// ── Slot count logic ─────────────────────────────────────────────────────────

function computeSlotCount(
  nowMins: number,
  openMins: number,
  closeMins: number,
  kitchenCloseMins: number | null,
  remainingWindows: ServiceWindow[],
  allWindows: ServiceWindow[],
  isPaidTier: boolean,
  isProTier: boolean,
  isLateNight: boolean,
): number {
  // ── DEBUG LOGGING (June 24, 2026) ──
  const nowHHMM = `${Math.floor(nowMins / 60).toString().padStart(2, '0')}:${(nowMins % 60).toString().padStart(2, '0')}`
  const closeHHMM = `${Math.floor(closeMins / 60).toString().padStart(2, '0')}:${(closeMins % 60).toString().padStart(2, '0')}`
  const kitchenCloseHHMM = kitchenCloseMins ? `${Math.floor(kitchenCloseMins / 60).toString().padStart(2, '0')}:${(kitchenCloseMins % 60).toString().padStart(2, '0')}` : 'NULL'
  
  console.log(`🔍 computeSlotCount DEBUG:
    Current time: ${nowHHMM} (${nowMins} mins)
    Venue closes: ${closeHHMM} (${closeMins} mins)
    Kitchen closes: ${kitchenCloseHHMM} (${kitchenCloseMins ?? 'NULL'} mins)
    isPaidTier: ${isPaidTier}
    isLateNight: ${isLateNight}
    allWindows: ${allWindows.length}
    remainingWindows: ${remainingWindows.length}`)

  if (!isPaidTier) {
    console.log(`   → Result: 2 (free tier fixed)`)
    return 2
  }
  if (isLateNight) {
    console.log(`   → Result: 1 (late night mode)`)
    return 1
  }

  // Use kitchen close - FOOD_LEAD_MINS as the content deadline so slot count
  // reflects how many actionable food posting windows actually remain.
  // A venue with kitchen close at 21:30 has no useful food slots after ~20:15.
  const contentDeadline = kitchenCloseMins !== null
    ? kitchenCloseMins - FOOD_LEAD_MINS
    : closeMins - 30
  const hoursOfContentRemaining = Math.max(0, contentDeadline - nowMins) / 60
  
  const deadlineHHMM = `${Math.floor(contentDeadline / 60).toString().padStart(2, '0')}:${(contentDeadline % 60).toString().padStart(2, '0')}`
  console.log(`    Content deadline: ${deadlineHHMM} (${contentDeadline} mins)
    Hours remaining: ${hoursOfContentRemaining.toFixed(2)}h`)

  if (allWindows.length >= 2) {
    // Multiple distinct service periods: drive from remaining food windows
    const remainingFoodWindows = remainingWindows.filter(w => w.isFoodService)
    const count = Math.min(3, Math.max(1, remainingFoodWindows.length))
    // Keep the batch at 3 whenever there is still enough content window to space it out.
    // This preserves the expected 3-card experience while still falling back to fewer
    // slots when the day is almost over.
    const hoursFloor = hoursOfContentRemaining >= 2.5 ? 3 : hoursOfContentRemaining >= 1.5 ? 2 : 1
    const result = Math.max(count, hoursFloor)
    console.log(`    Multiple windows (${allWindows.length}): remainingFoodWindows=${remainingFoodWindows.length}, count=${count}, hoursFloor=${hoursFloor}
   → Result: ${result}`)
    return result
  }

  // Single window or no program data: use content hours remaining
  let result: number
  if (hoursOfContentRemaining >= 2.5) result = 3
  else if (hoursOfContentRemaining >= 1.5) result = 2
  else result = 1
  
  console.log(`    Single/no window: hours=${hoursOfContentRemaining.toFixed(2)}h
   → Result: ${result}`)
  return result
}

// ── Slot timing computation ───────────────────────────────────────────────────

function computeSlotTimings(
  count: number,
  nowMins: number,
  openMins: number,
  closeMins: number,
  kitchenCloseMins: number | null,
  allWindows: ServiceWindow[],
  remainingWindows: ServiceWindow[],
  serviceState: ServiceState,
  nextWindow: ServiceWindow | null,
  gapNextWindow: ServiceWindow | null,
  isMidnightCrossing: boolean,
): SlotTiming[] {
  const slots: SlotTiming[] = []
  const usedTimes = new Set<number>()

  // Food content deadline: FOOD_LEAD_MINS before kitchen close.
  // A post at this time gives a nearby customer just enough time to
  // see it, decide, travel, get seated, and order before the kitchen closes.
  const kitchenDeadline = kitchenCloseMins !== null
    ? kitchenCloseMins - FOOD_LEAD_MINS
    : closeMins - 30

  // Post-service deadline (non-food / bar atmosphere): venue close - 30 min
  const venueDeadline = closeMins - 30

  // Minimum posting time: now + 10 min buffer
  const minPostMins = nowMins + 10

  // ── Slot A: now / very soon (but inside service hours) ──
  const slotA = computeSlotA(
    nowMins, minPostMins, openMins, closeMins, kitchenDeadline, venueDeadline,
    allWindows, remainingWindows, serviceState, gapNextWindow,
  )
  usedTimes.add(slotA.postAtMins)
  slots.push({ position: 1, ...slotA })

  if (count < 2) return slots

  // ── Slot B: mid-range ──
  const slotB = computeSlotBC(
    2, nowMins, openMins, closeMins, kitchenDeadline, venueDeadline,
    allWindows, remainingWindows, usedTimes, 0.40,
  )
  usedTimes.add(slotB.postAtMins)
  slots.push({ position: 2, ...slotB })

  if (count < 3) return slots

  // ── Slot C: late in the day ──
  const slotC = computeSlotBC(
    3, nowMins, openMins, closeMins, kitchenDeadline, venueDeadline,
    allWindows, remainingWindows, usedTimes, 0.72,
  )
  usedTimes.add(slotC.postAtMins)
  slots.push({ position: 3, ...slotC })

  return slots
}

function computeSlotA(
  nowMins: number,
  minPostMins: number,
  openMins: number,
  closeMins: number,
  kitchenDeadline: number,
  venueDeadline: number,
  allWindows: ServiceWindow[],
  remainingWindows: ServiceWindow[],
  serviceState: ServiceState,
  gapNextWindow: ServiceWindow | null,
): Omit<SlotTiming, 'position'> {
  // In a gap: target the start of the next window (pre-announce)
  if (serviceState === 'in_gap' && gapNextWindow) {
    const rawMins = Math.max(minPostMins, gapNextWindow.startMins - 45)
    const finalMins = Math.min(ceilToHalfHour(rawMins), venueDeadline)
    const isFoodEligible = gapNextWindow.isFoodService
    return {
      postAtMins: finalMins,
      postAt: fromMins(finalMins),
      serviceWindow: gapNextWindow,
      isFoodEligible,
      allowedContentTypes: isFoodEligible ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'] : ['atmosphere', 'behind_scenes'],
      isBarOnly: !gapNextWindow.isFoodService,
      label: `Slot A (pre-gap announce: ${gapNextWindow.name})`,
    }
  }

  // Pre-opening: target open time + 15 min
  if (serviceState === 'pre_opening') {
    const rawMins = Math.max(minPostMins, openMins + 15)
    const targetWindow = allWindows[0] ?? null
    const finalMins = ceilToHalfHour(rawMins)
    const isFoodEligible = targetWindow?.isFoodService ?? false
    return {
      postAtMins: finalMins,
      postAt: fromMins(finalMins),
      serviceWindow: targetWindow,
      isFoodEligible,
      allowedContentTypes: isFoodEligible ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'] : ['atmosphere', 'behind_scenes'],
      isBarOnly: !(targetWindow?.isFoodService ?? true),
      label: `Slot A (pre-opening: targets ${fromMins(finalMins)})`,
    }
  }

  // Normal: post now + 10 min (already inside service)
  const activeWindow = remainingWindows.find(w => w.startMins <= nowMins) ?? remainingWindows[0] ?? null
  // Food is eligible only when BOTH the active window is a food window AND we are
  // still within the customer-journey lead time before kitchen close.
  // Without the second check a slot at now=20:20 (FOOD_LEAD_MINS=75, kitchen=21:30)
  // would be marked food-eligible just because AFTENSMENU is active — wrong.
  const isFoodEligible = activeWindow
    ? (activeWindow.isFoodService && nowMins < kitchenDeadline)
    : nowMins < kitchenDeadline
  const isBarOnly = !isFoodEligible

  // Round UP to next :00/:30; if that overshoots the deadline, keep unrounded
  const deadline = isFoodEligible ? kitchenDeadline : venueDeadline
  const rawMins = minPostMins
  const ceiledMins = ceilToHalfHour(rawMins)
  const finalMins = ceiledMins <= deadline ? ceiledMins : rawMins

  return {
    postAtMins: finalMins,
    postAt: fromMins(finalMins),
    serviceWindow: activeWindow,
    isFoodEligible,
    allowedContentTypes: isFoodEligible ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'] : ['atmosphere', 'behind_scenes'],
    isBarOnly,
    label: `Slot A (now: ${fromMins(finalMins)})`,
  }
}

function computeSlotBC(
  position: 2 | 3,
  nowMins: number,
  openMins: number,
  closeMins: number,
  kitchenDeadline: number,
  venueDeadline: number,
  allWindows: ServiceWindow[],
  remainingWindows: ServiceWindow[],
  usedTimes: Set<number>,
  fraction: number,
): Omit<SlotTiming, 'position'> {
  // Anchor: if pre-opening, spread from open time; otherwise from now
  const anchor = nowMins < openMins ? openMins : nowMins

  // Use kitchen deadline as the far end (already includes FOOD_LEAD_MINS buffer).
  const remaining = Math.max(0, kitchenDeadline - anchor)

  // Compute raw target, round to nearest :00/:30, then enforce deadline.
  const rawFoodTarget = Math.round(anchor + remaining * fraction)
  let targetMins = roundToHalfHour(rawFoodTarget)

  // Enforce food deadline (rounding might have pushed past it)
  if (targetMins > kitchenDeadline) {
    // This slot falls after the food-posting window — switch to bar/atmosphere
    const barRemaining = Math.max(0, venueDeadline - anchor)
    targetMins = roundToHalfHour(Math.round(anchor + barRemaining * fraction))
  }

  // Hard clamp to venue deadline
  targetMins = Math.min(targetMins, venueDeadline)

  // Ensure this slot doesn't collide with an already-used time.
  // Step by 30 min to stay on the :00/:30 grid.
  while (usedTimes.has(targetMins)) {
    targetMins += 30
    if (targetMins > venueDeadline) {
      targetMins = venueDeadline - 30
      break
    }
  }

  // Clamp: must be at least 45 min after the previous slot.
  // Round UP to the next :00/:30 at or after the minimum.
  const previousSlotTimes = Array.from(usedTimes)
  const latestUsed = previousSlotTimes.length > 0 ? Math.max(...previousSlotTimes) : nowMins
  if (targetMins < latestUsed + 45) {
    targetMins = Math.min(ceilToHalfHour(latestUsed + 45), venueDeadline)
  }

  const isFoodEligible = targetMins <= kitchenDeadline
  const isBarOnly = !isFoodEligible

  // Find which window this slot falls into
  const serviceWindow = allWindows.find(w => w.startMins <= targetMins && w.endMins > targetMins)
    ?? remainingWindows.find(w => w.startMins > targetMins)
    ?? null

  const label = `Slot ${position} (${fraction * 100 | 0}% of content window: ${fromMins(targetMins)}${isBarOnly ? ' [bar-only]' : ''})`

  return {
    postAtMins: targetMins,
    postAt: fromMins(targetMins),
    serviceWindow,
    isFoodEligible,
    allowedContentTypes: isFoodEligible ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'] : ['atmosphere', 'behind_scenes'],
    isBarOnly,
    label,
  }
}

// ── Degenerate timelines ─────────────────────────────────────────────────────

function closedTimeline(nowMins: number, isClosedToday: boolean): OperationalTimeline {
  return {
    openMins: 0, closeMins: 0, kitchenCloseMins: null, nowMins,
    serviceState: 'closed', isClosedToday, isMidnightCrossing: false,
    windows: [], activeWindow: null, nextWindow: null, remainingWindows: [],
    inGap: false, gapNextWindow: null,
    effectiveSlotCount: 1, isLateNight: false,
    isSocialDeadZone: false,
    slots: [{
      position: 1,
      postAtMins: nowMins + 15,
      postAt: fromMins(nowMins + 15),
      serviceWindow: null,
      isFoodEligible: false,
      allowedContentTypes: ['atmosphere', 'behind_scenes'],
      isBarOnly: false,
      label: 'Slot A (closed today)',
    }],
    summary: 'Business is closed today',
  }
}

function unknownTimeline(nowMins: number): OperationalTimeline {
  const defaultPost = nowMins + 15
  return {
    openMins: 0, closeMins: 1440, kitchenCloseMins: null, nowMins,
    serviceState: 'unknown', isClosedToday: false, isMidnightCrossing: false,
    windows: [], activeWindow: null, nextWindow: null, remainingWindows: [],
    inGap: false, gapNextWindow: null,
    effectiveSlotCount: 1, isLateNight: false,
    isSocialDeadZone: false,
    slots: [{
      position: 1,
      postAtMins: defaultPost,
      postAt: fromMins(defaultPost),
      serviceWindow: null,
      isFoodEligible: true,
      allowedContentTypes: ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'],
      isBarOnly: false,
      label: 'Slot A (no hours data)',
    }],
    summary: 'No hours data — single slot at now+15',
  }
}

// ── Summary builder for logs ──────────────────────────────────────────────────

function buildSummary(
  serviceState: ServiceState,
  nowMins: number,
  openMins: number,
  closeMins: number,
  kitchenCloseMins: number | null,
  allWindows: ServiceWindow[],
  remainingWindows: ServiceWindow[],
  slotCount: number,
  slots: SlotTiming[],
  isMidnightCrossing: boolean,
): string {
  const nowStr = fromMins(nowMins)
  const openStr = fromMins(openMins)
  const closeStr = fromMins(closeMins)
  const kitchenStr = kitchenCloseMins ? fromMins(kitchenCloseMins) : 'n/a'
  const slotStr = slots.map(s => `${s.postAt}${s.isBarOnly ? '*' : ''}`).join(', ')
  return `state=${serviceState} now=${nowStr} open=${openStr} close=${closeStr}${isMidnightCrossing ? '(+1d)' : ''} kitchen=${kitchenStr} programs=${allWindows.length}(${remainingWindows.length} remaining) slots=${slotCount}→[${slotStr}]`
}

// ── Menu availability helpers (extracted from index.ts) ───────────────────────

const AVAIL_DAY: Record<string, number> = {
  søndag: 0, sunday: 0, søn: 0, sun: 0,
  mandag: 1, monday: 1, man: 1, mon: 1,
  tirsdag: 2, tuesday: 2, tir: 2, tue: 2,
  onsdag: 3, wednesday: 3, ons: 3, wed: 3,
  torsdag: 4, thursday: 4, tor: 4, thu: 4,
  fredag: 5, friday: 5, fre: 5, fri: 5,
  lørdag: 6, saturday: 6, lør: 6, sat: 6,
}

export function isMenuAvailableOnDay(availabilityDays: string | null, todayDow: number): boolean {
  if (!availabilityDays) return true
  const lower = availabilityDays.trim().toLowerCase()
  if (!lower || /dagligt|daily|alle dage|every day/.test(lower)) return true
  if (/^hverdage$|^weekdays?$/.test(lower)) return todayDow >= 1 && todayDow <= 5
  if (/^(kun )?weekende?r?$|^weekends?$/.test(lower)) return todayDow === 0 || todayDow === 6

  const rangeMatch = lower.match(/([a-z\u00e6\u00f8\u00e5]+)\s*(?:[-\u2013]|to|til)\s*([a-z\u00e6\u00f8\u00e5]+)/)
  if (rangeMatch) {
    const ds = AVAIL_DAY[rangeMatch[1]]
    const de = AVAIL_DAY[rangeMatch[2]]
    if (ds !== undefined && de !== undefined) {
      return de >= ds ? todayDow >= ds && todayDow <= de : todayDow >= ds || todayDow <= de
    }
  }
  const single = AVAIL_DAY[lower]
  if (single !== undefined) return todayDow === single
  return true
}

// ── Day behavior (moved here as timing-adjacent) ───────────────────────────────

export type DayBehavior = {
  mode: string; danishMode: string; emphasis: string
  avoidPushFootfall: boolean; offeringTone: string
  slotBDefault: string; slotCDefault: string
}

export function getDayBehavior(dayIndex: number): DayBehavior {
  const behaviors: DayBehavior[] = [
    { mode: 'sunday_slow',     danishMode: 'Søndagsrolig',         emphasis: 'langsom start, brunch, afslapning',              avoidPushFootfall: false, offeringTone: 'hyggelig og uformel',      slotBDefault: 'brunch_moment',    slotCDefault: 'atmosphere'    },
    { mode: 'weekday_restart', danishMode: 'Mandags-restart',       emphasis: 'frisk start, frokostpause, ny uge',              avoidPushFootfall: false, offeringTone: 'energisk og informativ',  slotBDefault: 'lunch_moment',     slotCDefault: 'behind_scenes' },
    { mode: 'midweek_quiet',   danishMode: 'Rolig hverdag',         emphasis: 'hverdagsrutine, stille øjeblikke',               avoidPushFootfall: false, offeringTone: 'rolig og informativ',    slotBDefault: 'lunch_moment',     slotCDefault: 'atmosphere'    },
    { mode: 'hump_day',        danishMode: 'Midt på ugen',          emphasis: 'lille pause i ugen, hverdag med charme',         avoidPushFootfall: false, offeringTone: 'imødekommende',          slotBDefault: 'lunch_moment',     slotCDefault: 'behind_scenes' },
    { mode: 'pre_weekend',     danishMode: 'Torsdag – pre-weekend', emphasis: 'forhype til weekend, afterwork, socialt',        avoidPushFootfall: false, offeringTone: 'let festlig',             slotBDefault: 'afterwork_moment', slotCDefault: 'atmosphere'    },
    { mode: 'friday_social',   danishMode: 'Fredagsvibes',          emphasis: 'fyraftensdrink, weekend starter, socialt samvær',avoidPushFootfall: false, offeringTone: 'festlig og indbydende',  slotBDefault: 'afterwork_moment', slotCDefault: 'atmosphere'    },
    { mode: 'weekend_peak',    danishMode: 'Weekendpeak',           emphasis: 'brunch, frokost, gæster med tid',               avoidPushFootfall: false, offeringTone: 'varm og social',          slotBDefault: 'brunch_moment',    slotCDefault: 'atmosphere'    },
  ]
  return behaviors[dayIndex] ?? behaviors[1]
}

export function deriveServicePeriod(openTime: string | null, closeTime: string | null): 'brunch' | 'lunch' | 'dinner' | 'all_day' | null {
  if (!openTime || !closeTime) return null
  const [openH] = openTime.split(':').map(Number)
  const [closeH] = closeTime.split(':').map(Number)
  const normalizedCloseH = closeH < 6 ? closeH + 24 : closeH
  if (openH >= 17) return 'dinner'
  if (openH <= 11 && normalizedCloseH <= 16) return 'brunch'
  if (openH <= 11 && normalizedCloseH <= 20) return 'lunch'
  return 'all_day'
}
