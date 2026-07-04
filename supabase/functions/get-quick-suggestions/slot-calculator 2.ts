/**
 * Slot Calculator
 * 
 * Implements the hours-based slot count formula and timing logic.
 * Replaces operational-timeline.ts with simpler mathematical rules.
 * 
 * Key Principles:
 * 1. Slot count based on available hours (> 8h → 3 slots, 5-8h → 2 slots, < 5h → 1 slot)
 * 2. Strict minimum 2-hour spacing between slots
 * 3. Service period transitions (each slot targets different menu when possible)
 * 4. Customer decision buffer (1.5h before service ends)
 * 
 * Edge Cases Handled:
 * - Midnight-crossing venues (bar 21:00-02:00)
 * - Social dead zone (00:00-05:59) → shift to next day
 * - Overlapping service periods (brunch + lunch active simultaneously)
 * - No active periods (fallback to general menu)
 */

export interface SlotTiming {
  position: 1 | 2 | 3
  postAtMins: number  // Minutes since midnight (normalized for midnight-crossing)
  postAt: string      // HH:MM format for database
  suggestedTime: string  // HH:MM format for display (user-friendly)
  eligiblePeriods: string[]  // Service periods valid at this time (for context/logging)
  allowedContentTypes: string[]  // NEW: What content types can actually be posted (enforces kitchen close rules)
  serviceWindow: { name: string; start: string; end: string } | null
  isFoodEligible: boolean
  isBarOnly: boolean
  label: string  // Human-readable label for logging
  rationale: string  // Why this slot timing (NOW, PREVIEW, etc.)
}

export interface SlotCalculationResult {
  slotCount: number
  availableHours: number
  slots: SlotTiming[]
  activePeriods: Array<{ name: string; start: string; end: string; hoursRemaining: number }>
  upcomingPeriods: Array<{ name: string; start: string; end: string; startsInHours: number }>
  isSocialDeadZone: boolean
  reasoning: string  // Explanation of slot count decision
}

// ── Time Utilities ───────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  const [h, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function fromMins(mins: number): string {
  // Wrap at 24h for display (1500 mins → "01:00")
  const wrapped = ((mins % 1440) + 1440) % 1440
  return `${Math.floor(wrapped / 60).toString().padStart(2, '0')}:${(wrapped % 60).toString().padStart(2, '0')}`
}

function roundToHalfHour(mins: number): number {
  return Math.round(mins / 30) * 30
}

function ceilToHalfHour(mins: number): number {
  return Math.ceil(mins / 30) * 30
}

// ── Core Slot Calculation ────────────────────────────────────────────────────

export function calculateSlots(
  clientNow: Date,
  programs: Array<{ name: string; start: string; end: string }>,
  openTime: string | null,
  closeTime: string | null,
  kitchenCloseTime: string | null,
  currentPeriods: string[],  // Active service periods (can be multiple if overlapping)
  isPaidTier: boolean,
): SlotCalculationResult {
  
  const nowMins = clientNow.getHours() * 60 + clientNow.getMinutes()
  const currentHour = clientNow.getHours()
  
  // ── Edge Case 1: Social Dead Zone (00:00-05:59) ──────────────────────────
  // Restaurant social media has near-zero reach at these hours.
  // Shift calculations to next service day instead of current (ended) day.
  const isSocialDeadZone = currentHour >= 0 && currentHour < 6
  
  if (isSocialDeadZone && programs.length > 0) {
    // User opened app at 02:00 — generate slots for the upcoming day
    // Find first service period (usually brunch/lunch)
    const firstProgram = programs.reduce((earliest, p) => 
      toMins(p.start) < toMins(earliest.start) ? p : earliest
    )
    
    let dayStartMins = toMins(firstProgram.start)  // e.g., 09:00 from menu
    
    // FIX: Clamp to actual opening time (e.g., 09:30 on weekdays)
    const venueOpenMins = openTime ? toMins(openTime) : null
    if (venueOpenMins !== null && dayStartMins < venueOpenMins) {
      console.log(`⚠️ First program "${firstProgram.name}" starts at ${firstProgram.start} but venue opens at ${openTime}. Clamping to opening time.`)
      dayStartMins = venueOpenMins
    }
    
    const lastEndMins = Math.max(...programs.map(p => {
      const endMins = toMins(p.end)
      const startMins = toMins(p.start)
      // Handle midnight crossing
      return endMins < startMins ? endMins + 1440 : endMins
    }))
    
    const CUTOFF_BUFFER = 90  // 1.5 hours
    const cutoffMins = lastEndMins - CUTOFF_BUFFER
    const availableHours = (cutoffMins - dayStartMins) / 60
    
    const slotCount = availableHours > 8 ? 3 : availableHours >= 5 ? 2 : 1
    
    // Generate slots for the day starting at first service
    const slots = generateSlotsForDay(
      dayStartMins,
      cutoffMins,
      slotCount,
      programs,
      kitchenCloseTime
    )
    
    return {
      slotCount,
      availableHours,
      slots,
      activePeriods: [],  // No periods active NOW (it's 02:00)
      upcomingPeriods: programs.map(p => ({
        name: p.name,
        start: p.start,
        end: p.end,
        startsInHours: (toMins(p.start) - nowMins) / 60
      })),
      isSocialDeadZone: true,
      reasoning: `Social dead zone (${currentHour}:00) — generated ${slotCount} slots for upcoming day starting at ${firstProgram.start}`
    }
  }
  
  // ── Edge Case 2: No Programs (Use Opening Hours) ────────────────────────
  if (programs.length === 0) {
    if (!openTime || !closeTime) {
      // No hours configured at all — return minimal slot
      return {
        slotCount: 1,
        availableHours: 0,
        slots: [{
          position: 1,
          postAtMins: ceilToHalfHour(nowMins),
          postAt: fromMins(ceilToHalfHour(nowMins)),
          suggestedTime: fromMins(ceilToHalfHour(nowMins)),
          eligiblePeriods: ['all_day'],
          allowedContentTypes: ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer'],
          serviceWindow: null,
          isFoodEligible: true,
          isBarOnly: false,
          label: 'NOW (no hours configured)',
          rationale: 'NOW - immediate posting (no service periods configured)'
        }],
        activePeriods: [],
        upcomingPeriods: [],
        isSocialDeadZone: false,
        reasoning: 'No service periods configured — single slot only'
      }
    }
    
    // Synthesize single program from opening hours
    programs = [{
      name: 'DAGSPROGRAM',
      start: openTime,
      end: closeTime
    }]
  }
  
  // ── Step 1: Normalize Times for Midnight-Crossing Venues ────────────────
  // Example: Bar opens 21:00, closes 02:00
  // At 23:00: nowMins = 1380, closeMins = 1500 (02:00 + 1440)
  // At 01:00: nowMins = 1500 (01:00 + 1440), closeMins = 1500
  
  const openMins = openTime ? toMins(openTime) : 0
  const rawCloseMins = closeTime ? toMins(closeTime) : 1440
  
  const isMidnightCrossing = rawCloseMins < openMins && rawCloseMins < 600  // Close < 10:00 AM
  let closeMins = isMidnightCrossing ? rawCloseMins + 1440 : rawCloseMins
  
  // Normalize current time if we're in the late-night continuation of service
  // Only normalize if BOTH current time AND close time are in early morning
  const isLateNightService = nowMins < 360 && rawCloseMins < 360  // Both before 6 AM
  const normalizedNow = isMidnightCrossing && isLateNightService ? nowMins + 1440 : nowMins
  
  // ── Step 2: Find Active and Upcoming Periods ────────────────────────────
  const activePeriods: Array<{ name: string; start: string; end: string; hoursRemaining: number }> = []
  const upcomingPeriods: Array<{ name: string; start: string; end: string; startsInHours: number }> = []
  
  console.log(`🔍 Finding active/upcoming periods at ${fromMins(normalizedNow)}:`)
  
  for (const program of programs) {
    let startMins = toMins(program.start)
    let endMins = toMins(program.end)
    
    // FIX: Clamp program start time to actual venue opening time.
    // If menu says "BRUNCH 09:00-14:00" but venue opens at 09:30 on weekdays,
    // the service window should start at 09:30, not 09:00.
    if (openMins && startMins < openMins) {
      console.log(`⚠️ Program "${program.name}" starts at ${program.start} but venue opens at ${openTime}. Clamping to opening time.`)
      startMins = openMins
    }
    
    // Handle midnight-crossing programs
    if (endMins < startMins && endMins < 600) {
      endMins += 1440
    }
    
    const CUTOFF_BUFFER = 90  // 1.5 hours customer decision buffer
    const effectiveEndMins = endMins - CUTOFF_BUFFER
    
    console.log(`   Program "${program.name}": start=${startMins} (${program.start}), end=${endMins} (${program.end}), effectiveEnd=${effectiveEndMins}`)
    
    if (normalizedNow >= startMins && normalizedNow < effectiveEndMins) {
      // Currently active period (with buffer)
      const hoursRemaining = (effectiveEndMins - normalizedNow) / 60
      activePeriods.push({
        name: program.name,
        start: program.start,
        end: program.end,
        hoursRemaining
      })
      console.log(`      ✅ ACTIVE (${hoursRemaining.toFixed(1)}h remaining)`)
    } else if (normalizedNow < startMins) {
      // Upcoming period
      const startsInHours = (startMins - normalizedNow) / 60
      upcomingPeriods.push({
        name: program.name,
        start: program.start,
        end: program.end,
        startsInHours
      })
      console.log(`      ⏩ UPCOMING (starts in ${startsInHours.toFixed(1)}h)`)
    } else {
      console.log(`      ⏹️  PAST`)
    }
  }
  
  // ── Step 3: Calculate Available Hours (to Last Service - 1.5h) ──────────
  // NEW: Prioritize kitchen close time (food deadline) over venue close (bar/drinks)
  // This ensures slots are calculated for content generation deadlines, not venue hours
  let lastServiceEndMins: number
  let deadlineSource: string  // For debugging/logging
  
  if (kitchenCloseTime) {
    // Use explicit kitchen close time (e.g., 21:30) instead of bar close (e.g., 01:00)
    lastServiceEndMins = toMins(kitchenCloseTime)
    // Handle midnight-crossing kitchen (rare but possible)
    if (lastServiceEndMins < 360) {  // Before 6 AM
      lastServiceEndMins += 1440
    }
    deadlineSource = `kitchen close ${kitchenCloseTime}`
    console.log(`⏰ Using explicit kitchen_close_time: ${kitchenCloseTime}`)
  } else {
    console.log(`⚠️ No kitchen_close_time configured - using program-based detection`)
    console.log(`   Programs: ${programs.map(p => `${p.name} (${p.start}-${p.end})`).join(', ')}`)
    
    // Fallback: Find last FOOD service period (exclude bar/drinks-only periods)
    // Bar periods (multi-language): "bar", "natbar", "drinks", "drikke", "vin", "cocktail"
    // Evening food periods: "aftensmad", "dinner", "evening", "aften"
    const foodPrograms = programs.filter(p => {
      const name = p.name.toLowerCase()
      // Exclude bar/drinks periods (English + Danish)
      const isBarPeriod = name.includes('bar') || 
                          name.includes('drink') || 
                          name.includes('drikke') ||
                          name.includes('cocktail') ||
                          (name.includes('vin') && !name.includes('vinduer')) // "vin" but not "vinduer" (windows)
      return !isBarPeriod
    })
    
    console.log(`   Food programs (${foodPrograms.length}): ${foodPrograms.map(p => p.name).join(', ')}`)
    
    if (foodPrograms.length > 0) {
      // Use last food service period
      lastServiceEndMins = Math.max(...foodPrograms.map(p => {
        const endMins = toMins(p.end)
        const startMins = toMins(p.start)
        return endMins < startMins && endMins < 600 ? endMins + 1440 : endMins
      }))
      const lastFoodProgram = foodPrograms.find(p => {
        const endMins = toMins(p.end)
        return (endMins < 600 ? endMins + 1440 : endMins) === lastServiceEndMins
      })
      deadlineSource = `last food service (${lastFoodProgram?.name} ${lastFoodProgram?.end})`
      console.log(`   ✅ Deadline: ${deadlineSource}`)
    } else {
      // No food periods detected — use last service period (may be drinks-only business)
      lastServiceEndMins = Math.max(...programs.map(p => {
        const endMins = toMins(p.end)
        const startMins = toMins(p.start)
        return endMins < startMins && endMins < 600 ? endMins + 1440 : endMins
      }))
      deadlineSource = 'last service period (no food detected)'
      console.log(`   ⚠️ Deadline: ${deadlineSource}`)
    }
  }
  
  const CUTOFF_BUFFER = 90  // 1.5 hours
  const cutoffMins = lastServiceEndMins - CUTOFF_BUFFER
  const availableHours = Math.max(0, (cutoffMins - normalizedNow) / 60)
  
  // ── Step 4: Determine Slot Count (Hours-Based Formula) ──────────────────
  let slotCount: number
  let reasoning: string
  
  if (!isPaidTier) {
    slotCount = 2
    reasoning = 'Free tier fixed to 2 slots'
  } else if (availableHours > 8) {
    slotCount = 3
    reasoning = `${availableHours.toFixed(1)}h to ${deadlineSource} (> 8h) → 3 slots`
  } else if (availableHours >= 5) {
    slotCount = 2
    reasoning = `${availableHours.toFixed(1)}h to ${deadlineSource} (5-8h) → 2 slots`
  } else if (availableHours >= 2) {
    slotCount = 1
    reasoning = `${availableHours.toFixed(1)}h to ${deadlineSource} (2-5h) → 1 slot`
  } else {
    // Less than 2 hours — still allow 1 slot for immediate posting
    slotCount = 1
    reasoning = `${availableHours.toFixed(1)}h to ${deadlineSource} (< 2h) → 1 immediate slot only`
  }
  
  // ── Step 5: Generate Slot Timings ────────────────────────────────────────
  const slots = generateSlots(
    normalizedNow,
    cutoffMins,
    slotCount,
    programs,
    activePeriods,
    upcomingPeriods,
    kitchenCloseTime
  )
  
  console.log(`📊 Slot calculation complete:`)
  console.log(`   Calculated slot count: ${slotCount}`)
  console.log(`   Generated ${slots.length} slots: ${slots.map(s => `${s.position}@${s.postAt}`).join(', ')}`)
  console.log(`   Reasoning: ${reasoning}`)
  
  return {
    slotCount,
    availableHours,
    slots,
    activePeriods,
    upcomingPeriods,
    isSocialDeadZone: false,
    reasoning
  }
}

// ── Slot Timing Generation ───────────────────────────────────────────────────

function generateSlots(
  nowMins: number,
  cutoffMins: number,
  slotCount: number,
  programs: Array<{ name: string; start: string; end: string }>,
  activePeriods: Array<{ name: string; start: string; end: string; hoursRemaining: number }>,
  upcomingPeriods: Array<{ name: string; start: string; end: string; startsInHours: number }>,
  kitchenCloseTime: string | null
): SlotTiming[] {
  
  const slots: SlotTiming[] = []
  const MIN_SPACING_MINS = 120  // Strict 2-hour minimum between slots
  const MIN_LEAD_TIME_MINS = 120  // Minimum 2 hours before service period ends
  
  const kitchenCloseMins = kitchenCloseTime ? toMins(kitchenCloseTime) : null
  
  // Helper: Validate if a slot time is valid for a service window (at least 120 min before end)
  const isSlotValidForWindow = (slotMins: number, window: { name: string; start: string; end: string } | null): boolean => {
    if (!window) return true
    const endMins = toMins(window.end)
    const adjustedEndMins = endMins < toMins(window.start) ? endMins + 1440 : endMins  // Handle midnight crossing
    return slotMins <= (adjustedEndMins - MIN_LEAD_TIME_MINS)
  }
  
  // ── Slot 1: NOW (Immediate Posting) ──────────────────────────────────────
  // FIX: First slot should be postable NOW (within 60 min of generation time)
  // Constraint: Must be at least nowMins + 15 min (buffer for user to review/edit)
  // Target: nowMins + 30-60 min (natural posting window)
  const minSlot1Mins = nowMins + 15  // Absolute minimum (15 min buffer)
  const targetSlot1Mins = nowMins + 30  // Target: 30 min from now
  const maxSlot1Mins = nowMins + 60  // Maximum: within 1 hour
  
  // If there are active periods, use them; otherwise allow general content
  let slot1Periods = activePeriods.map(p => p.name.toLowerCase())
  let slot1Window = activePeriods.length > 0 ? activePeriods[0] : null
  
  // Calculate slot1 time: prefer target (now+30), but respect half-hour rounding
  let slot1Mins = ceilToHalfHour(targetSlot1Mins)
  
  // If rounding pushed it beyond max window, use the target without rounding
  if (slot1Mins > maxSlot1Mins) {
    slot1Mins = targetSlot1Mins
  }
  
  // Ensure it's not before minimum
  slot1Mins = Math.max(slot1Mins, minSlot1Mins)
  
  console.log(`🎯 Slot 1 calculation:`)
  console.log(`   nowMins: ${nowMins} (${fromMins(nowMins)})`)
  console.log(`   targetSlot1Mins: ${targetSlot1Mins} (${fromMins(targetSlot1Mins)})`)
  console.log(`   slot1Mins (final): ${slot1Mins} (${fromMins(slot1Mins)})`)
  console.log(`   activePeriods: ${activePeriods.map(p => `${p.name} (${p.start}-${p.end})`).join(', ')}`)
  console.log(`   slot1Periods: ${slot1Periods.join(', ')}`)
  
  // NEW: Validate slot is at least 120 minutes before service period ends
  if (slot1Window && !isSlotValidForWindow(slot1Mins, slot1Window)) {
    console.log(`   ⚠️ Slot 1 at ${fromMins(slot1Mins)} is too close to ${slot1Window.name} end (${slot1Window.end})`)
    console.log(`   → Clearing service window assignment - only atmosphere/brand content allowed`)
    slot1Window = null
    slot1Periods = ['all_day']
  }
  
  const slot1IsFoodEligible = (kitchenCloseMins === null || slot1Mins < (kitchenCloseMins - 75)) && slot1Window !== null
  const slot1IsBarOnly = !slot1IsFoodEligible && activePeriods.length > 0
  
  // FIX #3: Determine allowed content types based on kitchen status
  const slot1AllowedContentTypes = slot1IsFoodEligible
    ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer']  // Kitchen open - all types
    : ['atmosphere', 'behind_scenes']  // Kitchen closed - only brand/atmosphere content
  
  slots.push({
    position: 1,
    postAtMins: slot1Mins,
    postAt: fromMins(slot1Mins),
    suggestedTime: fromMins(slot1Mins),
    eligiblePeriods: slot1Periods.length > 0 ? slot1Periods : ['all_day'],
    allowedContentTypes: slot1AllowedContentTypes,  // NEW
    serviceWindow: slot1Window ? {
      name: slot1Window.name,
      start: slot1Window.start,
      end: slot1Window.end
    } : null,
    isFoodEligible: slot1IsFoodEligible,
    isBarOnly: slot1IsBarOnly,
    label: `Slot 1 (NOW): ${fromMins(slot1Mins)}`,
    rationale: 'NOW - drive immediate footfall'
  })
  
  if (slotCount === 1) return slots
  
  // ── Slot 2: Service Transition or Mid-Window ─────────────────────────────
  // Priority: Target next upcoming period start, or mid-point of current period
  let slot2Mins: number
  let slot2Window: { name: string; start: string; end: string } | null = null
  let slot2Rationale: string
  
  if (upcomingPeriods.length > 0) {
    // Next service period is upcoming — schedule at or just before its start
    const nextPeriod = upcomingPeriods[0]
    const nextStartMins = toMins(nextPeriod.start)
    slot2Mins = roundToHalfHour(nextStartMins)
    slot2Window = nextPeriod
    slot2Rationale = `PREVIEW - ${nextPeriod.name} starts soon`
  } else if (activePeriods.length > 0) {
    // No upcoming transitions — space evenly within active period
    const minTime = slot1Mins + MIN_SPACING_MINS
    const maxTime = cutoffMins
    slot2Mins = roundToHalfHour((minTime + maxTime) / 2)
    slot2Window = activePeriods[activePeriods.length - 1]  // Latest active period
    slot2Rationale = `MID-WINDOW - maximize ${slot2Window.name} exposure`
  } else {
    // Fallback: simple spacing
    const minTime = slot1Mins + MIN_SPACING_MINS
    slot2Mins = roundToHalfHour(minTime)
    slot2Rationale = 'LATER - spaced posting'
  }
  
  // Enforce minimum spacing and cutoff
  slot2Mins = Math.max(slot2Mins, slot1Mins + MIN_SPACING_MINS)
  slot2Mins = Math.min(slot2Mins, cutoffMins)
  
  // NEW: Validate slot is at least 120 minutes before service period ends
  if (slot2Window && !isSlotValidForWindow(slot2Mins, slot2Window)) {
    console.log(`   ⚠️ Slot 2 at ${fromMins(slot2Mins)} is too close to ${slot2Window.name} end (${slot2Window.end})`)
    console.log(`   → Looking for next available service period or clearing assignment`)
    
    // Try to find a suitable upcoming period
    const validUpcoming = upcomingPeriods.find(p => isSlotValidForWindow(slot2Mins, p))
    if (validUpcoming) {
      slot2Window = validUpcoming
      slot2Rationale = `PREVIEW - ${validUpcoming.name} (adjusted for timing)`
      console.log(`   → Reassigned to ${validUpcoming.name} (${validUpcoming.start}-${validUpcoming.end})`)
    } else {
      slot2Window = null
      slot2Rationale = 'LATER - no specific service window available'
      console.log(`   → No valid service period found - atmosphere/brand content only`)
    }
  }
  
  const slot2Periods = slot2Window ? [slot2Window.name.toLowerCase()] : ['all_day']
  const slot2IsFoodEligible = (kitchenCloseMins === null || slot2Mins < (kitchenCloseMins - 75)) && slot2Window !== null
  
  // FIX #3: Determine allowed content types based on kitchen status
  const slot2AllowedContentTypes = slot2IsFoodEligible
    ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer']  // Kitchen open - all types
    : ['atmosphere', 'behind_scenes']  // Kitchen closed - only brand/atmosphere content
  
  slots.push({
    position: 2,
    postAtMins: slot2Mins,
    postAt: fromMins(slot2Mins),
    suggestedTime: fromMins(slot2Mins),
    eligiblePeriods: slot2Periods,
    allowedContentTypes: slot2AllowedContentTypes,  // NEW
    serviceWindow: slot2Window,
    isFoodEligible: slot2IsFoodEligible,
    isBarOnly: !slot2IsFoodEligible,
    label: `Slot 2 (PREVIEW): ${fromMins(slot2Mins)}`,
    rationale: slot2Rationale
  })
  
  if (slotCount === 2) return slots
  
  // ── Slot 3: Next Transition or Evening Service ───────────────────────────
  let slot3Mins: number
  let slot3Window: { name: string; start: string; end: string } | null = null
  let slot3Rationale: string
  
  if (upcomingPeriods.length > 1) {
    // Second upcoming period (e.g., dinner after lunch)
    const thirdPeriod = upcomingPeriods[1]
    const thirdStartMins = toMins(thirdPeriod.start)
    slot3Mins = roundToHalfHour(thirdStartMins)
    slot3Window = thirdPeriod
    slot3Rationale = `PREVIEW - ${thirdPeriod.name} evening service`
  } else if (upcomingPeriods.length === 1) {
    // Only one upcoming — space after its start
    const nextPeriod = upcomingPeriods[0]
    const nextStartMins = toMins(nextPeriod.start)
    const minTime = Math.max(slot2Mins + MIN_SPACING_MINS, nextStartMins + MIN_SPACING_MINS)
    slot3Mins = roundToHalfHour(minTime)
    slot3Window = nextPeriod
    slot3Rationale = `LATE PREVIEW - ${nextPeriod.name} extended exposure`
  } else {
    // No upcoming periods — space between slot2 and cutoff
    const minTime = slot2Mins + MIN_SPACING_MINS
    const maxTime = cutoffMins
    slot3Mins = roundToHalfHour((minTime + maxTime) / 2)
    slot3Window = activePeriods.length > 0 ? activePeriods[activePeriods.length - 1] : null
    slot3Rationale = 'LATE WINDOW - final push'
  }
  
  // Enforce minimum spacing and cutoff
  slot3Mins = Math.max(slot3Mins, slot2Mins + MIN_SPACING_MINS)
  slot3Mins = Math.min(slot3Mins, cutoffMins)
  
  // NEW: Validate slot is at least 120 minutes before service period ends
  if (slot3Window && !isSlotValidForWindow(slot3Mins, slot3Window)) {
    console.log(`   ⚠️ Slot 3 at ${fromMins(slot3Mins)} is too close to ${slot3Window.name} end (${slot3Window.end})`)
    console.log(`   → Looking for next available service period or clearing assignment`)
    
    // Try to find a suitable upcoming period
    const validUpcoming = upcomingPeriods.find(p => isSlotValidForWindow(slot3Mins, p))
    if (validUpcoming) {
      slot3Window = validUpcoming
      slot3Rationale = `PREVIEW - ${validUpcoming.name} (adjusted for timing)`
      console.log(`   → Reassigned to ${validUpcoming.name} (${validUpcoming.start}-${validUpcoming.end})`)
    } else {
      slot3Window = null
      slot3Rationale = 'LATE WINDOW - no specific service window available'
      console.log(`   → No valid service period found - atmosphere/brand content only`)
    }
  }
  
  const slot3Periods = slot3Window ? [slot3Window.name.toLowerCase()] : ['all_day']
  const slot3IsFoodEligible = (kitchenCloseMins === null || slot3Mins < (kitchenCloseMins - 75)) && slot3Window !== null
  
  // FIX #3: Determine allowed content types based on kitchen status
  const slot3AllowedContentTypes = slot3IsFoodEligible
    ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer']  // Kitchen open - all types
    : ['atmosphere', 'behind_scenes']  // Kitchen closed - only brand/atmosphere content
  
  slots.push({
    position: 3,
    postAtMins: slot3Mins,
    postAt: fromMins(slot3Mins),
    suggestedTime: fromMins(slot3Mins),
    eligiblePeriods: slot3Periods,
    allowedContentTypes: slot3AllowedContentTypes,  // NEW
    serviceWindow: slot3Window,
    isFoodEligible: slot3IsFoodEligible,
    isBarOnly: !slot3IsFoodEligible,
    label: `Slot 3 (LATE): ${fromMins(slot3Mins)}`,
    rationale: slot3Rationale
  })
  
  return slots
}

// ── Helper: Generate Slots for Upcoming Day (Social Dead Zone) ───────────────

function generateSlotsForDay(
  dayStartMins: number,
  cutoffMins: number,
  slotCount: number,
  programs: Array<{ name: string; start: string; end: string }>,
  kitchenCloseTime: string | null
): SlotTiming[] {
  // This is called when user opens app at 02:00 — generate slots for upcoming day
  // Use same logic but with dayStartMins as "now"
  const spacing = (cutoffMins - dayStartMins) / slotCount
  const slots: SlotTiming[] = []
  
  for (let i = 0; i < slotCount; i++) {
    const slotMins = roundToHalfHour(dayStartMins + (i * spacing))
    const position = (i + 1) as 1 | 2 | 3
    
    // Find which program this slot falls into
    let slotWindow: { name: string; start: string; end: string } | null = null
    for (const program of programs) {
      const startMins = toMins(program.start)
      let endMins = toMins(program.end)
      if (endMins < startMins) endMins += 1440
      
      if (slotMins >= startMins && slotMins < endMins) {
        slotWindow = program
        break
      }
    }
    
    const kitchenCloseMins = kitchenCloseTime ? toMins(kitchenCloseTime) : null
    const isFoodEligible = kitchenCloseMins === null || slotMins < (kitchenCloseMins - 75)
    
    // FIX #3: Determine allowed content types based on kitchen status
    const allowedContentTypes = isFoodEligible
      ? ['menu_item', 'atmosphere', 'behind_scenes', 'event', 'offer']  // Kitchen open - all types
      : ['atmosphere', 'behind_scenes']  // Kitchen closed - only brand/atmosphere content
    
    slots.push({
      position,
      postAtMins: slotMins,
      postAt: fromMins(slotMins),
      suggestedTime: fromMins(slotMins),
      eligiblePeriods: slotWindow ? [slotWindow.name.toLowerCase()] : ['all_day'],
      allowedContentTypes,  // NEW
      serviceWindow: slotWindow,
      isFoodEligible,
      isBarOnly: !isFoodEligible,
      label: `Slot ${position} (DAY): ${fromMins(slotMins)}`,
      rationale: i === 0 ? 'MORNING - day opening' : i === 1 ? 'MIDDAY - lunch rush' : 'EVENING - dinner service'
    })
  }
  
  return slots
}
