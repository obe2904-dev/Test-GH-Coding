# Prompt Governance Checklist

**Purpose:** Pre-deployment validation for weekly strategy prompt changes  
**Scope:** All prompts in get-weekly-strategy pipeline (Phase 0, 1, 2ab, 2c)  
**Owner:** Strategy System Lead  
**Version:** 1.0.0  
**Date:** 5. maj 2026

---

## Usage Instructions

This checklist MUST be completed before deploying any changes to:
- `supabase/functions/_shared/post-helpers/strategy/phase0.ts`
- `supabase/functions/_shared/post-helpers/strategy/phase1.ts`
- `supabase/functions/_shared/post-helpers/strategy/phase2/phase2ab-unified.ts`
- `supabase/functions/_shared/post-helpers/strategy/phase2/phase2c.ts`
- Commercial mode prompts in classifier/validator

**Checklist Status:**
- ☐ Not Started
- ⧗ In Progress
- ✅ Complete
- ⚠️ Complete with Issues (document below)

---

## Section 1: Schema Field Validation

**Rule:** All prompt input fields MUST exist in live database schema.

### 1.1 Business Brand Profile Fields

Verify these fields exist in `business_brand_profile` table:

| Field Name | Used In | Schema Verified | Notes |
|---|---|---|---|
| `voice_personality` | Phase 1 | ☐ | Core voice framing |
| `voice_tone` | Phase 1 | ☐ | Tone directives |
| `voice_language_style` | Phase 1 | ☐ | Language constraints |
| `voice_emoji_usage` | Phase 1 | ☐ | Emoji policy |
| `post_length_guidelines` | Phase 1 | ☐ | Length constraints |
| `post_strategi` | Phase 1, 2ab | ☐ | **CRITICAL** - objective weighting |
| `brand_story` | Phase 1 | ☐ | Identity context |
| `target_audience` | Phase 1 | ☐ | Audience framing |
| `unique_selling_points` | Phase 1 | ☐ | Differentiation |
| `trigger_configuration` | Classifier | ☐ | **NEW** - commercial triggers |
| `commercial_baseline_mode` | Classifier | ☐ | **NEW** - baseline mode |

**Validation Query:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'business_brand_profile'
AND column_name IN (
  'voice_personality', 'voice_tone', 'voice_language_style',
  'voice_emoji_usage', 'post_length_guidelines', 'post_strategi',
  'brand_story', 'target_audience', 'unique_selling_points',
  'trigger_configuration', 'commercial_baseline_mode'
);
```

**Action if Missing:**
- Remove field reference from prompt OR
- Add migration to create field OR
- Use fallback/default value with explicit warning

---

### 1.2 Business Operations Fields

Verify these fields exist in `business_operations` table:

| Field Name | Used In | Schema Verified | Notes |
|---|---|---|---|
| `has_reservation_system` | Phase 1, Classifier | ☐ | **CRITICAL** - booking mode |
| `delivery_options` | Phase 1 | ☐ | Service mode context |
| `payment_methods` | Phase 1 | ☐ | Transaction context |
| `outdoor_seating_capacity` | Phase 1, Classifier | ☐ | Weather trigger relevance |
| `parking_availability` | Phase 1 | ☐ | Visit friction context |

**Validation Query:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'business_operations'
AND column_name IN (
  'has_reservation_system', 'delivery_options', 'payment_methods',
  'outdoor_seating_capacity', 'parking_availability'
);
```

---

### 1.3 Menu and Content Fields

Verify these fields exist:

| Field Name | Table | Used In | Schema Verified | Notes |
|---|---|---|---|---|
| `seasonal_flag` | menu_items_normalized | Phase 1 | ☐ | Seasonal detection |
| `highlight_flag` | menu_items_normalized | Phase 1 | ☐ | Menu priority |
| `new_item_flag` | menu_items_normalized | Phase 1 | ☐ | Novelty signal |
| `dietary_tags` | menu_items_normalized | Phase 1 | ☐ | Audience matching |
| `commercial_weight` | contextual_calendar | Phase 1, Classifier | ☐ | **CRITICAL** - event priority |

**Validation Query:**
```sql
-- Menu fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'menu_items_normalized'
AND column_name IN ('seasonal_flag', 'highlight_flag', 'new_item_flag', 'dietary_tags');

-- Calendar fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'contextual_calendar'
AND column_name IN ('commercial_weight');
```

---

### 1.4 Weekly Strategies Fields (Output Schema)

Verify these fields exist in `weekly_strategies` table:

| Field Name | Written By | Schema Verified | Notes |
|---|---|---|---|
| `commercial_mode` | get-weekly-strategy | ☐ | **NEW** - booking/footfall/balanced |
| `commercial_mode_reason` | get-weekly-strategy | ☐ | **NEW** - trigger explanation |
| `triggered_by` | get-weekly-strategy | ☐ | **NEW** - active triggers array |
| `min_booking_ideas` | get-weekly-strategy | ☐ | **NEW** - quota |
| `min_footfall_ideas` | get-weekly-strategy | ☐ | **NEW** - quota |
| `commercial_validation_score` | get-weekly-strategy | ☐ | **NEW** - quality score |
| `commercial_validation_passed` | get-weekly-strategy | ☐ | **NEW** - pass/fail |
| `strategic_brief` | get-weekly-strategy | ☐ | Phase 1 output |
| `narrative` | get-weekly-strategy | ☐ | Phase 2c output |
| `post_ideas` | get-weekly-strategy | ☐ | Phase 2ab output |
| `week_context_snapshot` | get-weekly-strategy | ☐ | Context preservation |

**Validation Query:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'weekly_strategies'
AND column_name IN (
  'commercial_mode', 'commercial_mode_reason', 'triggered_by',
  'min_booking_ideas', 'min_footfall_ideas',
  'commercial_validation_score', 'commercial_validation_passed',
  'strategic_brief', 'narrative', 'post_ideas', 'week_context_snapshot'
);
```

---

## Section 2: Instruction Priority and Ownership

**Rule:** Each mandatory instruction has single owner and clear priority.

### 2.1 Instruction Hierarchy (Master Priority Order)

| Priority Level | Instruction Type | Owner | Override Authority |
|---|---|---|---|
| 1 (Highest) | Safety & Factual Constraints | System | Never |
| 2 | Hard Business Constraints | Business Operations | Only with explicit reason |
| 3 | Commercial Objectives | Commercial Mode System | Only when trigger inactive |
| 4 | Strategic Identity | Brand Profile | Only with week evidence |
| 5 | Variety & Quality | Strategy Generator | Adaptive |

**Documentation Location:** This checklist + AI-WEEKLY-PLAN-FLOW-OVERVIEW.md Section 9

---

### 2.2 Priority 1: Safety & Factual Constraints

**Owner:** System (cannot be overridden)

| Instruction | Prompt Location | Verified | Notes |
|---|---|---|---|
| No false claims about menu items | Phase 1, 2ab | ☐ | Menu reality check |
| No promises about availability | Phase 1, 2ab | ☐ | Inventory constraints |
| No fabricated events/dates | Phase 1, 2ab | ☐ | Calendar accuracy |
| No operating hours conflicts | Phase 1, 2ab | ☐ | Opening hours check |
| No price/promotion invention | Phase 1, 2ab | ☐ | No unauthorized offers |

**Conflict Resolution:** Safety always wins. Remove conflicting creative instruction.

---

### 2.3 Priority 2: Hard Business Constraints

**Owner:** Business Operations Team

| Instruction | Prompt Location | Verified | Notes |
|---|---|---|---|
| Respect reservation system status | Phase 1, Classifier | ☐ | No booking CTAs if system absent |
| Respect service mode (dine-in/delivery) | Phase 1 | ☐ | Match operational reality |
| Respect opening hours by day | Phase 1, 2ab | ☐ | No "visit tonight" when closed |
| Respect seasonal menu constraints | Phase 1, 2ab | ☐ | No winter items in summer |
| Respect location type (urban/rural) | Phase 1 | ☐ | Context-appropriate language |

**Conflict Resolution:** Business operations override creative preferences.

---

### 2.4 Priority 3: Commercial Objectives

**Owner:** Commercial Mode System (as of 5. maj 2026)

| Instruction | Prompt Location | Verified | Notes |
|---|---|---|---|
| Apply commercial mode directive | Phase 1, 2ab | ☐ | **NEW** - booking/footfall/balanced |
| Enforce minimum booking ideas quota | Phase 1, 2ab | ☐ | **NEW** - when mode = booking_push |
| Enforce minimum footfall ideas quota | Phase 1, 2ab | ☐ | **NEW** - when mode = footfall_push |
| Include specific CTAs | Phase 2ab | ☐ | **NEW** - reserve_table, visit_today, etc. |
| Include timing urgency | Phase 2ab | ☐ | **NEW** - today, this_week, etc. |
| Include conversion hooks | Phase 2ab | ☐ | **NEW** - compelling reason to act |
| Prioritize reservation opportunities | Phase 1 | ☐ | Valentine's, Mother's Day, etc. |

**Conflict Resolution:** Commercial objectives override stylistic variety when trigger active.

**Trigger-Based Rules:**
- `VD_WEEK` → booking_push → min 3-4 booking ideas
- `MD_WEEK` → booking_push → min 3 booking ideas
- `WEATHER_BREAK` → footfall_push → min 5 footfall ideas
- `FIRST_WEEKEND` → footfall_push → min 4 footfall ideas
- `QUIET_WEEK` → baseline mode → lower quotas

---

### 2.5 Priority 4: Strategic Identity

**Owner:** Brand Profile Team

| Instruction | Prompt Location | Verified | Notes |
|---|---|---|---|
| Apply voice personality | Phase 1, 2ab | ☐ | Core brand voice |
| Apply tone guidelines | Phase 1, 2ab | ☐ | Formal/casual/playful |
| Apply language style | Phase 1, 2ab | ☐ | Sentence structure, vocabulary |
| Apply emoji policy | Phase 1, 2ab | ☐ | Usage frequency/style |
| Apply post_strategi weighting | Phase 1, 2ab | ☐ | **CRITICAL** - Tiltrækning/Fastholdelse/Tillid |
| Maintain brand story coherence | Phase 1 | ☐ | Identity consistency |
| Target audience framing | Phase 1 | ☐ | Audience-specific language |
| USP emphasis | Phase 1 | ☐ | Differentiation points |

**Conflict Resolution:** Strategic identity yields to commercial objectives during trigger weeks, but minimum presence required.

**Minimum Floor Rules:**
- Even in booking_push weeks: at least 1 brand/loyalty idea
- Even in footfall_push weeks: maintain voice personality
- Never fully abandon strategic identity for commercial gain

---

### 2.6 Priority 5: Variety & Quality

**Owner:** Strategy Generator Team

| Instruction | Prompt Location | Verified | Notes |
|---|---|---|---|
| Avoid repetition vs last week | Phase 1 | ☐ | Anti-repeat directives |
| Mix content types | Phase 2ab | ☐ | Educational/promotional/story |
| Mix slot timing | Phase 2ab | ☐ | Breakfast/lunch/dinner spread |
| Mix engagement types | Phase 2ab | ☐ | Questions/tips/offers |
| Seasonal relevance | Phase 1 | ☐ | Weather/calendar alignment |
| Local event integration | Phase 1 | ☐ | Contextual calendar use |

**Conflict Resolution:** Variety yields to all higher priorities. Can be sacrificed for commercial/strategic needs.

---

## Section 3: Conflict Documentation and Tie-Break Precedence

**Rule:** All known conflicts are documented with resolution path.

### 3.1 Known Conflicts and Resolutions

#### Conflict 1: Booking Push vs Brand Voice (Formal)

**Scenario:** Valentine's Week (booking_push) + Formal/Elegant voice personality

**Conflict:** Urgency/CTA language can feel too pushy for elegant brand

**Resolution:**
- **Winner:** Commercial (Priority 3 > Priority 4 during trigger week)
- **Tie-Break:** Use "refined urgency" language ("Reserve your table for an unforgettable evening" vs "Book now!")
- **Minimum Floor:** Maintain elegant language structure, avoid ALL CAPS or aggressive phrasing
- **Owner Decision:** Commercial Mode System sets quota (min 3 booking ideas), Brand Profile sets language register

**Prompt Implementation:**
```
When mode = booking_push AND voice_tone = 'formal':
  Use booking CTAs with elevated language.
  Example: "Secure your reservation" not "Grab your spot"
```

---

#### Conflict 2: Anti-Repetition vs Successful Pattern

**Scenario:** Last week's "new menu item" post performed well + anti-repeat directive

**Conflict:** Should we repeat winning formula or enforce variety?

**Resolution:**
- **Winner:** Depends on context strength
- **Tie-Break:** If new menu item still exists AND is still novel → repeat is valid
- **Override Condition:** Successful pattern can repeat if underlying business reality supports it
- **Owner Decision:** Anti-repeat only applies to SAME content, not same content TYPE

**Prompt Implementation:**
```
Avoid repeating the same specific menu item/event/story from last week.
You MAY repeat content types (e.g., menu highlight) if the subject is different and current.
```

---

#### Conflict 3: Footfall Push vs Closed Day

**Scenario:** FIRST_WEEKEND trigger (footfall_push) + business closed on Sunday

**Conflict:** "Visit this weekend" CTA when closed part of weekend

**Resolution:**
- **Winner:** Hard Business Constraint (Priority 2 > Priority 3)
- **Tie-Break:** Modify footfall CTA to "Visit us Saturday" with specific timing
- **Never:** Suggest visits during closed hours
- **Owner Decision:** Business Operations blocks impossible CTAs, Commercial Mode adapts

**Prompt Implementation:**
```
When suggesting weekend visits, verify business is open on suggested days.
If closed Sunday: use "Visit us Saturday" not "Visit this weekend"
```

---

#### Conflict 4: Multiple Triggers Active (Valentine's + First Weekend)

**Scenario:** Valentine's Day falls on first Saturday of February

**Conflict:** VD_WEEK (booking_push) + FIRST_WEEKEND (footfall_push)

**Resolution:**
- **Winner:** VD_WEEK (higher priority trigger)
- **Tie-Break:** Trigger priority order in classifier determines primary mode
- **Secondary Consideration:** Can incorporate "walk-ins welcome" messaging as secondary CTA
- **Owner Decision:** Commercial Mode Classifier applies priority logic automatically

**Trigger Priority Order:**
1. VD_WEEK (highest commercial value)
2. MD_WEEK
3. FD_WEEK
4. LOCAL_EVENT (if commercial_weight > 8)
5. WEATHER_BREAK
6. FIRST_WEEKEND
7. PAYDAY_PERIOD
8. QUIET_WEEK (baseline)

---

#### Conflict 5: Post Strategi vs Commercial Mode

**Scenario:** Post_strategi = 70% Tillid (Trust) + Commercial Mode = booking_push

**Conflict:** Trust-building content is typically informational, not conversion-oriented

**Resolution:**
- **Winner:** Commercial Mode during trigger weeks (Priority 3)
- **Tie-Break:** Reframe trust content with commercial angle ("Trust our expertise for your special evening → Reserve now")
- **Minimum Floor:** At least 1 pure trust/brand idea even in booking_push weeks
- **Reversal:** In baseline weeks, post_strategi weights dominate

**Prompt Implementation:**
```
Primary objective this week: BOOKING_PUSH (Valentine's trigger)
Secondary objective: Maintain trust-building per brand profile

Generate 3 booking-oriented ideas with trust signals embedded.
Generate 1-2 pure trust/brand ideas to maintain strategic balance.
```

---

#### Conflict 6: Quiet Week vs Repetition Avoidance

**Scenario:** Slow week with no events + strong anti-repetition directives

**Conflict:** Limited content options when week has no distinctive features

**Resolution:**
- **Winner:** Variety (Priority 5) yields to reality
- **Tie-Break:** Revisit evergreen content types with fresh angles
- **Acceptable:** Similar themes to previous quiet weeks if fundamentally nothing has changed
- **Owner Decision:** Strategy Generator relaxes variety pressure in quiet weeks

**Prompt Implementation:**
```
For quiet weeks with limited new signals:
  Focus on execution quality over forced novelty.
  Evergreen content types (menu favorites, staff stories, space ambiance) are acceptable.
  Seek fresh angle/wording, but don't fabricate events to force variety.
```

---

### 3.2 Conflict Resolution Decision Tree

```
┌─────────────────────────────┐
│ Instruction Conflict        │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │ Priority 1?  │ YES → Apply Priority 1, block all others
    │ (Safety)     │
    └──────┬───────┘
           │ NO
           ▼
    ┌──────────────┐
    │ Priority 2?  │ YES → Apply Priority 2, override 3-5
    │ (Hard Ops)   │
    └──────┬───────┘
           │ NO
           ▼
    ┌──────────────────┐
    │ Priority 3?      │ YES → Is trigger active?
    │ (Commercial)     │       YES → Apply Priority 3, override 4-5 with floor
    └──────┬───────────┘       NO → Consider Priority 4
           │ NO
           ▼
    ┌──────────────────┐
    │ Priority 4?      │ YES → Apply if no commercial trigger active
    │ (Strategic)      │       OR apply with commercial adaptation
    └──────┬───────────┘
           │ NO
           ▼
    ┌──────────────────┐
    │ Priority 5       │ → Apply unless conflicts with 1-4
    │ (Variety)        │
    └──────────────────┘
```

---

## Section 4: Pre-Deployment Review

### 4.1 Prompt Change Impact Assessment

For each prompt change, complete:

| Question | Answer | Reviewer | Date |
|---|---|---|---|
| Which prompt file(s) modified? | | | |
| Which priority levels affected? | | | |
| New schema fields referenced? | | | |
| Conflicts with existing instructions? | | | |
| Tested against recent week samples? | | | |
| Commercial validation score impact? | | | |
| Brand voice preservation verified? | | | |

---

### 4.2 Regression Test Requirements

Before deploying prompt changes:

| Test Type | Sample Size | Pass Criteria | Status |
|---|---|---|---|
| Schema validation (Section 1) | All fields | 100% exist in live schema | ☐ |
| Valentine's Week (booking_push) | 3 businesses | Min 3 booking ideas, score ≥ 3.5 | ☐ |
| Quiet Week (baseline) | 3 businesses | Follows post_strategi weights | ☐ |
| First Weekend (footfall_push) | 3 businesses | Min 4 footfall ideas, score ≥ 3.5 | ☐ |
| Formal voice business | 2 businesses | Voice maintained in commercial mode | ☐ |
| Casual voice business | 2 businesses | Voice maintained in commercial mode | ☐ |
| Anti-repetition check | 2 consecutive weeks | No duplicate specific content | ☐ |
| Opening hours compliance | 2 businesses | No closed-time suggestions | ☐ |

**Sample Businesses for Testing:**
- Fine dining with reservation system (formal voice)
- Casual café without reservations (casual voice)
- Outdoor venue (weather-sensitive)
- Business with strong post_strategi profile
- Business closed on specific days

---

### 4.3 Deployment Checklist

**Pre-Deploy (Day -1):**
- ☐ Section 1 schema validation complete
- ☐ Section 2 priority assignments documented
- ☐ Section 3 conflicts reviewed and resolved
- ☐ Section 4.2 regression tests passed
- ☐ Change impact assessment complete
- ☐ Rollback plan documented

**Deploy (Day 0):**
- ☐ Deploy during low-traffic window
- ☐ Monitor first 10 strategy generations
- ☐ Validate commercial scores vs baseline
- ☐ Check for new error patterns

**Post-Deploy (Day +1 to +7):**
- ☐ Review 20 generated strategies
- ☐ Calculate validation pass rate
- ☐ Compare average score vs pre-change baseline
- ☐ Interview 3 business owners for quality feedback
- ☐ Document unexpected behaviors
- ☐ Update this checklist with new conflicts discovered

---

## Section 5: Operating Rhythm

### 5.1 Weekly Review (Every Monday)

| Activity | Owner | Time |
|---|---|---|
| Sample 5 previous week strategies | Strategy Lead | 15 min |
| Check commercial validation pass rate | Strategy Lead | 5 min |
| Review failure patterns (if < 85% pass rate) | Strategy + Commercial Leads | 15 min |
| Flag schema drift issues | Engineering | 10 min |

---

### 5.2 Monthly Audit (First Monday of Month)

| Activity | Owner | Time |
|---|---|---|
| Run Section 1 schema validation queries | Engineering | 20 min |
| Review conflict resolution effectiveness | Strategy Lead | 30 min |
| Update priority hierarchy if needed | Product Owner | 30 min |
| Analyze prompt changes vs quality trends | Strategy + Data | 60 min |
| Update this checklist with new patterns | Strategy Lead | 20 min |

---

### 5.3 Quarterly Deep Review

| Activity | Owner | Time |
|---|---|---|
| Full prompt audit (all phases) | Strategy + Engineering | 4 hours |
| Business outcome correlation analysis | Data + Product | 4 hours |
| Interview business owners (10+) | Product | 4 hours |
| Major priority hierarchy review | Leadership | 2 hours |
| Roadmap for next quarter | Product Owner | 2 hours |

---

## Section 6: Escalation and Exception Handling

### 6.1 When to Skip Checklist

**Never skip Section 1** (schema validation) - Always required.

**May abbreviate Sections 2-4 for:**
- Typo/formatting fixes with no semantic change
- Comment additions
- Variable renaming with no logic change

**Must complete full checklist for:**
- New instruction additions
- Priority changes
- Conflict resolution updates
- Commercial mode changes
- Output schema changes

---

### 6.2 Emergency Hotfix Process

If critical issue requires immediate prompt change:

1. **Deploy hotfix** (restore quality immediately)
2. **Document exception** in Section 7 below
3. **Complete checklist retrospectively** within 48 hours
4. **Add regression test** to prevent recurrence

---

## Section 7: Exception Log

Document all checklist bypasses and emergency changes:

| Date | Change | Reason for Exception | Retrospective Completed | New Test Added |
|---|---|---|---|---|
| _Example: 2026-05-10_ | _Removed broken schema field reference_ | _Critical error blocking all generations_ | _Yes, 2026-05-12_ | _Yes, schema validation test_ |
| | | | | |
| | | | | |

---

## Section 8: Version History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0.0 | 2026-05-05 | Initial checklist with commercial mode system integration | Strategy Team |
| | | | |
| | | | |

---

## Section 9: Approval Sign-Off

For major changes affecting multiple priority levels:

| Role | Name | Signature | Date |
|---|---|---|---|
| Strategy System Lead | | | |
| Commercial Mode Owner | | | |
| Brand Profile Owner | | | |
| Engineering Lead | | | |
| Product Owner | | | |

---

## Quick Reference Card

**Before ANY prompt deployment:**

1. ✅ Run Section 1 schema validation queries
2. ✅ Identify which priority levels affected (Section 2)
3. ✅ Check Section 3 for known conflicts
4. ✅ Run regression tests (Section 4.2)
5. ✅ Complete deployment checklist (Section 4.3)
6. ✅ Monitor post-deploy (Section 4.3)

**Remember:**
- Safety (P1) always wins
- Hard business constraints (P2) override creativity
- Commercial triggers (P3) override style during active weeks
- Strategic identity (P4) has minimum floor even in commercial weeks
- Variety (P5) yields to all higher priorities

**Emergency Contacts:**
- Strategy System Lead: [Contact]
- Commercial Mode Owner: [Contact]
- Engineering On-Call: [Contact]

---

**Status:** ☐ Ready for First Use  
**Next Review:** [Date]  
**Owner:** [Name]
