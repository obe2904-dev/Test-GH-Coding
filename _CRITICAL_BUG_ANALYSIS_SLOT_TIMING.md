# Critical Bug Analysis: Slot Generation & Timing Issues

**Date**: 2026-06-24  
**Reported by**: User  
**Context**: Regenerating quick suggestions at 15:12 (local time Denmark)

## Observed Issues

### 1. Only 1 Suggestion Generated (Expected: 2-3)
**Actual Output**: 1 menu-driven idea  
**Expected**: 2-3 suggestions based on:
- Kitchen closes at 21:30
- Current time: 15:12
- Hours until kitchen close: ~6.3 hours
- Content deadline: 21:30 - 75min = 20:15 (~5 hours remaining)

**Expected Slot Count Logic**:
```typescript
// From operational-timeline.ts computeSlotCount():
const contentDeadline = kitchenCloseMins - FOOD_LEAD_MINS  // 1290 - 75 = 1215 (20:15)
const hoursOfContentRemaining = (contentDeadline - nowMins) / 60  // (1215 - 912) / 60 = 5.05 hours

// With 5.05 hours remaining:
if (hoursOfContentRemaining >= 2.5) return 3  // ✅ Should return 3
if (hoursOfContentRemaining >= 1.5) return 2
return 1
```

**Diagnosis**: Slot calculator returned 1 instead of 3. Possible causes:
- `isLateNight` flag incorrectly set to true
- Incorrect `closeMins` value (venue close may be set earlier than 21:30)
- Service state incorrectly detected as `post_service`

### 2. Timing Intelligence Failure
**Actual Output**: "Vi serverer frokost lige nu (12:00-15:00) — Klokken nærmer sig 13:30"  
**Current Time**: 15:12 (3:12 PM)  
**Problem**: Suggesting lunch service that ended 12 minutes ago

**Root Cause Analysis**:
- Lunch service: 12:00-15:00 (720-900 minutes)
- Current time: 15:12 (912 minutes)
- `detectServicePeriod()` should return empty `currentPeriods` array
- But suggestion text references lunch as "lige nu" (right now)

**Diagnosis**: The AI generated timing text referencing a service period that has already ended. The prompt context likely included:
- Lunch items in rotation queue (correct - they're valid for later service)
- But the AI inferred from item availability that lunch is active NOW (incorrect)

**Fix Required**: Add explicit "post-service" timing guard to prevent suggesting ended service periods.

### 3. Missing Non-Menu Idea
**Actual Output**: 1 menu item suggestion  
**Expected**: At least 1 non-menu idea (atmosphere or BTS)

**Requirement** (from conversation summary):
> "One idea must be a non-menu/drink idea"

**Diagnosis**: With only 1 slot generated:
- Slot A defaults to menu_item (offering slot)
- Slots B/C (which include non-menu types) not generated

**Related**: Slot C typically provides atmosphere/BTS content types.

## Code Locations

### Slot Count Calculation
**File**: `supabase/functions/get-quick-suggestions/operational-timeline.ts`  
**Lines**: 325-365 (`computeSlotCount`)

**Critical Check** (line 332):
```typescript
if (isLateNight) return 1  // ⚠️ May be incorrectly triggered
```

**isLateNight Definition** (line 223):
```typescript
const isLateNight = serviceState === 'post_service' || closeMins <= normalizedNow ||
  (isSocialDeadZone && serviceState !== 'pre_opening')
```

### Service Period Detection
**File**: `supabase/functions/_shared/content-planning/service-period-detector.ts`  
**Lines**: 125-130

**Correct Logic**:
```typescript
if (currentMinutes >= window.startMinutes && currentMinutes < window.endMinutes) {
  // Should be FALSE for lunch at 15:12
  // 912 >= 720 (✓) AND 912 < 900 (✗) → Not active
}
```

### Timing Context in Prompts
**File**: `supabase/functions/_shared/dagens-forslag-prompt-builder.ts`  
**Lines**: 910-911

**Prompt Instructions** (examples shown to AI):
```
1. Aktiv service-periode: "Vi serverer frokost lige nu (12:00-15:00)"
2. Nuværende tidspunkt: "Klokken nærmer sig ${ctx.currentHour}:00"
```

**Problem**: AI interprets availability of lunch items as "lunch is active now"

## Required Fixes

### Fix 1: Debug Slot Count (Priority: CRITICAL)
**Action**: Add comprehensive logging to trace slot count determination

**Location**: `operational-timeline.ts` computeSlotCount()
```typescript
console.log(`🔍 Slot Count Debug:
  nowMins: ${nowMins}
  closeMins: ${closeMins}
  kitchenCloseMins: ${kitchenCloseMins}
  contentDeadline: ${kitchenCloseMins - FOOD_LEAD_MINS}
  hoursRemaining: ${((kitchenCloseMins - FOOD_LEAD_MINS) - nowMins) / 60}
  isLateNight: ${isLateNight}
  serviceState: ${serviceState}
  isPaidTier: ${isPaidTier}
  → effectiveSlotCount: ${result}
`)
```

### Fix 2: Add Post-Service Timing Guard (Priority: HIGH)
**Action**: Prevent AI from suggesting ended service periods

**Location**: `dagens-forslag-prompt-builder.ts` buildSharedContext()

**Add to confirmed facts**:
```typescript
// After current program detection
if (ctx.currentProgram) {
  // Active service period - normal handling
  lines.push(`- 🍽️ AKTIV SERVICE: ${ctx.currentProgram.name} (${ctx.currentProgram.start}–${ctx.currentProgram.end})`)
} else {
  // No active service - add explicit guard
  const nextProgram = /* detect next upcoming service */
  if (nextProgram) {
    lines.push(`- ⏰ VIGTIG TIMING: Nuværende serviceperiode er afsluttet. Næste service: ${nextProgram.name} kl. ${nextProgram.start}`)
    lines.push(`- ⚠️ Undgå at nævne "serverer lige nu" — brug fremtidsrettet framing: "Snart serverer vi..." eller "Om ${timeUntilNext} serverer vi..."`)
  }
}
```

### Fix 3: Enforce Non-Menu Diversity (Priority: MEDIUM)
**Action**: Ensure at least 1 non-menu slot when multiple slots generated

**Location**: `index.ts` slot generation logic (lines 3420-3600)

**Current Logic**:
```typescript
if (effectiveSlotCount >= 3 && hasMenuBasedSlotA) {
  // Generate unified B+C (may both be menu items)
}
```

**Required**:
```typescript
// Force Slot C to be non-menu when Slot A is menu
if (effectiveSlotCount >= 2 && hasMenuBasedSlotA) {
  // Slot B can be menu_item or non-menu
  // Slot C MUST be atmosphere or behind_scenes
  const slotCTypes = ['atmosphere', 'behind_scenes']
  // Force non-menu type selection
}
```

## Testing Requirements

### Test Case 1: Mid-Afternoon Regeneration
**Setup**:
- Time: 15:12 (after lunch, before dinner)
- Kitchen close: 21:30
- Service periods: Lunch (12:00-15:00), Dinner (17:00-22:00)

**Expected**:
- effectiveSlotCount: 3
- Slot A: Menu item (dinner menu or all-day item)
- Slot B: Menu or non-menu
- Slot C: Non-menu (atmosphere/BTS)
- Timing: References upcoming dinner service OR current gap period
- No references to "serverer frokost lige nu"

### Test Case 2: Late Night Mode
**Setup**:
- Time: 23:00
- Kitchen close: 21:30 (already closed)

**Expected**:
- effectiveSlotCount: 1
- isLateNight: true
- Content type: atmosphere only (no food)

### Test Case 3: Full Service Window
**Setup**:
- Time: 12:30 (mid-lunch)
- Kitchen close: 21:30
- Active service: Lunch (12:00-15:00)

**Expected**:
- effectiveSlotCount: 3
- Active service detected correctly
- Timing: "Vi serverer frokost lige nu (12:00-15:00)" is CORRECT

## Next Steps

1. **Immediate**: Add debug logging to slot count calculation
2. **High Priority**: Test with user's exact scenario (15:12, kitchen 21:30)
3. **High Priority**: Add post-service timing guard
4. **Medium Priority**: Enforce non-menu diversity requirement
5. **Documentation**: Update prompt-database-data-map.md with timing intelligence rules
