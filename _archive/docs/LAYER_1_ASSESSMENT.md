# Layer 1: Information Foundation - Assessment & Implementation

## Executive Summary

**Overall Status:** 70% Complete ✅

**Strengths:**
- Location intelligence system is excellent
- Menu database is comprehensive
- Brand voice system is mature
- i18n and cultural nuances well-handled

**Critical Gaps:**
- Business type taxonomy incomplete (only FSE/SBO, missing MFV/MFD/QSR)
- Service period intelligence not formalized
- No posting frequency defaults per business type

---

## Component-by-Component Assessment

### 1. Business Identity Profile

#### Status: 🟡 60% Complete

#### What You Have:
✅ **Establishment Type Classification**
- Database: `business_operations.establishment_type`
- Values: FSE, SBO
- Auto-detected from menu structure
- Source: [`supabase/migrations/20260119000001_add_establishment_type.sql`](../supabase/migrations/20260119000001_add_establishment_type.sql)

#### What's Missing:
❌ **Food Truck (MFV)** - Not in database
❌ **Mobile Food Dispenser (MFD)** - Not in database
❌ **Quick Service Restaurant (QSR)** - Not in database

**UI shows these** ([`ConceptFitPage.tsx`](../src/pages/dashboard/ConceptFitPage.tsx#L228)) but **backend doesn't support them**.

#### What's Needed:

**Database Update:**
```sql
-- Expand establishment_type enum
ALTER TABLE business_operations 
DROP CONSTRAINT establishment_type_check;

ADD CONSTRAINT establishment_type_check 
CHECK (establishment_type IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR'));
```

**Detection Logic Updates:**
- Update [`menu-extractor.ts`](../supabase/functions/_shared/ai-extractors/menu-extractor.ts#L56) `classifyEstablishmentType()`
- Add detection for:
  - **MFV:** Mobile keywords ("food truck", "mobile", "truck")
  - **QSR:** Fast food keywords ("quick service", "fast food", "counter service")
  - **MFD:** Vending/pre-packaged keywords

**Posting Frequency Defaults:**

| Type | Posts/Week | Instagram % | Facebook % | Style |
|------|------------|-------------|------------|-------|
| FSE  | 3-5 (ideal 4) | 50% | 50% | Refined, minimal emoji |
| SBO  | 3-6 (ideal 4) | 70% | 30% | Casual, moderate emoji |
| MFV  | 5-8 (ideal 6) | 65% | 35% | Playful, frequent emoji |
| MFD  | 2-3 (ideal 2) | 50% | 50% | Professional, minimal |
| QSR  | 3-5 (ideal 4) | 60% | 40% | Casual, moderate emoji |

**Implementation:** ✅ Created migration [`20260128000000_expand_business_types.sql`](../supabase/migrations/20260128000000_expand_business_types.sql)

---

### 2. Location Intelligence

#### Status: ✅ 100% Complete - EXCELLENT

#### What You Have:
✅ **Location Type Detection**
- Waterfront, City Center, Residential, Tourist Area, etc.
- 10 predefined location categories
- Scoring system (0-100 per category)
- Multiple location types per business

✅ **Database Structure:**
- `business_location_intelligence.category_scores` - JSON with all scores
- `business_location_intelligence.area_type` - Primary location type
- Strategy driver selection (seasonal weighting)

✅ **Outdoor Seating Flag:**
- `business_operations.has_outdoor_seating` - Boolean
- Enables seasonal content amplification (Q2-Q3)

#### Implementation Quality: ⭐⭐⭐⭐⭐

**This is production-ready and well-architected.**

---

### 3. Menu Database

#### Status: ✅ 95% Complete - EXCELLENT

#### What You Have:
✅ **Structured Menu Data**
- Categories with items
- Daypart detection (breakfast, lunch, dinner)
- Dietary tags (vegan, gluten-free, etc.)
- Time ranges per category
- Price signals

✅ **Database:**
- `menu_results_v2.structured_data` - Full menu JSON
- Auto-extracted by AI ([`menu-extractor.ts`](../supabase/functions/_shared/ai-extractors/menu-extractor.ts))

✅ **Menu Period Parser:**
- [`menuPeriodParser.ts`](../src/lib/menu/menuPeriodParser.ts) - Parses time ranges
- Handles multiple formats ("BRUNCH 09.00-14.00", "Lunch (11:30-15:00)")

#### What's Missing:
⚠️ **Signature Items Flag** - Could add `is_signature` boolean to highlight hero items
⚠️ **Seasonal Ingredients Detection** - AI could flag seasonal items

**Recommendation:** These are "nice-to-haves" not blockers. Current system is strong.

---

### 4. Operational Context

#### Status: 🟡 70% Complete

#### What You Have:
✅ **Opening Hours**
- Stored in `opening_hours` table
- Day-by-day format
- Extracted from website

✅ **Service Period Detection**
- From menu categories (breakfast/lunch/dinner)
- [`menuPeriodParser.ts`](../src/lib/menu/menuPeriodParser.ts) extracts periods

#### What's Missing:
❌ **Derived Service Focus Field**
- No `primary_service_period` column (e.g., "lunch_only", "all_day", "dinner_only")

❌ **Posting Time Windows**
- No automated calculation of optimal posting times based on service periods
- Example: Lunch-focused restaurant → post at 10:30am for lunch traffic

❌ **Urgency Messaging Triggers**
- No real-time "Open now" / "Last orders in 1 hour" logic

#### What's Needed:

**Database Schema:**
```sql
ALTER TABLE business_operations
ADD COLUMN service_periods TEXT[],  -- ['breakfast', 'lunch', 'dinner']
ADD COLUMN primary_service_period TEXT,  -- 'dinner' | 'lunch' | 'all_day'
ADD COLUMN posting_time_windows JSONB;  -- [{"period": "lunch", "post_at": "10:30"}]
```

**Derivation Logic:**
- Analyze `opening_hours` + `menu_periods` → determine service focus
- Calculate optimal posting windows:
  - Breakfast → post 07:00-08:00
  - Lunch → post 10:30-11:00  
  - Dinner → post 15:00-16:00

**Implementation:** ✅ Created migration [`20260128000001_add_service_period_intelligence.sql`](../supabase/migrations/20260128000001_add_service_period_intelligence.sql)

---

### 5. Brand Voice / Concept Fit

#### Status: ✅ 100% Complete - EXCELLENT

#### What You Have:
✅ **Brand Profile System**
- Brand essence, tone of voice
- Content pillars, messaging hooks
- Target audience personas
- Emoji usage preferences
- Language formality (via i18n)

✅ **Concept Fit Analysis:**
- Per-location-type fit assessment
- Marketing implications per location
- Watchouts and adjustments
- UI summary for user guidance

✅ **i18n & Cultural Nuances:**
- Danish cultural context ("hygge", "ved åen")
- Formality levels per language
- Emoji usage norms

#### Database Tables:
- `brand_profile` - Full brand identity
- `business_concept_fit` - Concept fit analysis per location
- `business_concept_fit_multi` - Multi-location fit details

#### Implementation Quality: ⭐⭐⭐⭐⭐

**This is mature, well-tested, production-ready.**

---

## Migration Plan

### Phase 1: Business Types (Critical) 🔴

**Priority: HIGH**
**Time: 2-3 hours**

1. ✅ Run migration [`20260128000000_expand_business_types.sql`](../supabase/migrations/20260128000000_expand_business_types.sql)
2. Update `classifyEstablishmentType()` in [`menu-extractor.ts`](../supabase/functions/_shared/ai-extractors/menu-extractor.ts)
3. Add detection logic for MFV, MFD, QSR
4. Re-analyze existing businesses to classify them
5. Test on 10-20 real businesses

**Validation:**
```sql
-- Check distribution
SELECT establishment_type, COUNT(*) 
FROM business_operations 
WHERE establishment_type IS NOT NULL 
GROUP BY establishment_type;
```

### Phase 2: Service Period Intelligence 🟡

**Priority: MEDIUM**
**Time: 3-4 hours**

1. ✅ Run migration [`20260128000001_add_service_period_intelligence.sql`](../supabase/migrations/20260128000001_add_service_period_intelligence.sql)
2. Implement `derive_service_periods()` function
3. Backfill existing businesses:
   ```sql
   UPDATE business_operations bo
   SET (service_periods, primary_service_period, posting_time_windows) = 
     (SELECT * FROM derive_service_periods(bo.id))
   WHERE EXISTS (SELECT 1 FROM menu_results_v2 WHERE business_id = bo.id);
   ```
4. Add to onboarding flow (auto-calculate on menu extraction)

### Phase 3: Posting Time Optimization 🟢

**Priority: LOW (Future Enhancement)**
**Time: 8-10 hours**

1. Collect engagement data per posting time
2. Build time-of-day performance analyzer
3. ML model to predict optimal posting times per business
4. Integrate into content scheduler

---

## Data Flow: Layer 1 → Layer 2

### How Layer 1 Feeds Into Strategic Baselines (Layer 2):

```
LAYER 1 OUTPUT:
├── Business Type (FSE/SBO/MFV/MFD/QSR)
│   → Sets baseline posting frequency (3-5, 5-8, etc.)
│   → Determines platform priority (IG vs FB weight)
│   → Defines content style defaults (casual, refined, playful)
│
├── Location Type(s) + Scores
│   → Identifies content opportunities (waterfront summer content)
│   → Determines seasonal amplification (outdoor Q2-Q3)
│   → Sets audience demographic assumptions
│
├── Menu Database
│   → Provides content inventory (what CAN be posted)
│   → Enables daypart-specific content (lunch specials)
│   → Identifies signature items for hero content
│
├── Service Periods + Hours
│   → Determines posting time windows
│   → Enables urgency messaging ("Open now")
│   → Filters content by availability ("Don't post lunch if closed")
│
└── Brand Voice
    → Sets tone constraints (emoji frequency, formality)
    → Provides proof-grounding tokens for validation
    → Defines content pillars and messaging angles

                    ↓
              LAYER 2 INPUT
```

---

## Testing Checklist

### Business Type Classification:
- [ ] FSE correctly identified (full-service restaurants)
- [ ] SBO correctly identified (cafes, bars)
- [ ] MFV correctly identified (food trucks)
- [ ] QSR correctly identified (fast food)
- [ ] Edge cases handled (bistro with bar, cafe with full meals)

### Location Intelligence:
- [x] Multiple location types scored correctly
- [x] Outdoor seating flag accurate
- [x] Seasonal weights calculated properly
- [x] Strategy driver selection working

### Menu Database:
- [x] Daypart detection accurate
- [x] Dietary categories extracted
- [x] Time ranges parsed correctly
- [x] Menu items normalized (Danish characters preserved)

### Service Periods:
- [ ] Primary service period correctly derived
- [ ] Posting time windows calculated
- [ ] All-day vs specific-period correctly identified

### Brand Voice:
- [x] Tone preferences respected
- [x] Emoji usage follows guidelines
- [x] Cultural nuances preserved (Danish "ved åen")
- [x] Proof grounding validates content

---

## Next Steps

1. ✅ **Apply migrations** (2 files created)
2. **Update menu-extractor.ts** to classify MFV/MFD/QSR
3. **Test on 20 businesses** across all types
4. **Validate service period derivation** for 10 businesses
5. **Document edge cases** discovered during testing
6. **Move to Layer 2** (Strategic Baselines) once Layer 1 is complete

---

## Questions for Review

1. **Business Types:** Do you want to add more granular types (e.g., "Fine Dining", "Casual Dining", "Fast Casual")?

2. **Service Periods:** Should we support custom periods beyond breakfast/lunch/dinner (e.g., "happy hour", "late night")?

3. **Location Types:** Are the current 10 location categories sufficient, or do you need more (e.g., "shopping district", "business park")?

4. **Posting Frequency:** Should frequency adapt dynamically based on engagement, or stay fixed per business type?

Let me know which gaps to prioritize, and I'll implement them next.
