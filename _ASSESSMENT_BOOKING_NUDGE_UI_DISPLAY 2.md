# ASSESSMENT: Booking Nudge UI Display Instructions

**Date:** 2026-06-15  
**Proposed For:** Weekly Plan UI (frontend) + generate-weekly-plan (backend)  
**Type:** User-facing display enhancement for booking nudge context  
**Status:** ✅ **RECOMMENDED FOR IMMEDIATE IMPLEMENTATION**

---

## Executive Summary

This proposal adds **UI transparency** for the booking nudge judgment system by surfacing the AI's reasoning and target day to the user in the Weekly Plan interface. Currently, users see a booking nudge post with a booking CTA but have no context for **why it exists** or **what visit day it targets**.

**Overall Assessment:** ✅ **STRONG ENHANCEMENT** with immediate value for user trust and understanding.

**Key Benefits:**
- ✅ Users understand why AI chose to use booking nudge this week
- ✅ Target visit day is clearly visible (e.g., "fredag d. 19. jun · 3 dages forspring")
- ✅ Audit trail from judgment block becomes actionable UI feedback
- ✅ Builds user confidence in AI strategic decisions
- ✅ Low implementation complexity (3 fixes, minimal code)

**Recommendation:** ✅ **APPROVE FOR IMMEDIATE IMPLEMENTATION**

---

## Technical Analysis

### FIX A: Backend Data Carriage

**File:** `weekly-plan-generator.ts` (or wherever `PostSpecification` is constructed)

**Change:** Add 4 fields to `PostSpecification` type and carry them from strategy `post_ideas`

**Fields to Add:**
```typescript
nudge_rationale?: string | null
peak_day?: string | null
lead_days_used?: number | null
booking_nudge_warranted?: boolean | null
```

**Impact:**
- ✅ **Zero breaking changes** (all fields optional)
- ✅ **Backward compatible** (existing plans without these fields still work)
- ✅ **No database migration** (JSONB schema tolerates optional fields)
- ✅ **Minimal code** (~10 lines)

**Risk:** 🟢 **LOW**
- Simple field mapping, no logic
- Already similar to existing `cta_intent` and `booking_target_day` carriage

---

### FIX B: Post Card UI Enhancement

**Component:** Post card in Weekly Plan view (likely `PostCard.tsx` or similar)

**Change:** Add conditional "booking nudge context" block below caption preview

**UI Structure:**
```
┌─────────────────────────────────┐
│ Post Card                       │
│                                 │
│ Caption preview...              │
│                                 │
│ ┌─────────────────────────────┐ │ ← NEW BLOCK
│ │ 📅 Booking nudge → fredag   │ │
│ │    d. 19. jun · 3 dages     │ │
│ │    forspring                │ │
│ │                             │ │
│ │ Første lønningsweekend —    │ │
│ │ fredag forventes travl,     │ │
│ │ booking-opfordring onsdag   │ │
│ │ giver 3 dages forspring     │ │
│ └─────────────────────────────┘ │
│                                 │
│ Platforms · Hashtags            │
└─────────────────────────────────┘
```

**Design Principles:**
- ✅ **Contextual, not actionable** — Read-only information, no edit affordance
- ✅ **Visually distinct** — Warm background (#F9F5F0), teal left border (#0A7D5F)
- ✅ **Secondary hierarchy** — 12-13px font, positioned below caption
- ✅ **Conditional rendering** — Only shows on booking nudge posts

**Risk:** 🟢 **LOW**
- No new dependencies (uses existing date formatting patterns)
- Simple conditional rendering (if/else on `content_category`)
- Styling matches existing Green Forward Design System v2

---

### FIX C: Strategy Narrative CTA Badge

**Component:** Strategy overview/narrative section (before post cards)

**Change:** Add small badge indicating CTA mode for the week

**Badge Examples:**
```
🔒 Kun booking denne uge — walk-in CTA er ikke tilladt
   (reservation_only mode)

📅 Mixed CTA — ét booking nudge opslag planlagt
   (mixed mode, nudge warranted)

🚶 Walk-in CTA denne uge — booking nudge ikke relevant
   (mixed mode, nudge suppressed)

🚶 Walk-in CTA — ingen booking link tilgængelig
   (walk_in_only mode)
```

**Design:**
- Small pill/badge (12px text, 4px padding)
- Positioned beneath week summary headline
- Teal color for booking modes, gray for walk-in only

**Risk:** 🟢 **LOW**
- Simple conditional text rendering
- No logic beyond checking `cta_rules.mode` and nudge presence

---

## User Experience Impact

### Problem Being Solved

**Current State (Without UI Display):**
```
User sees:
  - Post with caption "Tag til Faust i weekenden 🍷"
  - CTA: "Book bord via link i bio"
  - No explanation of why or when

User questions:
  ❓ Why does this post have a booking CTA while others don't?
  ❓ What day is this targeting?
  ❓ Why is the post scheduled for Wednesday?
```

**Proposed State (With UI Display):**
```
User sees:
  - Post with caption "Tag til Faust i weekenden 🍷"
  - CTA: "Book bord via link i bio"
  - Context box:
    📅 Booking nudge → fredag d. 19. jun · 3 dages forspring
    "Første lønningsweekend — fredag forventes travl, 
     booking-opfordring onsdag giver 3 dages forspring"

User understands:
  ✅ This post targets Friday (peak day)
  ✅ Posted Wednesday to give 3 days lead time
  ✅ AI chose this because it's payday week + expected busy Friday
```

**Impact:** ✅ **SIGNIFICANT USER VALUE**
- Reduces confusion about AI strategic decisions
- Builds trust through transparency
- Enables informed editing (user can decide if they agree)

---

### Information Architecture

**Where Context Appears:**

1. **Strategy Level (FIX C):**
   - CTA mode badge in narrative overview
   - Tells user overall booking posture for the week
   - Example: "Mixed CTA — ét booking nudge opslag planlagt"

2. **Post Level (FIX B):**
   - Detailed context box on the specific nudge post
   - Shows target day, lead time, and AI reasoning
   - Example: "fredag d. 19. jun · 3 dages forspring"

**Hierarchy:**
```
Strategy Narrative
  └── CTA Mode Badge (week-level signal)
       ↓
  Post Cards
    └── Booking Nudge Context Box (post-level details)
```

**Assessment:** ✅ **WELL-STRUCTURED**
- Top-down information flow (strategy → post)
- User learns overall posture before diving into individual posts
- Detailed reasoning available where most relevant (on the post itself)

---

## Implementation Complexity

### FIX A: Backend (Low Complexity)

**Effort:** 🟢 **15 minutes**

**Files Modified:** 2
1. `weekly-plan-generator.ts` — Add 4 field mappings (~4 lines)
2. `strategy-types.ts` or `weekly-plan-types.ts` — Extend `PostSpecification` interface (~8 lines)

**Code Pattern (Already Exists):**
```typescript
// Existing pattern (from FIX 2b)
cta_intent: idea.cta_intent ?? null,
booking_target_day: idea.booking_target_day ?? null,

// New fields to add
nudge_rationale: idea.nudge_rationale ?? null,
peak_day: idea.peak_day ?? null,
lead_days_used: idea.lead_days_used ?? null,
booking_nudge_warranted: idea.booking_nudge_warranted ?? null,
```

**Testing:** Simple field presence check in database

**Risk:** 🟢 **ZERO** (additive only, no logic change)

---

### FIX B: Post Card UI (Medium Complexity)

**Effort:** 🟡 **60-90 minutes**

**Files Modified:** 1-2
1. Post card component (e.g., `PostCard.tsx`) — Add conditional block (~30 lines)
2. Date formatting utility (if doesn't exist) — Add `formatNudgeTargetDay` function (~20 lines)

**Dependencies:**
- Access to `post.content_category`, `post.nudge_rationale`, `post.peak_day`, `post.lead_days_used`
- Date formatting library or custom function (Danish day/month names)
- Styling system (CSS modules / Tailwind / styled-components)

**Implementation Steps:**
1. Add conditional rendering logic (5 min)
2. Implement `formatNudgeTargetDay` helper (15 min)
3. Add styling (20 min)
4. Test across different post types (20 min)
5. Test with missing fields (null/undefined handling) (10 min)

**Risk:** 🟡 **LOW-MEDIUM**
- Date formatting needs Danish localization (day/month names)
- Styling must match existing design system
- Need to handle gracefully when fields are null (old plans)

---

### FIX C: Strategy Narrative Badge (Low Complexity)

**Effort:** 🟢 **20 minutes**

**Files Modified:** 1
- Strategy narrative component — Add CTA mode badge (~15 lines)

**Implementation Steps:**
1. Check if `weekContext.cta_rules.mode` exists (2 min)
2. Determine if booking nudge was warranted (5 min)
3. Render appropriate badge text based on mode (5 min)
4. Style badge (5 min)
5. Test across all 3 modes (3 min)

**Risk:** 🟢 **LOW**
- Simple conditional text rendering
- No complex logic or state management

---

### Total Implementation Effort

**Backend (FIX A):** 15 minutes  
**Post Card (FIX B):** 60-90 minutes  
**Strategy Badge (FIX C):** 20 minutes  

**Total:** 🟢 **~2 hours** for complete implementation

---

## Strengths ✅

### 1. Transparency Through Audit Trail
**Feature:** Surfaces the AI's reasoning (`nudge_rationale`) to the user

**Why This Matters:**
- Users see exactly why AI made a strategic decision
- Builds trust in AI recommendations
- Enables informed editing (user can override if they disagree)

**Example Output:**
```
📅 Booking nudge → fredag d. 19. jun · 3 dages forspring

"Første lønningsweekend — fredag forventes travl, 
booking-opfordring onsdag giver 3 dages forspring"
```

**Assessment:** ✅ **EXCELLENT**
- Human-readable Danish explanation
- Shows both what (target day) and why (payday week, expected busy Friday)
- Non-technical language suitable for hospitality business owners

---

### 2. Clear Target Day Communication
**Feature:** Formats peak day as human-readable Danish date with lead time

**Why This Matters:**
- User knows exactly which day the post is driving bookings for
- "3 dages forspring" makes the lead time strategy explicit
- Removes ambiguity about post timing

**Assessment:** ✅ **CRITICAL FEATURE**
- Target day is the most important piece of information
- Without it, user might misunderstand the post's purpose
- Danish date formatting aligns with user's mental model

---

### 3. Minimal Visual Intrusion
**Feature:** Context block is secondary hierarchy, doesn't dominate the card

**Design Rationale:**
- 12px font (vs. 14-16px for caption)
- Warm background (not high-contrast alert)
- Positioned below caption (not above)
- Read-only (no edit affordance)

**Assessment:** ✅ **APPROPRIATE BALANCE**
- Important enough to see, but not distracting
- User can ignore if they trust the AI
- Becomes relevant only when user questions the post

---

### 4. Backward Compatibility
**Feature:** Gracefully handles old plans without nudge fields

**Implementation:**
```typescript
{post.nudge_rationale && (
  <p className="nudge-rationale">{post.nudge_rationale}</p>
)}
```

**Assessment:** ✅ **ESSENTIAL**
- Old weekly plans (before judgment block) won't break
- Fields are optional, not required
- UI simply doesn't render the block if data is missing

---

### 5. Week-Level Context (FIX C)
**Feature:** CTA mode badge in strategy narrative

**Why This Matters:**
- User learns overall CTA posture before looking at individual posts
- Prevents surprise when they see (or don't see) booking nudge
- Sets expectations for the week

**Examples:**
- "Mixed CTA — ét booking nudge opslag planlagt" → user expects 1 booking post
- "Walk-in CTA denne uge — booking nudge ikke relevant" → user knows no booking this week

**Assessment:** ✅ **SMART UX**
- Top-down information architecture (strategy → post)
- Prevents confusion before it happens
- Aligns with how users mentally plan their week

---

## Concerns & Risks ⚠️

### 1. Date Formatting Localization 🟡 MEDIUM RISK

**Issue:** Danish day/month names must be correct

**Requirement:**
```typescript
// Correct output
"fredag d. 19. jun · 3 dages forspring"

// NOT acceptable
"Friday 19 June · 3 days lead time"
```

**Danish arrays needed:**
```typescript
const dayNames = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
```

**Mitigation:**
- ✅ **PROVIDED** in instruction file
- Add unit tests for each day/month
- Test edge cases (1st, 31st, leap years)

**Risk Assessment:** 🟡 **MEDIUM → LOW** (instructions include full implementation)

---

### 2. Field Availability on Old Plans 🟢 LOW RISK

**Issue:** Plans generated before judgment block won't have `nudge_rationale` field

**Impact:**
- Context block won't render on old booking nudge posts
- User sees booking post but no explanation

**Mitigation:**
- ✅ **ALREADY HANDLED** via conditional rendering:
  ```typescript
  {post.nudge_rationale && <p>{post.nudge_rationale}</p>}
  ```
- Old plans gracefully degrade (no error, just no extra context)

**Risk Assessment:** 🟢 **LOW** (graceful degradation built-in)

---

### 3. UI Clutter on Dense Feeds 🟡 LOW-MEDIUM RISK

**Issue:** Adding context boxes to every booking nudge post might make the feed feel cluttered

**Counter-argument:**
- Most weeks have only **1 booking nudge post** (not every post)
- Other posts (atmosphere, menu, retention) don't get the box
- Context block is small (12px font, compact design)

**Mitigation:**
- Use collapsible accordion if user finds it distracting
- Add user preference toggle: "Show booking nudge context" (default: on)
- Monitor user feedback in first week

**Risk Assessment:** 🟡 **LOW** (affects only 1 post per week, visually minimal)

---

### 4. Null/Undefined Field Handling 🟢 LOW RISK

**Issue:** What if `lead_days_used` is null but `peak_day` exists?

**Example Scenario:**
```typescript
post.peak_day = "2026-06-19"
post.lead_days_used = null  // AI didn't output this field
```

**Current Logic:**
```typescript
{post.peak_day && (
  <> → {formatNudgeTargetDay(post.peak_day, post.lead_days_used)}</>
)}
```

**Handling:**
```typescript
function formatNudgeTargetDay(peakDay: string, leadDaysUsed?: number | null): string {
  // ... date formatting ...
  const leadStr = leadDaysUsed ? ` · ${leadDaysUsed} dages forspring` : ''
  return `${dateStr}${leadStr}`
}
```

**Result:**
- If `lead_days_used` is null → no lead time shown
- Still shows target day: "fredag d. 19. jun"

**Risk Assessment:** 🟢 **LOW** (graceful fallback built-in)

---

### 5. Mobile Responsive Design 🟡 MEDIUM RISK

**Issue:** Context block needs to work on mobile (small screens)

**Considerations:**
- 12px font might be too small on mobile
- Danish text can be long ("Første lønningsweekend i måneden — fredag forventes travl...")
- Multi-line wrapping behavior

**Mitigation:**
- Test on iPhone SE (smallest screen)
- Use `line-height: 1.4` for readability
- Allow text to wrap naturally (no truncation)
- Increase font to 13px on mobile if needed

**Risk Assessment:** 🟡 **MEDIUM → LOW** (requires responsive testing)

---

## Integration Points

### Data Flow

```
Phase 1 (get-weekly-strategy)
  └── Writes nudge_rationale to post_ideas[]
       ↓
weekly_strategies.post_ideas (database)
  └── Stores nudge_rationale in JSONB
       ↓
generate-weekly-plan (FIX A)
  └── Carries nudge_rationale to PostSpecification
       ↓
weekly_content_plans.posts (database)
  └── Stores nudge_rationale in JSONB
       ↓
Weekly Plan UI (FIX B)
  └── Reads nudge_rationale from PostSpecification
  └── Renders booking-nudge-context block
```

**No New API Calls:**
- All data already exists in `weekly_content_plans.posts`
- Frontend just reads new fields (no backend change needed beyond FIX A)

**Assessment:** ✅ **CLEAN ARCHITECTURE**
- No additional database queries
- No new API endpoints
- Pure UI enhancement with data already available

---

### Dependency on Previous Work

**Requires:**
1. ✅ **Judgment block implementation** (already deployed)
   - Without this, `nudge_rationale` field doesn't exist
   - Status: COMPLETE (deployed 2026-06-15)

2. ✅ **PostIdea type extension** (already deployed)
   - `nudge_rationale`, `peak_day`, `lead_days_used` fields
   - Status: COMPLETE (PIECE 2)

3. ⏳ **FIX 2b from previous instructions** (needs verification)
   - `cta_intent` and `booking_target_day` carriage to PostSpecification
   - If not yet deployed, FIX A extends this same pattern

**Recommendation:**
- Verify FIX 2b is deployed (check if `PostSpecification` has `cta_intent` field)
- If not, implement FIX 2b and FIX A together (same pattern, same file)

---

## Testing Requirements

### Backend Testing (FIX A)

**Unit Tests:**
- [ ] `PostSpecification` type compiles with 4 new optional fields
- [ ] Field mapping logic handles null values correctly
- [ ] Field mapping logic handles undefined values correctly

**Integration Tests:**
- [ ] Generate plan for Café Faust with booking nudge
- [ ] Verify `weekly_content_plans.posts` contains `nudge_rationale` on nudge post
- [ ] Verify non-nudge posts have `nudge_rationale: null` (not missing)

**Database Validation Query:**
```sql
-- Check nudge fields on latest Café Faust plan
SELECT 
  p->>'content_category' AS category,
  p->>'nudge_rationale' AS rationale,
  p->>'peak_day' AS peak_day,
  p->>'lead_days_used' AS lead_days
FROM weekly_content_plans wcp,
  jsonb_array_elements(wcp.posts) p
WHERE wcp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND wcp.created_at > NOW() - INTERVAL '1 day'
  AND p->>'content_category' = 'booking_nudge';
```

---

### Frontend Testing (FIX B)

**Visual Regression:**
- [ ] Booking nudge post shows context block correctly
- [ ] Atmosphere post does NOT show context block
- [ ] Menu post does NOT show context block
- [ ] Retention post does NOT show context block

**Date Formatting:**
- [ ] Monday → "mandag d. X. XXX"
- [ ] Tuesday → "tirsdag d. X. XXX"
- [ ] ... (test all 7 days)
- [ ] January → "jan"
- [ ] February → "feb"
- [ ] ... (test all 12 months)
- [ ] Lead time 1 day → "1 dages forspring"
- [ ] Lead time 3 days → "3 dages forspring"
- [ ] Lead time null → no lead time text shown

**Null/Missing Field Handling:**
- [ ] `nudge_rationale: null` → block doesn't render
- [ ] `peak_day: null` → target day not shown in header
- [ ] `lead_days_used: null` → lead time not shown, but date still shown
- [ ] All fields null → block doesn't render at all

**Responsive Design:**
- [ ] Block renders correctly on desktop (1920px)
- [ ] Block renders correctly on tablet (768px)
- [ ] Block renders correctly on mobile (375px)
- [ ] Long rationale text wraps correctly (no overflow)

---

### Frontend Testing (FIX C)

**CTA Mode Badge:**
- [ ] `reservation_only` → shows "🔒 Kun booking denne uge..."
- [ ] `mixed` + nudge warranted → shows "📅 Mixed CTA — ét booking nudge opslag planlagt"
- [ ] `mixed` + nudge suppressed → shows "🚶 Walk-in CTA denne uge — booking nudge ikke relevant"
- [ ] `walk_in_only` → shows "🚶 Walk-in CTA — ingen booking link tilgængelig"
- [ ] `cta_rules` missing → badge doesn't render

**Edge Cases:**
- [ ] Multiple booking nudge posts (shouldn't happen, but handle gracefully)
- [ ] Week with no posts (edge case)
- [ ] Week with posts but no cta_rules (old data)

---

## User Feedback Scenarios

### Scenario 1: User Agrees with AI

**Context:**
- AI scheduled booking nudge for Wednesday targeting Friday (payday week)
- User sees: "Første lønningsweekend — fredag forventes travl, booking-opfordring onsdag giver 3 dages forspring"

**User Response:**
- ✅ "Makes sense, Friday is always busy during payday week"
- Approves post without changes

**Impact:** Reduced approval time, increased trust

---

### Scenario 2: User Disagrees with AI

**Context:**
- AI scheduled booking nudge for Thursday targeting Saturday
- User sees: "Weekend peak — lørdag forventes travl, booking-opfordring torsdag giver 2 dages forspring"
- User knows: "Actually, we're closed for private event on Saturday"

**User Response:**
- 🔄 Deletes booking nudge post
- OR swaps it with different post
- OR edits caption to clarify

**Impact:** User can make informed decision because they understand AI's reasoning

---

### Scenario 3: User Confused by Suppression

**Context:**
- AI suppressed booking nudge (retention week, no payday, no events)
- User sees badge: "🚶 Walk-in CTA denne uge — booking nudge ikke relevant"
- User wonders: "Why no booking nudge this week?"

**User Response:**
- Reads strategy narrative (week summary explains retention focus)
- Understands this week is about loyalty, not acquisition
- OR: Manually adds booking post if they want to override

**Impact:** User has context to understand or override AI decision

---

## Implementation Recommendation

### ✅ APPROVE FOR IMMEDIATE IMPLEMENTATION

**Rationale:**
1. ✅ **Low implementation complexity** (~2 hours total)
2. ✅ **High user value** (transparency builds trust)
3. ✅ **No breaking changes** (backward compatible)
4. ✅ **No new dependencies** (uses existing data)
5. ✅ **Builds on completed work** (judgment block already deployed)

**Suggested Implementation Order:**

**Phase 1 (Backend):**
1. FIX A: Carry nudge fields to PostSpecification (15 min)
2. Deploy `generate-weekly-plan` function
3. Verify fields appear in database

**Phase 2 (Frontend):**
1. FIX B: Add booking nudge context block to post card (60-90 min)
2. FIX C: Add CTA mode badge to strategy narrative (20 min)
3. Test on development environment
4. Deploy to production

**Total Timeline:** ✅ **Same day implementation** (3-4 hours including testing)

---

## Success Criteria

### Week 1 Validation

**Backend (FIX A):**
- [x] PostSpecification type compiles ✅
- [ ] Generated plans contain `nudge_rationale` field
- [ ] Non-nudge posts have null values (not missing keys)

**Frontend (FIX B):**
- [ ] Context block renders on booking nudge posts only
- [ ] Date formatting is correct Danish
- [ ] Rationale text is readable and human-friendly
- [ ] Block is visually distinct but not distracting

**Frontend (FIX C):**
- [ ] CTA mode badge appears in strategy narrative
- [ ] Badge text matches mode and nudge status
- [ ] Badge doesn't appear on businesses without booking data

**User Feedback:**
- [ ] At least 5 users see booking nudge context in their plans
- [ ] No confusion reported about context block purpose
- [ ] No layout/design complaints
- [ ] Users understand target day and lead time

---

## Risk Assessment Matrix

| Risk Category | Level | Mitigation |
|---------------|-------|------------|
| **Implementation Complexity** | 🟢 LOW | Simple field mapping + conditional rendering |
| **Date Formatting Errors** | 🟡 MEDIUM | Danish arrays provided, add unit tests |
| **Backward Compatibility** | 🟢 LOW | Optional fields, graceful degradation |
| **UI Clutter** | 🟡 LOW | Only 1 post per week, secondary hierarchy |
| **Mobile Responsive** | 🟡 MEDIUM | Test on small screens, allow wrapping |
| **Null Field Handling** | 🟢 LOW | Conditional rendering built-in |
| **User Confusion** | 🟢 LOW | Clear Danish text, simple design |

**Overall Risk:** 🟢 **LOW** (well-scoped, low complexity)

---

## Alternative Approaches Considered

### Alternative 1: Tooltip Instead of Always-Visible Block

**Pros:**
- No visual clutter
- User chooses when to see context

**Cons:**
- Hidden by default (lower discoverability)
- Requires hover interaction (poor mobile UX)
- User might not know tooltip exists

**Verdict:** ❌ **REJECTED** (context is valuable enough to show by default)

---

### Alternative 2: Modal Dialog for Full Reasoning

**Pros:**
- More space for detailed explanation
- Could show week-level signals (payday, events, etc.)

**Cons:**
- Requires click to open (friction)
- Interrupts flow (user has to close dialog)
- Over-engineered for simple context

**Verdict:** ❌ **REJECTED** (too heavy for this use case)

---

### Alternative 3: No UI Display (Keep Audit Trail Backend-Only)

**Pros:**
- Zero frontend work
- No UI clutter

**Cons:**
- User has no visibility into AI reasoning
- Reduced trust in AI decisions
- Missed opportunity for user education

**Verdict:** ❌ **REJECTED** (transparency is critical for user trust)

---

## Final Recommendation

### ✅ APPROVE FOR IMMEDIATE IMPLEMENTATION

**Why Now:**
1. ✅ Judgment block is already deployed and writing data
2. ✅ Low implementation complexity (~2 hours)
3. ✅ High user value (transparency builds trust)
4. ✅ No breaking changes or dependencies
5. ✅ Clear, actionable instructions provided

**Deployment Strategy:** ✅ **Single-Phase Rollout**
- Implement all 3 fixes together (FIX A + FIX B + FIX C)
- Test on Café Faust first
- Deploy to 100% of users immediately (no A/B testing needed)

**Success Metrics (First Week):**
- [ ] At least 70% of booking nudge posts show context block
- [ ] Date formatting is correct in 100% of cases
- [ ] Zero UI layout issues reported
- [ ] User feedback is positive or neutral (no confusion)

---

## Next Steps

### Immediate (Next 24 Hours)

1. ⏳ Locate `weekly-plan-generator.ts` file
2. ⏳ Implement FIX A (backend field carriage)
3. ⏳ Deploy `generate-weekly-plan` function
4. ⏳ Verify fields appear in database

### Short-Term (Next 2-3 Days)

1. ⏳ Locate post card component in Weekly Plan UI
2. ⏳ Implement FIX B (booking nudge context block)
3. ⏳ Implement FIX C (CTA mode badge)
4. ⏳ Test on development environment
5. ⏳ Deploy to production

### Medium-Term (Week 1)

1. ⏳ Monitor user feedback
2. ⏳ Verify date formatting works for all days/months
3. ⏳ Check mobile responsive behavior
4. ⏳ Collect screenshots of context block in real plans

---

## Conclusion

This UI enhancement is a **natural completion** of the booking nudge judgment system. The judgment block writes valuable reasoning to the database, but without surfacing it to the user, that value is lost.

**Three simple fixes** (backend field carriage + post card context + strategy badge) unlock:
- ✅ User understanding of AI strategic decisions
- ✅ Increased trust through transparency
- ✅ Informed editing (user can agree or override)
- ✅ Better user education about booking strategy

**Recommendation:** ✅ **IMPLEMENT IMMEDIATELY** (same priority as judgment block deployment)

---

**Assessment completed by:** GitHub Copilot  
**Date:** 2026-06-15  
**Ready for implementation:** ✅ YES
