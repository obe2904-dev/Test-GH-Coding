# Revenue Driver Analyzer Upgrade Summary
**Date:** 2026-06-07  
**Business Tested:** Cafe Faust (f4679fa9-3120-4a59-9506-d059b010c34a)

---

## 🎯 What Changed

The Revenue Driver Analyzer now **prioritizes structured programme data** from `brand_profile_v5.layer_1_programmes` instead of AI text inference.

---

## 📊 Before vs After Comparison

### **Before (AI Text Inference)**
```json
{
  "analyzed_from": "business_about",
  "confidence_score": 85,
  "primary_revenue_moment": {
    "moment_id": "weekend_dinner_cocktails",
    "service_type": "dinner_and_bar",
    "time_range": "17:30-02:00",
    "days": ["Friday", "Saturday"]
  },
  "secondary_revenue_moments": [
    {"moment_id": "weekend_brunch"},
    {"moment_id": "weekday_lunch_cafe"}
  ],
  "preferred_days": ["Monday", "Wednesday", "Thursday", "Saturday"]
}
```

**Issues:**
- ❌ 85% confidence (AI guessing from text)
- ❌ Vague time ranges (guessed)
- ❌ Missing actual programme structure
- ❌ No connection to menu data

---

### **After (Structured Programme Data)**
```json
{
  "analyzed_from": "brand_profile_v5.layer_1_programmes",
  "confidence_score": 95,
  "primary_revenue_moment": {
    "moment_id": "lunch_frokost",
    "label": "FROKOST",
    "service_type": "lunch",
    "time_range": "09:00-17:30",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "decision_pattern": "same_day_afternoon",
    "decision_windows": [
      {
        "description": "Morning decision for lunch plans",
        "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "hours": "08:00-11:00",
        "conversion_strength": "medium"
      }
    ],
    "post_timing_rules": [
      {
        "timing": "same_day 08:00-10:00",
        "purpose": "Drive same-day lunch traffic",
        "priority": "recommended"
      }
    ]
  },
  "secondary_revenue_moments": [
    {
      "moment_id": "morning_brunch",
      "label": "Brunch",
      "time_range": "09:00-14:00"
    },
    {
      "moment_id": "dinner_aften",
      "label": "AFTEN",
      "time_range": "17:30-21:30",
      "decision_windows": [
        {
          "description": "Thursday-Friday afternoon planning for weekend dining",
          "days": ["Thursday", "Friday"],
          "hours": "14:00-18:00",
          "conversion_strength": "high"
        }
      ],
      "post_timing_rules": [
        {
          "timing": "Thursday 14:00",
          "purpose": "Prime weekend dinner intent for Fri-Sat",
          "priority": "required"
        }
      ]
    }
  ],
  "preferred_days": ["Monday", "Thursday", "Wednesday"]
}
```

**Improvements:**
- ✅ **95% confidence** (from actual menu data)
- ✅ **Exact time windows** from programme data (09:00-17:30, 17:30-21:30)
- ✅ **Programme-based ranking** using commercial goals (drive_footfall scores)
- ✅ **Structured decision windows** (Thursday-Friday 14:00-18:00 for weekend dinner)
- ✅ **Precise post timing rules** (Thursday 14:00 required for AFTEN)
- ✅ **Content focus** mapped from programme goals

---

## 🔍 Key Insights

### Programme Data Used
From `brand_profile_v5.layer_1_programmes`:

1. **FROKOST** (Lunch)
   - Time: 09:00-17:30
   - Drive footfall: **60%** → Primary revenue driver
   - Decision timing: mixed
   - 3 audience segments

2. **Brunch** (Morning)
   - Time: 09:00-14:00
   - Drive footfall: **60%** → Secondary (tied with FROKOST)
   - Decision timing: mixed
   - 2 audience segments

3. **AFTEN** (Dinner)
   - Time: 17:30-21:30
   - Drive footfall: **50%** → Secondary
   - Decision timing: mixed
   - 2 audience segments

### Ranking Logic
- Programmes sorted by `commercialOrientation.baseline_goal_split.drive_footfall`
- FROKOST ranked #1 (60%)
- Brunch ranked #2 (60%)
- AFTEN ranked #3 (50%)

---

## 🚀 Technical Implementation

### Data Source Priority
```typescript
1. Try brand_profile_v5.layer_1_programmes (PREFERRED)
   ↓
2. Fallback to AI text analysis of business_character
   ↓
3. Error if both missing
```

### Mapping Logic
```typescript
Programme Type → Revenue Moment
- "dinner"    → dinner revenue moment
- "lunch"     → lunch revenue moment
- "morning"   → brunch revenue moment

Programme Goals → Primary/Secondary
- Sort by drive_footfall score
- Highest = primary
- Rest = secondary

Programme timeWindow → Exact operating hours
- start: "09:00" → time_range: "09:00-17:30"
- end: "17:30"

decision_timing → decision_pattern
- "planned"     → advance_booking
- "mixed"       → same_day_afternoon
- "spontaneous" → spontaneous
```

---

## ✅ Validation Results

### Cafe Faust Test
- ✅ Function deployed successfully (88.89kB)
- ✅ Structured data extracted from 3 programmes
- ✅ Confidence score: **95%** (up from 85%)
- ✅ Analysis method: `structured_programmes`
- ✅ Preferred days include Thursday (for weekend dinner driver)
- ✅ Data stored in `business_brand_profile.revenue_drivers`
- ✅ Analyzed at: 2026-06-07T12:37:15.809Z

### Database Verification
```sql
SELECT 
  revenue_drivers->>'analyzed_from' as source,
  revenue_drivers->>'confidence_score' as confidence,
  revenue_drivers->'primary_revenue_moment'->>'moment_id' as primary
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

**Result:**
- Source: `brand_profile_v5.layer_1_programmes` ✅
- Confidence: `95` ✅
- Primary: `lunch_frokost` ✅

---

## 🎁 Benefits

### For Business Rules Engine (Step 2)
- ✅ Higher quality input data (95% vs 85% confidence)
- ✅ Exact time windows for slot allocation
- ✅ Structured decision windows for timing rules
- ✅ Programme-based content focus

### For Post Generation
- ✅ Precise posting times (Thursday 14:00 for weekend dinner)
- ✅ Content focus aligned with programme goals
- ✅ Decision windows drive timing strategy

### For Data Quality
- ✅ Deterministic analysis (same programmes = same result)
- ✅ No AI hallucination
- ✅ Directly linked to actual menu data
- ✅ Automatically updates when programmes change

---

## 📋 Fallback Behavior

If `brand_profile_v5.layer_1_programmes` is **null or empty**:
- Falls back to AI text analysis of `business_character`
- Returns 70-89% confidence score
- Still functional, just less accurate

---

## 🔜 Next Steps

1. ✅ **Revenue Driver Analyzer upgraded** (COMPLETE)
2. ⏳ **Business Rules Engine** (Step 2) - Map revenue_drivers → DayAllocationPlan
3. ⏳ **Phase 2a Refactor** (Step 3) - Replace BASE_SLOTS with Business Rules Engine

---

## 📝 Files Modified

- `supabase/functions/analyze-revenue-drivers/index.ts`
  - Added `extractRevenueDriversFromProgrammes()` function
  - Updated query to fetch `brand_profile_v5`
  - Added priority logic: programmes → AI fallback
  - Enhanced `buildNormalWeekStrategy()` with dinner moment detection

**Deployment:**
```bash
supabase functions deploy analyze-revenue-drivers --no-verify-jwt
```

**Size:** 88.89kB (was 84.4kB)
