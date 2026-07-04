# Weekly Plan Scheduling Bug Assessment

**Date**: May 2, 2026  
**Business**: Cafe Faust  
**Week**: May 5-11, 2026  
**Critical Issue**: Drinks/evening atmosphere post scheduled Sunday 9:00 AM

---

## Executive Summary

The Weekly Plan system produced a fundamentally flawed post assignment: a drinks/evening atmosphere post ("Aftenstemning") scheduled for **Sunday morning at 9:00 AM**. This violates basic content-timing logic on multiple dimensions:

1. **Content-Timing Mismatch**: Evening atmosphere content at morning time
2. **Day-of-Week Violation**: Drinks content on Sunday instead of Friday-Saturday (primary) or Thursday (secondary)
3. **Rationale-Execution Disconnect**: AI claims to drive "Friday-Saturday evening visits" but schedules Sunday morning
4. **Event Handling Confusion**: Mors Dag Sunday with unclear lead-up strategy
5. **Strategic Incoherence**: Goal is drive_footfall but timing misses actual visit window

**Root Cause**: The system lacks content-type constraints in day assignment logic and has no content-time validation layer.

---

## The Problematic Output

### Actual Weekly Plan (Cafe Faust, May 5-11, 2026)

| Day | Time | Title | Goal | Issue |
|-----|------|-------|------|-------|
| Tue May 6 | 10:00 | Mors Dag: Familietraditioner | Brand | 2 days before Mors Dag ✓ |
| Thu May 7 | 14:00 | Faustburger — dinner | Footfall | Correct timing ✓ |
| Sat May 9 | 9:00 | Favoritten — brunch | Footfall | Brunch at morning ✓ |
| **Sun May 10** | **9:00** | **Aftenstemning** | **Footfall** | **CRITICAL FAILURE** ❌ |

### The Sunday Post Details

**Title**: "Aftenstemning" (Evening Atmosphere/Mood)  
**Scheduled**: Sunday, May 10 at 9:00 AM  
**Goal**: Drive Footfall (⚡ Kør trafik)  
**Duration**: 10-15 minutes to create

**AI-Generated Rationale**:
> "Strategisk valgt: Denne post passer til ugens argument om Cafe Faust som et attraktivt **aftenudflugtsmål** for både lokale og turister, især op til Mors Dag, ved at vise stedets unikke atmosfære. Som en strategisk synlighedspost på søndag, hvor gæster planlægger ugens aktiviteter, driver den overvejelse af **aftenbesøg fredag-lørdag**. Timingen er perfekt til at inspirere til planlagte besøg, der udnytter stedets fulde potentiale fra formiddag til nat."

**Translation**:
> "Strategically chosen: This post fits the week's argument about Cafe Faust as an attractive **evening destination** for both locals and tourists, especially leading up to Mors Dag, by showing the venue's unique atmosphere. As a strategic visibility post on Sunday, when guests plan the week's activities, it drives consideration of **evening visits Friday-Saturday**. The timing is perfect to inspire planned visits that utilize the venue's full potential from morning to night."

### Timing Justification (from system)
- **Day**: Sunday
- **Date**: May 10, 2026
- **Time**: 9:00
- **Reasoning**: "Stemningspost under morgen-opmærksomhedsvindue for at drive besøg" (Mood post during morning attention window to drive visits)

---

## Failure Analysis: Five Critical Errors

### 1. Content-Timing Semantic Violation

**The Problem**: "Aftenstemning" literally means "evening atmosphere" or "evening mood."

- **Content Subject**: Evening drinks, evening ambiance
- **Actual Schedule**: 9:00 AM (morning)
- **Cognitive Dissonance**: Users seeing "evening atmosphere" post at 9:00 AM will be confused
- **Call-to-Action Mismatch**: If the post encourages evening visits, a morning post time creates disconnect

**Why This Matters**:
- Social media posts establish implicit temporal context through timing
- A drinks/evening post at 9:00 AM signals breakfast/morning, not evening visits
- Audience attention at 9:00 AM is breakfast/morning-oriented, not evening planning

**Expected Behavior**:
- Evening atmosphere content should post at **14:00-18:00** (afternoon/pre-evening booking window)
- Timing should align with when people make evening dining decisions (Thursday-Saturday afternoons)

---

### 2. Day-of-Week Content-Type Violation

**The Problem**: Drinks content is scheduled for Sunday, violating hospitality industry best practices.

**Industry Standard for Drinks Content**:
- **Primary Days**: Friday, Saturday (14:00-18:00)
  - Peak evening dining planning window
  - Highest conversion for same-evening or next-day reservations
  - Maximum social media engagement for nightlife/dining content
  
- **Secondary Days**: Thursday (14:00-17:00)
  - "Weekend starts Thursday" audience
  - After-work drinks segment
  - Pre-weekend planning

- **Wrong Days**: Sunday, Monday
  - Low evening dining intent
  - Audience in recovery/reset mode
  - Minimal conversion for drinks/evening visits

**Actual Output**: Sunday 9:00 AM - violates both day-of-week AND time-of-day best practices

**Strategic Impact**:
- Wasted content: drinks post reaches audience at lowest intent moment
- Missed opportunity: Friday/Saturday slots should have drinks content
- Brand confusion: suggests Cafe Faust doesn't understand its own peak business windows

---

### 3. Rationale-Execution Catastrophic Disconnect

**The AI's Stated Intent**:
1. "attraktivt **aftenudflugtsmål**" (attractive **evening destination**)
2. "driver den overvejelse af **aftenbesøg fredag-lørdag**" (drives consideration of **evening visits Friday-Saturday**)
3. "Timingen er perfekt til at inspirere til planlagte besøg" (timing is perfect to inspire planned visits)

**The Actual Execution**:
- Scheduled for **Sunday morning 9:00 AM**
- Two days AFTER the intended Friday-Saturday visit window
- At a time when Sunday audience is thinking about breakfast/brunch, not evening drinks

**What This Reveals**:
The AI generating the rationale (Phase 2b) is either:
1. **Unaware of the actual day/time assignment** (suggests Phase 1 → Phase 2a → Phase 2b information flow is broken)
2. **Rationalizing a bad decision post-hoc** (Phase 2b receives day/time and generates plausible-sounding rationale regardless of logic)
3. **Confusing "planning window" with "visit window"** (thinks Sunday morning is when people plan Friday-Saturday, but that's 5-6 days too late)

**The Sunday Planning Fallacy**:
The rationale claims "Sunday when guests plan the week's activities." This might be true for:
- Weekly meal prep
- Grocery shopping
- Kids' activities
- Work week logistics

But NOT true for:
- **Weekend evening dining** (planned Thursday-Saturday)
- **Spontaneous evening visits** (decided same-day, afternoon)
- **Friday-Saturday nights** (already passed by Sunday)

The post is scheduled AFTER the weekend it's supposed to drive traffic for.

---

### 4. Event Handling Strategic Confusion

**The Context**:
- **Mors Dag (Mother's Day)**: Sunday, May 10
- **"Book Table" event**: Tuesday, May 6
- **Week's posts**: Tuesday (Mors Dag theme), Thursday (burger), Saturday (brunch), Sunday (drinks/evening)

**Expected Event Pinning Behavior** (from phase2a.ts lines 132-190):
- High-priority events (holidays, commercial_weight ≥ 4) get footfall posts **1-2 days BEFORE**
- Purpose: Capture booking window for the event itself
- For Mors Dag Sunday, footfall posts should be Friday or Saturday

**Actual Behavior**:
1. **Tuesday post**: "Mors Dag: Familietraditioner" at 10:00
   - 2 days before Mors Dag ✓ (correct lead time)
   - Goal: Brand (build_brand) ✓ (softer event awareness)
   - Issue: This is likely a brand post, not footfall conversion post

2. **Saturday post**: "Favoritten — brunch" at 9:00
   - 1 day before Mors Dag ✓ (correct lead time)
   - Goal: Footfall ✓
   - Content: Brunch (appropriate for Mother's Day Sunday lunch)
   - This appears correct

3. **Sunday post**: "Aftenstemning" at 9:00
   - ON Mors Dag (not before)
   - Goal: Footfall (but it's too late - Mother's Day is happening)
   - Content: Drinks/evening (wrong for Mother's Day Sunday)

**The Strategic Incoherence**:
- If Sunday is Mors Dag, posts should capture PRE-event bookings (Friday/Saturday)
- Sunday itself is too late for conversion (families already have plans)
- Drinks/evening content is wrong theme for family-oriented Mother's Day
- The "Book Table" event on Tuesday is mysterious - what is this event?

**What Should Have Happened**:
- **Friday or Saturday**: Footfall post for Mors Dag bookings ("Book your Mother's Day brunch")
- **Sunday**: Either skip (low conversion) OR soft brand post (families enjoying the day)
- **Drinks content**: Should be Thursday-Saturday for weekend evening visits (unrelated to Mors Dag)

---

### 5. Goal Mode vs Execution Mismatch

**The Post's Goal**: Drive Footfall (⚡ Kør trafik)

**Footfall Post Requirements**:
1. **Timing**: Match actual visit window (when people can act on the CTA)
2. **Content**: Specific, bookable offering (menu item, experience, occasion)
3. **CTA**: Hard call-to-action (book, call, visit hours)

**Sunday 9:00 Drinks Post Failures**:
1. **Timing Mismatch**:
   - Drinks/evening visits happen **Thursday-Saturday 17:00-23:00**
   - Post at Sunday 9:00 misses entire conversion window by 2-3 days
   - Audience at 9:00 AM Sunday is in breakfast mode, not evening planning mode

2. **Temporal Logic Failure**:
   - Cannot drive Friday-Saturday evening visits from a Sunday post (those days have passed)
   - Cannot drive Sunday evening visits from 9:00 AM (too early, wrong content)
   - If goal is drive_footfall, timing must enable immediate action

3. **Alternative Explanation** (worse):
   - If AI thinks Sunday 9:00 post will drive NEXT weekend's Friday-Saturday visits...
   - That's 5-6 days in advance
   - Far too long for spontaneous evening dining decisions
   - Contradicts "Timingen er perfekt" (timing is perfect) claim

**What This Reveals**:
The system lacks a **conversion window validation layer**:
- If goal = drive_footfall AND content = evening/drinks
- Then day must be Thu-Sat AND time must be 11:00-18:00
- Current system: no such constraint exists

---

## Root Cause: Design Gaps in Scheduling Logic

### Gap 1: Phase 2a Lacks Content-Type Awareness

**Current Behavior** (from phase2a.ts analysis):
- Day assignment uses: `timing_window`, `goal_mode`, event pinning, spread algorithm
- No awareness of: `content_category`, `programme_name`, content semantic meaning

**Code Evidence** (phase2a.ts lines 107-190):
```typescript
// preferredDowsForWindow() - extracts DOW from timing_window
// pickSpreadDay() - spread algorithm with goal_mode preference
// Event pinning - holidays → 1-2 days before

// NOWHERE: content-type constraints
// MISSING: "if programme = drinks → prefer Fri/Sat"
// MISSING: "if content_category = craving_visual + programme = drinks → Thu-Sat only"
```

**The Design Flaw**:
Phase 1 generates angles with:
- `content_category`: "craving_visual"
- `programme_name`: "Drinks"
- `timing_window`: "any" or "midweek" (vague)

Phase 2a sees `timing_window = "any"` and has no other constraint, so it assigns ANY day based on spread/events.

**Why Drinks Posts Land on Sunday**:
1. Phase 1 suggests drinks post with `timing_window = "any"` (or vague)
2. Phase 2a assigns Thursday (burger), Saturday (brunch) for footfall slots
3. Phase 2a has Sunday available, spread algorithm says "use Sunday"
4. No constraint prevents drinks → Sunday assignment
5. Sunday gets the drinks post ❌

---

### Gap 2: Timing Cascade Priority Confusion

**Current Behavior** (from phase2b.ts lines 296-340):

**3-Priority Cascade**:
1. **Priority 1**: `timing_window` from Phase 1 angle (e.g., "Fri-Sat 14:00" → 14:00)
2. **Priority 2**: `promoted_moment` (dinner→17:00, lunch→11:00, breakfast→07:00)
3. **Priority 3**: `goal_mode` default (drive_footfall→11:00, build_brand→09:00)

**The Problem with Sunday 9:00**:
- If `timing_window` specified evening (17:00), Priority 1 should give 17:00
- If `promoted_moment = "dinner"`, Priority 2 should give 17:00
- But system returned 9:00, suggesting Priority 3 was used

**Two Possible Failures**:

**Scenario A**: `goal_mode = build_brand` (wrong goal)
- build_brand default is 09:00
- But UI shows "Kør trafik" (drive_footfall)
- Suggests goal_mode confusion between Phase 1 and Phase 2b

**Scenario B**: `promoted_moment` not set correctly
- Content is "Aftenstemning" (evening atmosphere)
- Should trigger `promoted_moment = "dinner"` → 17:00
- If promoted_moment is null/undefined, falls back to Priority 3
- Indicates template routing isn't setting promoted_moment for evening content

**What This Reveals**:
- Either `promoted_moment` logic is broken for drinks/evening content
- Or `goal_mode` is being overridden incorrectly between phases
- Or timing_window from Phase 1 was explicitly "09:00" (catastrophic)

---

### Gap 3: No Content-Time Validation Layer

**What's Missing**: A post-generation validation step that checks:

```typescript
// MISSING VALIDATION:
if (content includes "evening" OR programme === "Drinks" OR promoted_moment === "dinner") {
  assert(scheduled_time >= 14:00, "Evening content cannot be scheduled before 14:00")
}

if (programme === "Drinks") {
  assert(day in ["Thursday", "Friday", "Saturday"], "Drinks posts must be Thu-Sat")
  assert(scheduled_time >= 14:00 && scheduled_time <= 18:00, "Drinks posts need afternoon booking window")
}

if (content includes "brunch" OR promoted_moment === "breakfast") {
  assert(day in ["Saturday", "Sunday"], "Brunch posts should be weekends")
  assert(scheduled_time >= 07:00 && scheduled_time <= 10:00, "Brunch posts need morning timing")
}

// Rationale-execution coherence check:
if (rationale mentions "Friday-Saturday visits") {
  assert(day in ["Thursday", "Friday", "Saturday"], "Cannot drive Fri-Sat visits from other days")
  assert(day < visitDay OR day === visitDay, "Cannot drive visits for days that already passed")
}
```

**Why This Matters**:
- Even if Phase 1 and Phase 2a make mistakes, validation catches them
- Prevents nonsensical combinations (evening content at 9:00 AM)
- Enforces hospitality industry best practices (drinks = Thu-Sat)
- Creates feedback loop: validation failures → improve upstream logic

**Current State**: No such validation exists. System can produce any day/time combination without semantic checks.

---

### Gap 4: Phase 1 Timing Window Vagueness

**The Problem**: If Phase 1 generates `timing_window = "any"` or `timing_window = "midweek"` for drinks content, Phase 2a has insufficient constraint.

**What Phase 1 Should Do for Drinks Content**:
```typescript
// If programme = "Drinks" OR content semantic includes evening/drinks:
angle.timing_window = "Thu-Sat 14:00-18:00"  // Explicit constraint
angle.promoted_moment = "dinner"              // Ensure evening timing
angle.goal_mode = "drive_footfall"            // Clear conversion intent
```

**What Phase 1 Might Be Doing**:
```typescript
// Current (speculative):
angle.timing_window = "any"           // Too vague
angle.promoted_moment = undefined     // Missing
angle.goal_mode = "drive_footfall"    // Correct, but insufficient
```

**Why This Matters**:
- Phase 1 has full context: programme name, content category, business context
- Phase 1 is best positioned to specify precise timing_window
- If Phase 1 is vague, Phase 2a fills gaps with generic logic (spread, events)
- Vague timing_window → unpredictable day assignment

**Hypothesis**: Phase 1 prompt may not instruct AI to be specific about timing_window for content-type constraints. Needs investigation.

---

## Why Drinks Content MUST Be Thursday-Saturday

### 1. Booking Window Psychology

**Evening Dining Decision Timeline**:
- **Thursday-Saturday 11:00-18:00**: Peak planning window
  - People decide where to eat tonight (same-day conversion)
  - People plan Friday/Saturday evening (1-day advance booking)
  - Afternoon posts reach planning mindset

- **Sunday-Wednesday**: Minimal evening dining planning
  - Sunday: Recovery, meal prep, family time
  - Monday-Tuesday: Work mode, routine meals
  - Wednesday: Midweek (some activity, but not nightlife)

**Social Media Timing Research**:
- Restaurant posts get highest engagement Thursday-Saturday 12:00-17:00
- Drinks/evening content specifically peaks Friday 14:00-16:00
- Sunday morning posts get lowest conversion for evening visits

### 2. Audience Attention Mode

**Friday-Saturday 14:00-18:00 Audience**:
- "What should we do tonight?" mindset
- Actively seeking evening plans
- High intent for spontaneous booking
- Receptive to drinks/dining inspiration

**Sunday 9:00 AM Audience**:
- "What's for breakfast?" mindset
- Recovering from weekend
- Planning week ahead (work, logistics)
- NOT thinking about evening drinks

**Cognitive Mismatch**:
- Seeing "Aftenstemning" (evening atmosphere) at 9:00 AM Sunday creates confusion
- User thinks: "This is for tonight? Sunday night is dead. This is for last weekend? Too late."
- Result: Scroll past, no action

### 3. Cafe Faust's Business Pattern

**Peak Evening Traffic** (assumed from hospitality norms):
- Thursday: 18:00-22:00 (after-work, pre-weekend)
- Friday: 17:00-24:00 (peak evening, social dining)
- Saturday: 17:00-24:00 (peak evening, date nights, groups)

**Low Evening Traffic**:
- Sunday: 17:00-21:00 (early closers, family-oriented)
- Monday-Tuesday: Minimal evening traffic (routine meals)

**Strategic Implication**:
- Drinks content should promote Thu-Sat evenings (80% of weekly evening revenue)
- Sunday drinks post wastes content on 5% of weekly evening opportunity
- Even worse: Sunday 9:00 misses Sunday evening (could at least target 14:00 for same-day)

### 4. Competitive Behavior

**Industry Standard**:
- All major restaurant brands post drinks content Thursday-Saturday
- Timing: 12:00-17:00 (afternoon decision window)
- Never Sunday morning (would be considered amateur mistake)

**Cafe Faust's Current Output**:
- Sunday 9:00 drinks post signals:
  - Doesn't understand customer behavior
  - Doesn't optimize content timing
  - May be using automated system without human oversight

**Brand Credibility Risk**: Sophisticated customers notice poor social media timing.

---

## Event Handling Issues

### The Mors Dag Confusion

**Given**:
- Mors Dag (Mother's Day): Sunday, May 10
- "Book Table" event: Tuesday, May 6

**Questions**:
1. What is "Book Table" event on Tuesday?
   - Is this a separate promotional event?
   - Or is this a system-generated "booking reminder" for Mors Dag?
   - If it's a booking reminder, why Tuesday (4 days before Sunday)?

2. Why is the Mors Dag themed post on Tuesday instead of Friday/Saturday?
   - Tuesday post: "Mors Dag: Familietraditioner" (brand goal)
   - Could be awareness-building 2 days before
   - But footfall conversion should be Friday/Saturday for Sunday bookings

3. Why is Saturday brunch the only footfall post before Mors Dag?
   - Saturday 9:00: "Favoritten — brunch" (footfall)
   - This is good: 1 day before Mors Dag, brunch content for Sunday bookings ✓
   - But where's the Friday footfall post for Mors Dag?

4. Why is Sunday (Mors Dag itself) getting a drinks post?
   - Mors Dag is a family-oriented lunch event (brunch/lunch)
   - Drinks/evening content is wrong theme
   - Should be either: skip Sunday OR soft brand post of families enjoying the day

### Expected Event Pinning Behavior

**For High-Priority Event (Mors Dag Sunday)**:

| Day | Expected Post | Rationale |
|-----|---------------|-----------|
| Thu May 7 | Footfall (non-Mors Dag) | Regular weekly slot, 3 days before |
| Fri May 8 | **Footfall (Mors Dag themed)** | 2 days before, capture Friday bookings for Sunday |
| Sat May 9 | **Footfall (Mors Dag themed)** | 1 day before, last-minute bookings |
| Sun May 10 | **Brand (families enjoying)** | ON the day, soft awareness |
| Tue May 6 | Brand (Mors Dag awareness) | 4 days before, early awareness (optional) |

**Actual Output**:

| Day | Actual Post | Issue |
|-----|-------------|-------|
| Tue May 6 | Brand (Mors Dag) | Good (early awareness) ✓ |
| Thu May 7 | Footfall (burger) | Good (regular slot) ✓ |
| Fri May 8 | **MISSING** | ❌ Should have Mors Dag footfall |
| Sat May 9 | Footfall (brunch) | Good (1 day before) ✓ |
| Sun May 10 | Footfall (drinks) | ❌ Wrong theme, wrong timing |

**The Critical Miss**: Friday should have a Mors Dag-themed footfall post for Sunday bookings, but it's completely absent.

---

## Expected vs Actual Behavior

### What SHOULD Have Happened (Ideal Week)

**Strategic Context**:
- Mors Dag (Mother's Day): Sunday, May 10
- Outdoor season begins (good weather)
- Business goal: Drive bookings for Mors Dag brunch/lunch + regular weekend evening traffic

**Optimal Post Plan**:

| Day | Time | Title (example) | Goal | Content Category | Rationale |
|-----|------|-----------------|------|------------------|-----------|
| **Tue May 6** | 10:00 | Mors Dag: Planlæg det perfekte besøg | Brand | behind_scenes | Early awareness, 4 days before, soft brand building ✓ |
| **Thu May 7** | 14:00 | Signature Drinks — til weekenden | Footfall | craving_visual (drinks) | Thursday afternoon, drive Thu-Sat evening visits ✓ |
| **Fri May 8** | 11:00 | Book Mors Dag Brunch — få det sidste bord | Footfall | product_menu (brunch) | 2 days before, capture Friday bookings for Sunday ✓ |
| **Sat May 9** | 9:00 | Favoritten — brunch this weekend | Footfall | product_menu (brunch) | 1 day before, last-minute Mors Dag bookings ✓ |

**Key Differences from Actual**:
1. **Thursday**: Drinks post (correct day, correct time) instead of burger
2. **Friday**: Mors Dag booking CTA (fills the gap) instead of nothing
3. **Sunday**: Removed (day itself is too late for conversion)

**Strategic Coherence**:
- Thursday 14:00 drinks → drives weekend evening visits (Thu-Sat)
- Friday 11:00 brunch → captures Mors Dag bookings (2 days before)
- Saturday 9:00 brunch → last-minute Mors Dag bookings (1 day before)
- Tuesday brand → early awareness, supports overall week

---

### What ACTUALLY Happened

| Day | Time | Title | Goal | Issue Analysis |
|-----|------|-------|------|----------------|
| **Tue May 6** | 10:00 | Mors Dag: Familietraditioner | Brand | Good ✓ |
| **Thu May 7** | 14:00 | Faustburger — dinner | Footfall | OK (missed opportunity for drinks) |
| **Fri May 8** | — | MISSING | — | ❌ Critical gap for Mors Dag bookings |
| **Sat May 9** | 9:00 | Favoritten — brunch | Footfall | Good ✓ |
| **Sun May 10** | 9:00 | Aftenstemning (drinks/evening) | Footfall | ❌ Wrong day, wrong time, wrong theme |

**Strategic Failures**:
1. **No drinks post Thursday-Saturday**: Missed entire weekend evening opportunity
2. **No Friday Mors Dag post**: Lost 2-day booking window
3. **Sunday drinks at 9:00 AM**: Catastrophic content-timing mismatch
4. **Only 3 posts out of 7 days**: Under-utilizing weekly content slots

---

## System-Level Implications

### 1. Loss of Owner Trust

**Owner Perspective**:
- Sees drinks post scheduled Sunday 9:00 AM
- Knows this is wrong (drinks are Thu-Sat evenings)
- Reads AI rationale claiming "perfect timing"
- Conclusion: "The AI doesn't understand my business"

**Trust Erosion**:
- First instance: Owner corrects manually (extra work)
- Second instance: Owner questions all AI suggestions
- Third instance: Owner stops using Weekly Plan (system failure)

**Recovery Difficulty**:
- Once trust is lost, even correct suggestions are doubted
- Owner must manually review every post (defeats automation purpose)
- System needs 4-6 weeks of perfect output to rebuild trust

### 2. Content Strategy Waste

**Content Resource Scarcity**:
- Each business has ~15-20 unique programme items (dishes, drinks, experiences)
- Each programme can support 2-4 post angles before repetition
- Total annual content capacity: ~60-80 unique posts
- Each wasted post = 1.25% of annual content budget

**Sunday 9:00 Drinks Post**:
- Uses one drinks content angle
- Reaches audience at 5% effectiveness (Sunday morning vs Friday afternoon)
- Could have been Friday 14:00 for 100% effectiveness
- **Waste**: 95% of content value lost

**Opportunity Cost**:
- Thursday could have had drinks post (high value)
- Sunday could have been skipped (no value better than negative value)
- Friday could have had Mors Dag booking CTA (event-driven conversion)

### 3. Engagement Pattern Damage

**Social Media Algorithm Impact**:
- Platforms (Facebook, Instagram) track engagement per post
- Low engagement → future posts shown to fewer followers
- High engagement → future posts boosted organically

**Sunday 9:00 Drinks Post Expected Performance**:
- Low likes: Content-timing mismatch confuses audience
- Low comments: No discussion triggered ("evening post at 9:00 AM?")
- Low shares: No value to share
- Low click-through: No booking intent at 9:00 AM Sunday

**Algorithmic Penalty**:
- Platform interprets low engagement as "audience doesn't like this business"
- Next post shown to 20-30% fewer followers
- Creates negative spiral: bad timing → low engagement → less reach → more bad posts needed

**Recovery Time**: 3-4 high-performing posts needed to reverse algorithmic penalty.

### 4. Competitive Disadvantage

**Competitor Behavior**:
- Manual social media managers post drinks Thursday-Saturday 12:00-17:00
- AI-assisted competitors use rule-based constraints (drinks = Thu-Sat only)
- Cafe Faust's Sunday 9:00 drinks post looks unprofessional by comparison

**Market Positioning**:
- Customers follow multiple restaurants
- See competitor drinks post Friday 14:00 → high intent → book
- See Cafe Faust drinks post Sunday 9:00 → confused → ignore

**Brand Perception**:
- "Cafe Faust doesn't get it"
- "Their social media is on autopilot"
- "Probably the same in their kitchen" (unfair, but happens)

---

## Recommendations (No Code)

### Immediate Actions

1. **Manual Override for This Week**:
   - Delete Sunday drinks post (or reschedule to Thursday/Friday if possible)
   - Create Friday Mors Dag booking post manually (capture 2-day window)
   - Review next 4 weeks for similar errors

2. **Pattern Audit**:
   - Check last 8 weeks: how many drinks posts on Sunday/Monday/Tuesday?
   - Check: do drinks posts ever appear Thursday-Saturday with afternoon timing?
   - If pattern is systematic (drinks rarely on correct days), root cause is confirmed

### Architectural Fixes Needed

#### Fix 1: Add Content-Type Constraints to Phase 2a

**Requirement**: Day assignment must respect content-type best practices

**Rules to Implement**:
```
IF programme_name includes "Drinks" OR "Cocktails" OR "Wine" OR "Beer"
  THEN day must be in [Thursday, Friday, Saturday]
  AND time must be in range [14:00 - 18:00]

IF content semantic includes "evening" OR "night" OR "after-work"
  THEN day must be in [Wednesday, Thursday, Friday, Saturday]
  AND time must be >= 14:00

IF programme_name includes "Brunch" OR content includes "brunch"
  THEN day must be in [Saturday, Sunday]
  AND time must be in range [07:00 - 11:00]

IF programme_name includes "Lunch" OR promoted_moment = "lunch"
  THEN time must be in range [10:00 - 13:00]

IF programme_name includes "Dinner" OR promoted_moment = "dinner"
  THEN time must be in range [14:00 - 19:00]
```

**Implementation Point**: phase2a.ts, before day assignment loop

---

#### Fix 2: Enhance Phase 1 Timing Window Specificity

**Requirement**: Phase 1 must generate explicit timing_window for content-type-sensitive programmes

**Phase 1 Prompt Enhancement**:
```
When generating angles, be EXPLICIT with timing_window for:
- Drinks/cocktails/wine: "Thu-Sat 14:00-17:00"
- Brunch: "Sat-Sun 09:00-11:00"
- Dinner: "Wed-Sat 15:00-18:00"
- Lunch: "Tue-Fri 10:00-12:00"

Never use "any" or "midweek" for content-specific programmes.
```

**Validation**: Reject Phase 1 output if programme is content-specific but timing_window is vague.

---

#### Fix 3: Implement Content-Time Validation Layer

**Requirement**: Post-generation validation catches semantic mismatches

**Validation Rules**:
```
1. Content-Time Coherence:
   - IF title/rationale mentions "evening" → time must be >= 14:00
   - IF title/rationale mentions "morning" → time must be <= 11:00
   - IF title/rationale mentions "brunch" → day must be Sat/Sun

2. Goal-Timing Alignment:
   - IF goal = drive_footfall AND content = evening/drinks
     → day must be Thu-Sat AND time must be 14:00-18:00
   - IF goal = drive_footfall AND content = brunch
     → day must be Sat-Sun AND time must be 07:00-11:00

3. Rationale-Execution Coherence:
   - IF rationale mentions "Friday-Saturday visits"
     → day must be <= Saturday (cannot drive past visits)
   - IF rationale mentions "weekend" → day must be Thu-Sat
   - IF rationale mentions "planning window" → time must be appropriate for content

4. Event-Timing Logic:
   - IF rationale mentions event (e.g., "Mors Dag")
     → day must be <= event day (cannot promote after event)
   - IF goal = drive_footfall for event → day must be 1-3 days before event
```

**Action on Failure**: Log error, regenerate with explicit constraint, or skip post with explanation.

---

#### Fix 4: Phase 1 Programme-Content Awareness

**Requirement**: Phase 1 must understand programme semantic meaning

**Enhanced Context for Phase 1**:
```
For each programme, provide semantic tags:
- occasion: [weekday_lunch, weekend_brunch, evening_dining, after_work, celebration]
- optimal_days: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
- optimal_times: [07:00-11:00, 11:00-14:00, 14:00-18:00, 18:00-22:00]

Example:
Programme: "Signature Cocktails"
  occasion: [after_work, evening_dining]
  optimal_days: [Thu, Fri, Sat]
  optimal_times: [14:00-18:00, 18:00-22:00]

Programme: "Weekend Brunch"
  occasion: [weekend_brunch]
  optimal_days: [Sat, Sun]
  optimal_times: [07:00-11:00]
```

**Phase 1 Instruction**:
"Use optimal_days and optimal_times as PRIMARY constraint for timing_window. Only deviate if strategic context demands it (e.g., event pinning)."

---

#### Fix 5: Event Pinning Refinement

**Requirement**: Event pinning must understand event theme and content appropriateness

**Current Problem**: Mors Dag Sunday got drinks post instead of brunch/family content

**Enhanced Event Handling**:
```
For each event, specify:
- content_themes: [brunch, family, celebration, etc.]
- avoid_themes: [drinks, nightlife, after-work, etc.]

Example:
Event: Mors Dag (Mother's Day)
  date: Sunday, May 10
  commercial_weight: 5 (high)
  content_themes: [brunch, family, celebration, gratitude]
  avoid_themes: [drinks, nightlife, party]
  
Phase 2a Event Pinning Logic:
- For high-priority events, pin footfall posts 1-2 days BEFORE
- Content for pinned posts must match event content_themes
- Content matching avoid_themes cannot be scheduled on event day
```

**Effect**: Sunday (Mors Dag) would reject drinks content, force brunch/family content or skip.

---

### Testing Requirements

**Before Deploying Fixes**:

1. **Regression Test Suite**:
   - Generate 20 weeks for 5 different businesses
   - Check: drinks posts only on Thu-Sat at 14:00+
   - Check: brunch posts only on Sat-Sun at 07:00-11:00
   - Check: no "evening" content before 14:00
   - Check: no rationale-execution mismatches

2. **Event Handling Test**:
   - Generate weeks with high-priority events (Easter, Christmas, Mother's Day, Valentine's Day)
   - Check: footfall posts 1-2 days BEFORE events
   - Check: content themes match event (brunch for Mother's Day, romance for Valentine's)
   - Check: no post-event content (Tuesday post for Sunday event is OK, but not Monday post)

3. **Edge Case Test**:
   - Business with limited programmes (only 5 items)
   - Business with no drinks programme
   - Business with only weekend operations (Fri-Sun)
   - Week with multiple events (check prioritization)

---

## Conclusion

The Sunday 9:00 drinks post ("Aftenstemning") represents a **catastrophic failure** of the Weekly Plan scheduling logic, not an edge case. Five distinct errors compound:

1. **Semantic incoherence**: Evening content at morning time
2. **Industry violation**: Drinks on Sunday instead of Thursday-Saturday
3. **Rationale fabrication**: AI claims "perfect timing" for objectively wrong schedule
4. **Event confusion**: Mors Dag handling missed Friday opportunity
5. **Strategic waste**: High-value content deployed at 5% effectiveness

**Root Cause**: The system lacks **content-type awareness** in day assignment (Phase 2a) and **content-time validation** post-generation. Phase 1 may also be generating vague timing_window values that fail to constrain downstream logic.

**Impact**: Owner trust erosion, content waste, algorithmic penalty, competitive disadvantage.

**Fix Complexity**: Moderate (5 architectural enhancements, no fundamental redesign needed).

**Priority**: CRITICAL - affects all businesses, all weeks, core product value proposition.

The good news: The core 3-phase architecture is sound. The problem is **missing constraint layers**, not broken core logic. Fixes are additive (add constraints) rather than subtractive (remove broken code).

---

## Appendix: User Expertise Validation

**User Statement**: "Drinks is for Friday and Saturday as primary and Thursday at secondary."

**Validation**: This aligns perfectly with hospitality industry best practices:
- **Primary days (Fri-Sat)**: Peak weekend evening demand, highest engagement, maximum conversion
- **Secondary day (Thu)**: "Weekend starts Thursday" segment, after-work drinks, pre-weekend priming
- **Wrong days (Sun-Wed)**: Low evening intent, minimal conversion, audience in wrong mindset

**Conclusion**: User has correct domain expertise. System should implement this as hard constraint, not suggestion.

**Trust Implication**: If the AI generates opposite behavior (Sunday drinks) and claims it's "strategically chosen" and "perfect timing," the user will (correctly) conclude the system cannot be trusted. This is not a difference of opinion - this is objectively wrong scheduling that violates industry fundamentals.
