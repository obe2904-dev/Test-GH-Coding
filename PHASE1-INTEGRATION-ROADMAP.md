# Phase 1 Integration Roadmap
**Status**: Schema Deployed ✅ | Code Integration Required ❌  
**Date**: 3. maj 2026

---

## 🔴 CRITICAL: Validation Layer Integration (Blocking Issues)

### Problem Summary
Database schema and validation code exist but are **not connected** to the generation pipeline. Posts are being created with timing violations that could have been auto-fixed.

### Issues Caused by Missing Integration:

**Issue 1: Monday 9am Cocktails** ❌
```
Generated: Monday 09:00 → "Stemningsfuld aften med cocktails"
Should be: Friday 17:00 (auto-fixed by validation layer)
Root cause: Validation layer not invoked during generation
```

**Issue 3: No Mors Dag Booking CTA** ❌
```
Generated: Sunday brunch with "awareness" goal
Should be: "drive_bookings" goal with booking CTA
Root cause: Phase 1 doesn't recognize high-commercial occasions
```

**Issue 4-5: "helligdagen" instead of "Kr. Himmelfartsdag"** ⚠️
```
Generated: Generic "helligdagen" reference
Should be: Full event name "Kr. Himmelfartsdag"
Root cause: Event names not passed to Phase 1 prompt
```

---

## 🛠️ Required Integration Work

### 1. Wire Up Validation in Generation Flow (CRITICAL)

**File**: `/supabase/functions/get-weekly-strategy/index.ts`

**Integration Points**:

#### A. After Phase 1 (Strategic Brief)
```typescript
// Validate timing_window values in angles
import { validatePostSchedule } from '../_shared/post-helpers/content-timing-validator.ts';

// After Phase 1 generation, before Phase 2:
for (const angle of strategicBrief.angles) {
  if (angle.timing_window) {
    const validation = await validatePostSchedule({
      content_type: inferContentType(angle.focus),
      day_of_week: getDayFromTimingWindow(angle.timing_window),
      time: getTimeFromTimingWindow(angle.timing_window),
      business_archetype: business.archetype,
      country_code: business.country_code
    });
    
    if (!validation.valid && validation.auto_fix_suggestion) {
      // Apply auto-fix to timing_window
      angle.timing_window = validation.auto_fix_suggestion.suggested_time;
      angle.validation_warning = validation.violations;
    }
  }
}
```

#### B. After Phase 2a (Day Assignment)
```typescript
// Validate day assignments match content type rules
for (const post of assignedPosts) {
  const validation = await validatePostSchedule({
    content_type: post.inferred_content_type,
    day_of_week: getDayOfWeek(post.scheduled_date),
    time: post.scheduled_time,
    business_archetype: business.archetype,
    country_code: business.country_code
  });
  
  if (!validation.valid && validation.auto_fix_suggestion) {
    // Re-assign to valid day/time
    post.scheduled_date = validation.auto_fix_suggestion.suggested_date;
    post.scheduled_time = validation.auto_fix_suggestion.suggested_time;
    post.validation_auto_fixed = true;
  }
}
```

#### C. Before Saving Posts
```typescript
// Final validation + store results
import { validateAndSavePost } from '../_shared/post-helpers/validation-integration-example.ts';

for (const post of generatedPosts) {
  await validateAndSavePost(post, {
    business_archetype: business.archetype,
    country_code: business.country_code,
    auto_fix_critical: true // Apply auto-fix for critical violations
  });
}
```

**Success Metrics**:
- ✅ No drinks posts before 14:00
- ✅ No drinks posts on Monday/Tuesday
- ✅ No brunch posts on weekdays
- ✅ All validation results stored in `daily_suggestions.validation_result`
- ✅ Auto-fix rate > 90%

---

### 2. Fix Phase 1 Occasion Recognition (HIGH PRIORITY)

**File**: `/supabase/functions/_shared/post-helpers/strategy/phase1.ts`

**Changes Needed**:

#### A. Add High-Commercial Occasion Rules
```typescript
// Add to Phase 1 prompt context:

⚠️ BOOKING-KRITISKE ANLEDNINGER (SKAL bruge drive_bookings mål):
• Mors Dag, Fars Dag, Valentinsdag
• Nytår, Jul, Påske
• Store events på kalenderen med commercial_weight > 0.7

REGLER:
1. Når anledningen er booking-kritisk → goal_mode SKAL være "drive_bookings"
2. Content_direction SKAL nævne "Book bord" eller "Reservér plads"
3. Timing skal være 1-2 dage FØR selve dagen (lead-up booking window)

EKSEMPEL - Mors Dag søndag 10. maj:
❌ FORKERT: {
  focus: "Søndag formiddag som familiesamling",
  goal_mode: "retain_loyalty",  // FORKERT!
  timing_window: "Sunday 10:00"
}

✅ KORREKT: {
  focus: "Torsdag-fredag eftermiddag trigger Mors Dag booking",
  goal_mode: "drive_bookings",  // RIGTIGT!
  content_direction: "Book bord til Mors Dag brunch — vis familier ved dækket bord",
  timing_window: "Thursday 14:00"  // Lead-up booking window
}
```

#### B. Include Event Names in Context
```typescript
// When passing calendar events to Phase 1:
const calendarEvents = await getRelevantEvents(weekStart, weekEnd);

// Format for prompt:
const eventContext = calendarEvents.map(event => 
  `• ${event.date_label}: ${event.event_name} ` +
  `(${event.event_type}, commercial_weight: ${event.commercial_weight})` +
  `${event.is_booking_critical ? ' → BOOKING-KRITISK' : ''}`
).join('\n');

// Add to prompt:
KOMMENDE BEGIVENHEDER DENNE UGE:
${eventContext}

VIGTIGT: Brug det fulde event_name i dit narrativ (fx "Kr. Himmelfartsdag", ikke bare "helligdagen")
```

**Success Metrics**:
- ✅ Mors Dag posts use "drive_bookings" goal
- ✅ Booking CTA included in content_direction
- ✅ Event names mentioned by full name in narrative
- ✅ Lead-up timing (Thu-Fri) for Sunday events

---

### 3. Enhanced Daypart Coherence (MEDIUM PRIORITY)

**File**: `/supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`

**Current Behavior**:
```typescript
// Line ~431: Daypart coherence check (WARNING only)
if (titleContainsEvening && scheduledTime < 14:00) {
  console.warn(`Daypart coherence: evening content at morning time`);
  // But post is still saved ❌
}
```

**Upgrade to Auto-Fix**:
```typescript
// After daypart coherence detection:
if (titleContainsEvening && scheduledTime < 14:00) {
  // Run validation
  const validation = await validatePostSchedule({
    content_type: 'drinks', // Inferred from title
    day_of_week: currentDay,
    time: scheduledTime,
    business_archetype: business.archetype
  });
  
  if (!validation.valid && validation.auto_fix_suggestion) {
    // Apply auto-fix
    post.scheduled_date = validation.auto_fix_suggestion.suggested_date;
    post.scheduled_time = validation.auto_fix_suggestion.suggested_time;
    post.validation_result = validation;
    console.info(`Auto-fixed: ${post.title} ${scheduledTime} → ${post.scheduled_time}`);
  }
}
```

**Success Metrics**:
- ✅ Daypart violations auto-fixed (not just warned)
- ✅ Validation results stored
- ✅ No evening-content posts before 14:00

---

## 🟢 FUTURE ENHANCEMENTS (Phase 3-4)

### Issue 2: Smart Language Selection

**Feature**: Multilingual Content Generation  
**Trigger**: Business has multilingual menu + tourist audience context

**Implementation Concept**:
```typescript
// Language detection logic
function determinePostLanguage(business, menu, context) {
  // 1. Check if business has English menu items
  const hasEnglishMenu = menu.some(item => 
    isEnglishText(item.name) || item.language === 'en'
  );
  
  // 2. Check audience/seasonal signals
  const targetsTourists = 
    business.audience_profile?.segments?.includes('tourists') ||
    context.location_intelligence?.tourist_foot_traffic > 0.3 ||
    context.seasonal_factors?.includes('tourist_season');
  
  // 3. Select language
  return (hasEnglishMenu && targetsTourists) ? 'en' : 'da';
}

// Pass to Phase 2b generation
const postLanguage = determinePostLanguage(business, menu, weekContext);

// Update Phase 2b prompt:
SPROG: Generér HELE opslaget (titel, brødtekst, CTA) på ${postLanguage === 'en' ? 'engelsk' : 'dansk'}
${postLanguage === 'en' ? 'Target: International tourists visiting Copenhagen' : ''}
```

**When to Implement**: After Phase 1 validation is stable (2-3 weeks)

**Database Schema** (if needed):
```sql
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS supported_languages TEXT[] DEFAULT '{da}';

ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS post_language TEXT DEFAULT 'da';
```

**Success Metrics**:
- ✅ Tourist-focused businesses get English posts in peak season
- ✅ Menu items shown in original language (not translated)
- ✅ Language matches audience context
- ✅ A/B test: English posts drive higher tourist conversion

---

## 📋 Implementation Checklist

### Week 1: Critical Integration
- [ ] **Day 1-2**: Wire validation into Phase 2a day assignment
- [ ] **Day 3**: Wire validation into Phase 2b post generation
- [ ] **Day 4**: Wire validation into save logic
- [ ] **Day 5**: Test with Cafe Faust - verify no Monday drinks posts
- [ ] **Day 5**: Deploy + monitor validation metrics

### Week 2: Occasion Recognition
- [ ] **Day 1-2**: Add booking-critical occasion rules to Phase 1 prompt
- [ ] **Day 3**: Pass full event names to Phase 1 context
- [ ] **Day 4**: Test with Mors Dag - verify booking CTA
- [ ] **Day 5**: Deploy + monitor commercial conversion

### Week 3: Quality Monitoring
- [ ] **Day 1**: Create validation dashboard (query validation_result)
- [ ] **Day 2-5**: Monitor auto-fix rate, track remaining violations
- [ ] **Week 4+**: Address remaining edge cases

### Future (3-4 weeks):
- [ ] Implement language selection feature
- [ ] A/B test English posts for tourist businesses
- [ ] Expand to regional timing adjustments (Spanish late dinner, etc.)

---

## 🎯 Definition of Done

### Phase 1 Integration Complete When:
1. ✅ Zero drinks posts before 14:00
2. ✅ Zero drinks posts on Monday/Tuesday
3. ✅ Zero brunch posts on weekdays
4. ✅ Mors Dag and similar occasions trigger booking CTA
5. ✅ Event names used in narrative (not generic "helligdagen")
6. ✅ Validation rate > 95%
7. ✅ Auto-fix rate > 90%
8. ✅ All posts have validation_result stored

### Success Evidence:
```sql
-- Daily validation report:
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_posts,
  COUNT(*) FILTER (WHERE (validation_result->>'valid')::boolean = true) as valid_posts,
  COUNT(*) FILTER (WHERE (validation_result->>'auto_fix_applied')::boolean = true) as auto_fixed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (validation_result->>'valid')::boolean = true) / COUNT(*), 1) as validation_rate
FROM daily_suggestions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

Expected output after integration:
```
date       | total_posts | valid_posts | auto_fixed | validation_rate
-----------+-------------+-------------+------------+----------------
2026-05-10 |          20 |          19 |          5 |           95.0
2026-05-09 |          18 |          18 |          3 |          100.0
2026-05-08 |          22 |          21 |          4 |           95.5
```

---

## 📚 Reference Files

**Created (Phase 1 Foundation)**:
- `/supabase/functions/_shared/config/archetype-rules.ts` - 8 base + 4 hybrid archetypes
- `/supabase/functions/_shared/config/regional-adjustments.ts` - 11 countries
- `/supabase/functions/_shared/post-helpers/content-timing-validator.ts` - 7 validation rules
- `/supabase/functions/_shared/post-helpers/validation-integration-example.ts` - Integration patterns
- `/supabase/migrations/PHASE1_ESSENTIAL_SCHEMA.sql` - Database schema (DEPLOYED ✅)
- `/supabase/functions/_shared/post-helpers/strategy/phase1.ts` - Modified (shows rules to AI)

**To Modify (Integration Work)**:
- `/supabase/functions/get-weekly-strategy/index.ts` - Main generation flow (ADD VALIDATION)
- `/supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts` - Day assignment (ADD CHECKS)
- `/supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts` - Post generation (UPGRADE TO AUTO-FIX)
- `/supabase/functions/_shared/post-helpers/strategy/phase1.ts` - Strategic brief (ADD OCCASION RULES)

**Reference Documentation**:
- `/CONTENT-TIMING-IMPLEMENTATION-PLAN.md` - Original 6-phase plan
- `/PHASE1-DEPLOYMENT-GUIDE.md` - Deployment instructions
- This file: `/PHASE1-INTEGRATION-ROADMAP.md` - Integration work plan
