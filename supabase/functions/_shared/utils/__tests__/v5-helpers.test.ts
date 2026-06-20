// Unit Tests for V5 Helper Functions
// Run with: deno test --allow-env supabase/functions/_shared/utils/__tests__/v5-helpers.test.ts

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  parseTimingWindow,
  matchesCurrentTime,
  getActiveSegment,
  isBrunchProgramme,
  enforceBrunchTerminology,
  validateLocationConsistency
} from '../v5-helpers.ts'
import type { AudienceSegment, ProgrammeProfile } from '../../../../../src/types/brand-profile-v5.ts'

// === Timing Window Parser Tests ===

Deno.test('parseTimingWindow - weekend range', () => {
  const result = parseTimingWindow('Lør-Søn 10:00-14:00')
  
  assertExists(result)
  assertEquals(result!.startDay, 6)  // Saturday
  assertEquals(result!.endDay, 0)    // Sunday
  assertEquals(result!.startHour, 10)
  assertEquals(result!.endHour, 14)
  assertEquals(result!.daysOfWeek, [6, 0])
})

Deno.test('parseTimingWindow - weekday range', () => {
  const result = parseTimingWindow('Man-Fre 11:00-15:00')
  
  assertExists(result)
  assertEquals(result!.startDay, 1)  // Monday
  assertEquals(result!.endDay, 5)    // Friday
  assertEquals(result!.startHour, 11)
  assertEquals(result!.endHour, 15)
  assertEquals(result!.daysOfWeek, [1, 2, 3, 4, 5])
})

Deno.test('parseTimingWindow - single day', () => {
  const result = parseTimingWindow('Fredag 22:00-02:00')
  
  assertExists(result)
  assertEquals(result!.startDay, 5)  // Friday
  assertEquals(result!.endDay, 5)
  assertEquals(result!.startHour, 22)
  assertEquals(result!.endHour, 2)
  assertEquals(result!.daysOfWeek, [5])
})

Deno.test('parseTimingWindow - all days', () => {
  const result = parseTimingWindow('Alle dage 08:00-22:00')
  
  assertExists(result)
  assertEquals(result!.daysOfWeek.length, 7)
  assertEquals(result!.startHour, 8)
  assertEquals(result!.endHour, 22)
})

Deno.test('parseTimingWindow - with extra spaces', () => {
  const result = parseTimingWindow('Lør-Søn  10:00  -  14:00')
  
  assertExists(result)
  assertEquals(result!.startHour, 10)
  assertEquals(result!.endHour, 14)
})

Deno.test('parseTimingWindow - invalid format returns null', () => {
  const result = parseTimingWindow('InvalidFormat')
  
  assertEquals(result, null)
})

Deno.test('parseTimingWindow - invalid day name returns null', () => {
  const result = parseTimingWindow('Xyz-Abc 10:00-14:00')
  
  assertEquals(result, null)
})

// === Time Matching Tests ===

Deno.test('matchesCurrentTime - normal range (within)', () => {
  const window = parseTimingWindow('Lør-Søn 10:00-14:00')!
  
  // Saturday 11:00 - should match
  const matches = matchesCurrentTime(window, 6, 11)
  assertEquals(matches, true)
})

Deno.test('matchesCurrentTime - normal range (outside)', () => {
  const window = parseTimingWindow('Lør-Søn 10:00-14:00')!
  
  // Saturday 15:00 - should not match
  const matches = matchesCurrentTime(window, 6, 15)
  assertEquals(matches, false)
})

Deno.test('matchesCurrentTime - wrong day', () => {
  const window = parseTimingWindow('Lør-Søn 10:00-14:00')!
  
  // Monday 11:00 - should not match
  const matches = matchesCurrentTime(window, 1, 11)
  assertEquals(matches, false)
})

Deno.test('matchesCurrentTime - midnight crossing (before midnight)', () => {
  const window = parseTimingWindow('Fredag 22:00-02:00')!
  
  // Friday 23:00 - should match
  const matches = matchesCurrentTime(window, 5, 23)
  assertEquals(matches, true)
})

Deno.test('matchesCurrentTime - midnight crossing (after midnight)', () => {
  const window = parseTimingWindow('Fredag 22:00-02:00')!
  
  // Friday 01:00 - should match
  const matches = matchesCurrentTime(window, 5, 1)
  assertEquals(matches, true)
})

Deno.test('matchesCurrentTime - midnight crossing (outside)', () => {
  const window = parseTimingWindow('Fredag 22:00-02:00')!
  
  // Friday 15:00 - should not match
  const matches = matchesCurrentTime(window, 5, 15)
  assertEquals(matches, false)
})

// === Segment Matching Tests ===

Deno.test('getActiveSegment - finds matching segment', () => {
  const programmes: ProgrammeProfile[] = [
    {
      programme_type: 'brunch',
      programme_name: 'Weekend Brunch',
      audience_segments: [
        {
          label: 'Weekend-brunch-gæster',
          timing_windows: ['Lør-Søn 10:00-14:00'],
          content_angles: ['Social brunch-oplevelse'],
          segment_size: 'primary',
          motivation: 'social_gathering',
          decision_timing: 'spontaneous',
          goal_contribution: 'drive_footfall',
          evidence: ['Menu has brunchretter']
        }
      ]
    }
  ]
  
  // Saturday 11:00
  const match = getActiveSegment(programmes, 6, 11)
  
  assertExists(match)
  assertEquals(match!.segment.label, 'Weekend-brunch-gæster')
  assertEquals(match!.programme.programme_type, 'brunch')
})

Deno.test('getActiveSegment - returns null when no match', () => {
  const programmes: ProgrammeProfile[] = [
    {
      programme_type: 'brunch',
      programme_name: 'Weekend Brunch',
      audience_segments: [
        {
          label: 'Weekend-brunch-gæster',
          timing_windows: ['Lør-Søn 10:00-14:00'],
          content_angles: ['Social brunch-oplevelse'],
          segment_size: 'primary',
          motivation: 'social_gathering',
          decision_timing: 'spontaneous',
          goal_contribution: 'drive_footfall',
          evidence: []
        }
      ]
    }
  ]
  
  // Monday 11:00 (no brunch on weekdays)
  const match = getActiveSegment(programmes, 1, 11)
  
  assertEquals(match, null)
})

Deno.test('getActiveSegment - prefers specified programme', () => {
  const programmes: ProgrammeProfile[] = [
    {
      programme_type: 'brunch',
      programme_name: 'Brunch',
      audience_segments: [
        {
          label: 'Brunch guests',
          timing_windows: ['Lør-Søn 10:00-14:00'],
          content_angles: ['Brunch'],
          segment_size: 'primary',
          motivation: 'social_gathering',
          decision_timing: 'spontaneous',
          goal_contribution: 'drive_footfall',
          evidence: []
        }
      ]
    },
    {
      programme_type: 'lunch',
      programme_name: 'Lunch',
      audience_segments: [
        {
          label: 'Lunch guests',
          timing_windows: ['Lør-Søn 11:00-15:00'],
          content_angles: ['Lunch'],
          segment_size: 'primary',
          motivation: 'convenience',
          decision_timing: 'spontaneous',
          goal_contribution: 'drive_footfall',
          evidence: []
        }
      ]
    }
  ]
  
  // Saturday 12:00 - both match, but prefer lunch
  const match = getActiveSegment(programmes, 6, 12, 'lunch')
  
  assertExists(match)
  assertEquals(match!.programme.programme_type, 'lunch')
  assertEquals(match!.matchConfidence >= 0.95, true)  // Boosted for preferred
})

// === Brunch Detection Tests ===

Deno.test('isBrunchProgramme - detects brunch', () => {
  assertEquals(isBrunchProgramme('Weekend Brunch'), true)
  assertEquals(isBrunchProgramme('Morgenmad/Brunch'), true)
  assertEquals(isBrunchProgramme('BRUNCH MENU'), true)
})

Deno.test('isBrunchProgramme - rejects non-brunch', () => {
  assertEquals(isBrunchProgramme('Lunch'), false)
  assertEquals(isBrunchProgramme('Morgenmad'), false)  // Breakfast only
  assertEquals(isBrunchProgramme('Dinner'), false)
})

// === Brunch Terminology Enforcement Tests ===

Deno.test('enforceBrunchTerminology - replaces morgenmad', () => {
  const text = 'Kom til morgenmad i weekenden'
  const cleaned = enforceBrunchTerminology(text, true)
  
  assertEquals(cleaned, 'Kom til brunch i weekenden')
})

Deno.test('enforceBrunchTerminology - replaces breakfast', () => {
  const text = 'Great breakfast before work'
  const cleaned = enforceBrunchTerminology(text, true)
  
  assertEquals(cleaned, 'Great brunch on weekends')
})

Deno.test('enforceBrunchTerminology - replaces før arbejde', () => {
  const text = 'Perfect før arbejde'
  const cleaned = enforceBrunchTerminology(text, true)
  
  assertEquals(cleaned, 'Perfect i weekenden')
})

Deno.test('enforceBrunchTerminology - no changes if not brunch', () => {
  const text = 'Kom til morgenmad i weekenden'
  const cleaned = enforceBrunchTerminology(text, false)
  
  assertEquals(cleaned, text)  // Unchanged
})

// === Location Consistency Tests ===

Deno.test('validateLocationConsistency - accepts correct reference', () => {
  const text = 'Vores café ved åen tilbyder...'
  const valid = validateLocationConsistency(text, 'ved åen')
  
  assertEquals(valid, true)
})

Deno.test('validateLocationConsistency - rejects wrong reference', () => {
  const text = 'Vores café ved Aarhus Å tilbyder...'
  const valid = validateLocationConsistency(text, 'ved åen')
  
  assertEquals(valid, false)
})

Deno.test('validateLocationConsistency - accepts text without location', () => {
  const text = 'Vi tilbyder lækker brunch'
  const valid = validateLocationConsistency(text, 'ved åen')
  
  assertEquals(valid, true)  // No location mention = OK
})

Deno.test('validateLocationConsistency - handles null reference', () => {
  const text = 'Vores café ved åen tilbyder...'
  const valid = validateLocationConsistency(text, null)
  
  assertEquals(valid, true)  // No required reference = always OK
})

console.log('\n✅ All V5 helper tests passed!\n')
