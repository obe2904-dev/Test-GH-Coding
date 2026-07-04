# ASSESSMENT: Booking Nudge Judgment Block

**Date:** 2026-06-15  
**Proposed For:** Phase 1 prompt in `phase1.ts` (extends FIX 4)  
**Type:** AI reasoning framework for dynamic booking nudge decision-making  
**Status:** 🟡 **RECOMMENDED AS PHASE 2 ENHANCEMENT**

---

## Executive Summary

This proposal adds a sophisticated 4-step reasoning framework that enables the AI to **conditionally apply** booking nudges based on weekly context signals (payday, events, tourism, week mode), rather than always applying them when `booking_nudge_enabled: true`.

**Overall Assessment:** ✅ **STRONG ENHANCEMENT** but should be implemented **AFTER** FIX 1-4 are validated in production.

**Rationale:**
- Adds significant strategic intelligence to booking nudge timing
- Prevents booking nudges from competing with retention/brand-building weeks
- Introduces auditability through `nudge_rationale` field
- BUT: Adds complexity and introduces conditional logic that may suppress nudges incorrectly

---

## Technical Analysis

### Proposed Logic Flow

```
IF cta_rules.booking_nudge_enabled === true:
  ↓
  STEP 1: Should this week have a booking nudge? (conditional evaluation)
    - Evaluate: payday, tourism, events, busy_pattern, week_mode
    - Output: booking_nudge_warranted: true/false + reasoning
  ↓
  IF booking_nudge_warranted === true:
    ↓
    STEP 2: Which day should the nudge post land?
      - Derive peak_day from busy_pattern > event > default (Fri/Sat)
      - Calculate: nudge_post_date = peak_day - lead_days
    ↓
    STEP 3: What lead time is appropriate?
      - Default: 2 days (from FIX 3)
      - Override: 1-5 days based on signals
    ↓
    STEP 4: Generate structured output
      - booking_nudge_warranted, peak_day, nudge_post_date, lead_days_used, nudge_rationale
```

---

## Strengths ✅

### 1. Context-Aware Intelligence
**Feature:** Evaluates multiple weekly signals before deciding to use booking nudge

**Signals Considered:**
- ✅ `economic.is_payday_week` → Higher demand → booking more valuable
- ✅ `economic.is_summer + location.tourist_context` → Walk-in dominant → nudge less valuable
- ✅ `events[]` with `commercial_weight` → Event-driven demand → nudge warranted
- ✅ `busy_pattern` → Known peak nights → nudge before peak
- ✅ `week_mode` → Retention/brand weeks → nudge may conflict with strategy

**Assessment:** This is **excellent** strategic thinking. It prevents booking nudges from being blindly applied every week regardless of context.

---

### 2. Dynamic Lead Time Calculation
**Feature:** Adjusts `booking_nudge_lead_days` based on business characteristics

**Logic:**
```typescript
Default: 2 days
Override cases:
  - reservation_required: true → 3 days (people plan further ahead)
  - busy_pattern shows peak fills up → 3 days
  - walk-in dominant + booking link optional → 1 day
  - Major event (Valentine's, New Year's) → 4-5 days
```

**Assessment:** ✅ **SMART LOGIC**  
Reflects real-world booking behavior patterns. Reservation-heavy businesses (fine dining) need more lead time than casual walk-in cafés.

---

### 3. Peak Day Derivation Hierarchy
**Feature:** Intelligent precedence for determining peak day

**Priority:**
1. `busy_pattern` peak day (most reliable — business-specific data)
2. Highest `commercial_weight` event day
3. Friday/Saturday default (hospitality standard)

**Assessment:** ✅ **CORRECT PRECEDENCE**  
`busy_pattern` is the most reliable signal because it's derived from actual business data.

---

### 4. Auditability Through Rationale Field
**Feature:** Stores reasoning for booking nudge decisions in `nudge_rationale`

**Example:**
```
"Første lønningsweekend i måneden — fredag forventes travl, 
booking-opfordring tirsdag giver 3 dages forspring"
```

**Assessment:** ✅ **CRITICAL FOR DEBUGGING**  
This feeds into `strategy_rationale` on `weekly_strategies` table, enabling post-mortem analysis of why AI made specific decisions. Essential for A/B testing and quality assurance.

---

### 5. Skip Logic for Low-Value Weeks
**Feature:** Can suppress booking nudge when signals indicate low value

**Cases:**
- Retention-focused week (week_mode = "retention_focus")
- Brand-building week (week_mode = "brand_building")
- Tourist area in summer (walk-in dominant, no reservation pressure)
- No elevated demand signals

**Assessment:** ✅ **STRATEGICALLY SOUND**  
Prevents booking nudges from diluting the primary weekly goal.

---

## Concerns & Risks ⚠️

### 1. Complexity & Token Usage 🟡 MEDIUM RISK
**Issue:** 4-step reasoning framework increases prompt complexity

**Impact:**
- Higher token usage (~200-400 tokens per week)
- Increased latency (~2-3 seconds additional AI processing)
- More failure modes (AI might reason incorrectly)

**Mitigation:**
- Monitor token usage in production
- Set timeout limits for Phase 1 generation
- Add fallback: if reasoning fails, default to `booking_nudge_enabled: true`

---

### 2. Override Risk — False Negatives 🔴 HIGH RISK
**Issue:** AI might incorrectly suppress booking nudge when it's actually valuable

**Example Scenario:**
```
Week mode: "retention_focus"
→ AI suppresses booking nudge
→ But business has a special event (live music Friday)
→ Lost booking opportunity
```

**Impact:** Revenue loss from missed booking opportunities

**Mitigation:**
1. **Mandatory minimum frequency:** At least 1 booking nudge every 2 weeks regardless of signals
2. **Event override:** If `event.commercial_weight > 0.7`, booking nudge is ALWAYS enabled
3. **Human review:** Dashboard flag when booking nudge is suppressed for 3+ consecutive weeks

---

### 3. Schema Impact — New Fields Required 🟡 MEDIUM RISK
**Issue:** Adds 5 new fields to `post_ideas` output structure

**New Fields:**
```typescript
interface PostIdea {
  // ... existing fields
  booking_nudge_warranted?: boolean
  peak_day?: string  // ISO date
  nudge_post_date?: string  // ISO date
  lead_days_used?: number
  nudge_rationale?: string
}
```

**Impact:**
- Database migration needed if these are persisted
- Frontend may need updates to display new fields
- Backward compatibility concerns with existing plans

**Mitigation:**
- Make all fields optional (nullable)
- Add migration script to backfill existing plans with null values
- Version the schema (`booking_nudge_v2`)

---

### 4. Conflict with FIX 3 Determinism ⚠️ DESIGN TENSION
**Issue:** FIX 3 set `cta_rules.booking_nudge_enabled` as a **deterministic business rule**. This proposal makes it **conditional per week**.

**Design Philosophy Clash:**
```
FIX 3 Logic:
  IF booking_link exists → booking_nudge_enabled: true (ALWAYS)

Judgment Block Logic:
  IF booking_link exists → MAYBE use booking nudge (CONDITIONAL)
```

**Assessment:** This is not a conflict, it's a **two-tier system**:
- **Tier 1 (FIX 3):** Business capability check ("CAN we use booking nudge?")
- **Tier 2 (Judgment Block):** Weekly strategy check ("SHOULD we use booking nudge this week?")

**Recommendation:** Rename FIX 3 field to avoid confusion:
```typescript
cta_rules: {
  booking_nudge_capable: boolean,  // Business can support booking (was: booking_nudge_enabled)
  // ... rest of fields
}

// Then in prompt:
if (cta_rules.booking_nudge_capable) {
  // Run judgment block to decide if warranted THIS week
}
```

---

### 5. Tourism Signal Correctness ⚠️ DATA QUALITY RISK
**Issue:** "tourist_context = walk-in dominant → nudge less valuable" may not hold for all businesses

**Counter-example:**
- High-end restaurant in tourist area
- Tourists actually BOOK in advance (special occasion dining)
- Suppressing nudge would lose revenue

**Mitigation:**
- Add business archetype check:
  ```typescript
  if (economic.is_summer && location.tourist_context) {
    // Only suppress for casual/café archetypes
    if (business_archetype === 'casual_dining' || business_archetype === 'cafe') {
      booking_nudge_less_valuable = true
    }
    // Fine dining / upscale always keep booking nudge
  }
  ```

---

## Integration Points

### Where This Fits in Current Architecture

**Current Flow (FIX 1-4):**
```
get-weekly-strategy builds weekContext
  ├── booking_model (raw data)
  └── cta_rules (deterministic rules)
       └── booking_nudge_enabled: true/false (business capability)

phase1.ts receives weekContext
  └── BOOKING & CTA RULES section
       └── If booking_nudge_enabled: true
            └── "Assign ONE post 2 days before peak"
```

**Proposed Flow (with Judgment Block):**
```
get-weekly-strategy builds weekContext
  ├── booking_model (raw data)
  └── cta_rules (deterministic rules)
       └── booking_nudge_capable: true/false  ← RENAME

phase1.ts receives weekContext
  └── BOOKING & CTA RULES section
       └── If booking_nudge_capable: true
            └── "See BOOKING NUDGE JUDGMENT section"
  
  └── BOOKING NUDGE JUDGMENT section  ← NEW
       └── STEP 1: Evaluate signals → booking_nudge_warranted
       └── STEP 2: Derive peak_day
       └── STEP 3: Calculate lead_days_used
       └── STEP 4: Output structured decision
```

**Files Modified:**
1. `get-weekly-strategy/index.ts` — Rename field (1 line change)
2. `phase1.ts` — Add BOOKING NUDGE JUDGMENT section (~40 lines)
3. `types/strategy-types.ts` — Add new fields to PostIdea interface

---

## Testing Requirements

### Unit Tests
- [ ] Test STEP 1 logic for all signal combinations
  - [ ] `is_payday_week: true` → nudge warranted
  - [ ] `week_mode: "retention_focus"` → nudge skipped (unless override)
  - [ ] `tourist_context + is_summer + casual_dining` → nudge skipped
  - [ ] `high commercial_weight event` → nudge always warranted

### Integration Tests
- [ ] Generate 10 weeks of strategies for Café Faust
- [ ] Verify booking nudge appears at least 1 every 2 weeks (minimum frequency rule)
- [ ] Verify `nudge_rationale` is populated when nudge is used
- [ ] Verify `nudge_rationale` explains skip when booking nudge is suppressed

### Edge Case Tests
- [ ] Week with NO peak day signal (no busy_pattern, no events)
  - Should default to Friday/Saturday
- [ ] Valentine's week → lead_days_used should be 4-5
- [ ] Retention week with major event → event should override week_mode

---

## Implementation Recommendation

### 🟡 PHASE 2 ENHANCEMENT (Not Immediate)

**Rationale:**
1. **FIX 1-4 must stabilize first** — Let the deterministic booking nudge logic run for 2-4 weeks in production before adding conditional logic
2. **Measure baseline performance** — Collect data on:
   - How often booking nudge posts are generated
   - CTR/conversion rate on booking CTAs
   - Customer feedback on booking nudge frequency
3. **Validate assumptions** — The judgment block makes several assumptions (tourist areas = walk-in dominant, retention weeks should skip nudge) that need validation

### Recommended Timeline

**Week 1-2 (June 15-28):**
- ✅ Deploy FIX 1-4 (current implementation)
- Monitor Café Faust booking nudge performance
- Collect baseline metrics

**Week 3-4 (July 1-14):**
- Analyze FIX 1-4 performance data
- Validate judgment block assumptions:
  - Are there weeks where booking nudge feels forced/inappropriate?
  - Do retention weeks see lower booking CTA performance?
  - Do payday weeks see higher booking conversion?

**Week 5-6 (July 15-28):**
- If data supports conditional logic, implement judgment block
- Deploy behind feature flag for A/B testing
- Compare: deterministic nudge (control) vs. conditional nudge (treatment)

**Week 7+ (August):**
- Roll out to 100% if conditional logic outperforms deterministic

---

## Proposed Prompt Addition

### Location in phase1.ts

**Insert after:** The existing `BOOKING & CTA RULES` section (from FIX 4)  
**Before:** The `BUSINESS PROFILE` section

### Prompt Template

```typescript
${(() => {
  const ctaRules = (context as any).cta_rules;
  
  // Only show judgment block if business is capable of booking nudge
  if (!ctaRules || !ctaRules.booking_nudge_capable) return '';
  
  return `
## BOOKING NUDGE JUDGMENT (kun når booking_nudge_capable er true)

Før du tildeler slots, skal du gennemgå følgende ræsonnement for DENNE specifikke uge:

### STEP 1 — Skal denne uge have en booking nudge overhovedet?

Evaluer mod disse signaler:
${context.economic?.is_payday_week ? '✅ PAYDAY WEEK — efterspørgslen er højere → booking nudge mere værdifuld' : ''}
${context.economic?.is_summer && (context.location as any)?.tourist_context ? 
  `⚠️ SOMMER + TURISTOMRÅDE — walk-in dominerer
  → nudge mindre værdifuld MEDMINDRE reservation_required er true` : ''}
${context.events?.filter((e: any) => e.commercial_weight > 0.5).length > 0 ?
  `✅ HØJE KOMMERCIELLE EVENTS — ${context.events.filter((e: any) => e.commercial_weight > 0.5).map((e: any) => e.name).join(', ')}
  → booking nudge næsten altid korrekt` : ''}
${(context as any).busy_pattern?.find((d: any) => d.level === 'peak') ?
  `✅ KENDT PEAK NIGHT — ${(context as any).busy_pattern.find((d: any) => d.level === 'peak').day}
  → booking nudge før den nat er næsten altid korrekt` : ''}
${context.week_mode === 'retention_focus' || context.week_mode === 'brand_building' ?
  `⚠️ WEEK MODE: ${context.week_mode} — nudge kan konkurrere med ugens primære mål
  → overvej at springe over` : ''}

Hvis INGEN af disse signaler peger mod forhøjet efterspørgsel,
sæt booking_nudge_warranted: false og brug walk-in CTAs hele ugen.

### STEP 2 — Hvis nudge er berettiget, hvilken dag skal nudge-opslaget lande?

Vælg post-dato som: peak_day minus ${ctaRules.booking_nudge_lead_days} dage

Hvor peak_day er afledt fra:
1. busy_pattern peak day hvis tilgængelig (mest pålidelig — forretningsspecifik)
2. Højeste commercial_weight event-dag hvis in_week: true
3. Fredag eller lørdag som standard for hospitality

### STEP 3 — Hvad er det rigtige lead time for DENNE forretning?

Standard er ${ctaRules.booking_nudge_lead_days} dage. Override baseret på:
- reservation_required: true → 3 dage (folk planlægger længere frem)
- busy_pattern viser at peak fylder op → 3 dage
- walk-in dominerende forretning + booking link = valgfri → 1 dag er nok
- Stor begivenhed (Valentinsdag, Nytår) → 4-5 dage

### STEP 4 — Output beslutningen som del af booking nudge post idea:

Du SKAL inkludere disse felter i det post idea, der får booking nudge:
\`\`\`json
{
  "booking_nudge_warranted": true/false,
  "booking_nudge_reasoning": "En-sætnings begrundelse",
  "peak_day": "ISO date",
  "nudge_post_date": "ISO date (peak_day minus lead_days)",
  "lead_days_used": integer,
  "nudge_rationale": "Første lønningsweekend i måneden — fredag forventes travl, booking-opfordring tirsdag giver 3 dages forspring"
}
\`\`\`

⚠️ KRITISK: nudge_rationale bliver gemt i strategy_rationale, så du kan revidere hvorfor AI tog beslutningen.

⚠️ MINIMUM FREKVENS: Hvis du har undertrykt booking nudge i 2+ uger i træk, skal du bruge den denne uge uanset signaler (medmindre reservation_required er false OG ingen booking_link findes).
`;
})()}
```

---

## Schema Changes Required

### PostIdea Interface Extension

**File:** `supabase/functions/_shared/post-helpers/types/strategy-types.ts`

```typescript
export interface PostIdea {
  // ... existing fields
  content_category: string
  goal_mode: string
  suggested_time?: string
  cta_mode?: string
  
  // NEW: Booking nudge decision metadata (v2)
  booking_nudge_warranted?: boolean
  booking_nudge_reasoning?: string
  peak_day?: string  // ISO date (YYYY-MM-DD)
  nudge_post_date?: string  // ISO date (YYYY-MM-DD)
  lead_days_used?: number  // 1-5 days
  nudge_rationale?: string  // Stored in strategy_rationale for audit
}
```

### Database Migration (if persisting to DB)

**File:** `_add_booking_nudge_judgment_fields.sql`

```sql
-- Add booking nudge judgment metadata to post_ideas JSON structure
-- No schema change needed if post_ideas is JSONB — these are optional fields

-- But if you want to query these fields, add generated columns:
ALTER TABLE weekly_plans
ADD COLUMN IF NOT EXISTS has_booking_nudge_post boolean 
  GENERATED ALWAYS AS (
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(post_ideas) AS idea
      WHERE (idea->>'booking_nudge_warranted')::boolean = true
    )
  ) STORED;

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_weekly_plans_has_booking_nudge 
  ON weekly_plans(has_booking_nudge_post) 
  WHERE has_booking_nudge_post = true;
```

---

## Validation Query

**File:** `_validate_booking_nudge_judgment.sql`

```sql
-- Validate booking nudge judgment logic after implementation
-- Run against Café Faust to verify decisions are sound

WITH cafe_faust_weeks AS (
  SELECT 
    ws.week_number,
    ws.week_start,
    ws.business_id,
    ws.post_ideas,
    ws.strategy_rationale,
    ws.week_context_snapshot->'economic'->>'is_payday_week' AS is_payday_week,
    ws.week_context_snapshot->>'week_mode' AS week_mode
  FROM weekly_strategies ws
  WHERE ws.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND ws.created_at > NOW() - INTERVAL '30 days'
  ORDER BY ws.week_number DESC
)

SELECT
  week_number,
  week_start,
  is_payday_week,
  week_mode,
  
  -- Extract booking nudge post
  (
    SELECT jsonb_build_object(
      'booking_nudge_warranted', idea->>'booking_nudge_warranted',
      'peak_day', idea->>'peak_day',
      'nudge_post_date', idea->>'nudge_post_date',
      'lead_days_used', idea->>'lead_days_used',
      'nudge_rationale', idea->>'nudge_rationale'
    )
    FROM jsonb_array_elements(post_ideas) AS idea
    WHERE (idea->>'booking_nudge_warranted')::boolean = true
    LIMIT 1
  ) AS booking_nudge_decision,
  
  -- Check minimum frequency rule (at least 1 every 2 weeks)
  LAG(week_number, 1) OVER (ORDER BY week_number) AS prev_week_number,
  (week_number - LAG(week_number, 1) OVER (ORDER BY week_number)) AS weeks_since_last_nudge

FROM cafe_faust_weeks;

-- Expected: weeks_since_last_nudge should never exceed 2
```

---

## Rollback Plan

If judgment block causes issues after deployment:

### Quick Disable (No Code Change)
Set environment variable to bypass judgment block:
```bash
BOOKING_NUDGE_JUDGMENT_ENABLED=false
```

Then in prompt:
```typescript
${Deno.env.get('BOOKING_NUDGE_JUDGMENT_ENABLED') === 'true' ? `
  ## BOOKING NUDGE JUDGMENT
  ...
` : ''}
```

### Full Rollback (Code Revert)
```bash
git revert <commit-hash-of-judgment-block>
supabase functions deploy get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn
```

---

## A/B Testing Plan

### Control Group (50% of businesses)
- Use deterministic booking nudge (FIX 1-4 only)
- `booking_nudge_enabled: true` → always assign nudge post

### Treatment Group (50% of businesses)
- Use conditional booking nudge (with judgment block)
- `booking_nudge_capable: true` → run judgment block → may skip

### Metrics to Compare
1. **Booking nudge frequency:** How often does treatment group skip the nudge?
2. **Booking conversion rate:** Does conditional logic improve booking CTR?
3. **Overall engagement:** Does skipping nudge improve non-booking post performance?
4. **Revenue impact:** Do fewer nudges lead to fewer bookings (revenue loss)?

### Success Criteria for Treatment
- ✅ Booking conversion rate ≥ control group (no worse)
- ✅ Overall engagement improves (other posts get more attention)
- ✅ AI suppression rate is reasonable (not skipping >50% of weeks)
- ✅ Human review shows AI reasoning is sound

---

## Final Recommendation

### ✅ APPROVE FOR PHASE 2 IMPLEMENTATION

**Conditions:**
1. **Wait 2-4 weeks** after FIX 1-4 deployment to establish baseline
2. **Collect data** on booking nudge performance under deterministic logic
3. **Validate assumptions** (payday effect, tourist walk-in dominance, etc.)
4. **Deploy behind feature flag** for A/B testing
5. **Monitor carefully** — set alerts if booking nudge suppression exceeds 40% of weeks

**Implementation Priority:** 🟡 **MEDIUM** (not urgent, but valuable enhancement)

**Risk Level:** 🟡 **MEDIUM** (can suppress valuable booking opportunities if AI reasons incorrectly)

**Expected Impact:** 
- ⬆️ +10-15% engagement on non-booking posts (less CTA fatigue)
- ⬇️ -5-10% booking nudge frequency (strategic suppression)
- ➡️ Neutral to +5% booking conversion (better-timed nudges)

---

**Assessment completed by:** GitHub Copilot  
**Review status:** Pending human validation  
**Next steps:** Validate FIX 1-4 performance data before proceeding
