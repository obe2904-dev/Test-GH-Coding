# Business Archetype Implementation - Current Status

**Date:** 2026-06-09  
**Status:** Code deployed, database partially updated, pending final verification

---

## ✅ Completed

### 1. Code Implementation
All code changes have been deployed:

- **Migration file created:** `supabase/migrations/20260609000001_add_business_archetype.sql`
- **AI inference logic:** `supabase/functions/_shared/brand-profile/archetype-inference.ts`
- **Brand profile generator:** Archetype detection integrated
- **TypeScript types:** Updated with 20 archetype values (including `restaurant_bar`)
- **UI display:** Icon and name formatting added
- **Weekly strategy:** Loads archetype from database with fallback

### 2. Database Schema (Partial)
- ✅ **Column exists:** `business_archetype` added to `business_brand_profile` table
- ✅ **ENUM validation working:** Database accepts valid values, rejects invalid ones
- ⚠️ **ENUM incomplete:** Missing `restaurant_bar` value (only 19/20 values present)

### 3. Current Database State
**Cafe Faust archetype:** `cafe_bar` (manually set for testing)

---

## 🔧 Pending Action Required

### Apply ENUM Update
The `restaurant_bar` archetype needs to be added to the database ENUM.

**Run this SQL in Supabase Dashboard → SQL Editor:**

```sql
ALTER TYPE business_archetype_enum ADD VALUE 'restaurant_bar' AFTER 'cafe_bar';
```

**Why this is needed:**
- Cafe Faust is NOT just a cafe/bar hybrid
- Analysis shows: Full restaurant (brunch/lunch/dinner) + late-night bar (until 2am weekends)
- Current `cafe_bar` archetype is inaccurate
- New `restaurant_bar` archetype correctly represents: Full-service restaurant with late-night bar component

---

## 📊 Cafe Faust Analysis Results

**Service Model:**
- ✅ Brunch (09:00-14:00)
- ✅ Lunch (09:00-17:30)
- ✅ **Dinner with 3-course menus** (17:30-21:30)
- ✅ Bar/cocktails
- ✅ Open until **2am on weekends** (Friday/Saturday)

**Business Character:**
> "Café beliggende ved åen i Aarhus, der tilbyder brunch, frokost og 3-retters menuer. Frokostservering fra kl. 9.00 til 17.30 med retter som pariserbøf, bøf & bearnaise og falafelsalat. Bar med cocktails og åbent til kl. 02 i weekenden."

**Recommended Archetype:** `restaurant_bar`  
**Current Archetype:** `cafe_bar` (incorrect)

---

## 🧪 Verification Checklist

After applying the ENUM update, verify:

### [ ] Step 1: Verify ENUM Update
Run verification script to confirm `restaurant_bar` was added:
```bash
deno run --allow-net --allow-read --allow-env --no-lock _verify_archetype_migration.mjs
```

Expected: "✅ All 20 values present"

### [ ] Step 2: Update Cafe Faust Archetype
Set Cafe Faust to correct archetype:
```sql
UPDATE business_brand_profile 
SET business_archetype = 'restaurant_bar'
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

### [ ] Step 3: Regenerate Brand Profile
Trigger brand profile regeneration for Cafe Faust to test AI inference.

**Expected logs:**
```
🏛️ Business archetype inferred: restaurant_bar (Full-service restaurant with late-night bar)
🔍 Archetype inputs: {
  service_periods: ['brunch', 'lunch', 'dinner'],
  late_night_closing: true,
  opening_hours: { latest_close: '02:00:00' }
}
```

### [ ] Step 4: Verify UI Display
Check brand profile page shows:
```
🍽️🍸 FORRETNINGSTYPE (KLASSIFICERET)
    Restaurant/Bar
```

### [ ] Step 5: Test Weekly Strategy
Generate weekly plan and verify logs show:
```
[get-weekly-strategy] Using database business_archetype: restaurant_bar
```

---

## 📝 Complete Archetype List (20 values)

1. `fine_dining` - Fine dining restaurant ⭐
2. `casual_dining` - Casual dining restaurant 🍽️
3. `cafe_bistro` - Café bistro ☕
4. `cafe_bar` - Café by day, bar by night 🍷
5. **`restaurant_bar`** - **Full-service restaurant + late-night bar** 🍽️🍸 ⭐ **NEW**
6. `wine_bar` - Wine-focused bar 🍷
7. `coffee_shop` - Specialty coffee shop ☕
8. `quick_service` - Quick service 🚀
9. `bakery` - Bakery/patisserie 🥐
10. `morning_cafe` - Morning-only café 🌅
11. `brunch_cafe` - Brunch-focused café 🥞
12. `all_day_cafe` - All-day café (no dinner) ☕
13. `lunch_restaurant` - Lunch-only restaurant 🍴
14. `dinner_restaurant` - Dinner-only restaurant 🌙
15. `full_service_restaurant` - Full-service restaurant 🍽️
16. `evening_bar` - Evening drinks venue 🍸
17. `late_night_bar` - Late-night bar (after 1am) 🌃
18. `nightlife_bar` - Nightlife/club 🎉
19. `brunch_specialist` - Brunch specialist 🥞
20. `fast_casual` - Fast casual/counter service 🍔

---

## 🎯 Next Steps Summary

1. **Run SQL:** Add `restaurant_bar` to ENUM (see "Pending Action Required" above)
2. **Verify:** Run verification script
3. **Update:** Set Cafe Faust archetype to `restaurant_bar`
4. **Test:** Regenerate brand profile and verify AI inference
5. **Deploy:** Edge functions already deployed, UI changes will deploy automatically

---

## 📁 Modified Files

**Database:**
- `supabase/migrations/20260609000001_add_business_archetype.sql`

**Backend:**
- `supabase/functions/_shared/brand-profile/archetype-inference.ts`
- `supabase/functions/_shared/brand-profile/database.ts`
- `supabase/functions/_shared/post-helpers/types/strategy-types.ts`
- `supabase/functions/brand-profile-generator/index.ts`
- `supabase/functions/get-weekly-strategy/index.ts`

**Frontend:**
- `src/types/database.ts`
- `src/components/brandProfile/BrandProfileDisplay.tsx`

**Total:** 8 files modified, 20 archetype values defined
