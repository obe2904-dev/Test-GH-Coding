# Drinks Filter Audit Results

**Date:** 2. juni 2026

## Summary

✅ **Drinks filter is ONLY in brand profile generators** (correct)  
✅ **Content generators PRESERVE cocktails/bar content** (correct)

---

## Where isDrinksOnlyMenu() Is Used

### ✅ Brand Profile Generators (CORRECT - Should filter)
1. `brand-profile-generator-v5/index.ts` - V5 generator
2. `_shared/brand-profile/data-gatherer.ts` - V4 generator helper

### ❌ Content Generators (CORRECT - Should NOT filter)
- `get-quick-suggestions/index.ts` - **NOT using filter** ✅
- `get-weekly-strategy/` - **NOT using filter** ✅

---

## Content Generator Cocktails/Bar Support

### get-quick-suggestions (Daily Posts)
**Confirmed cocktails/bar content:**
- Line 327: `friday_social` mode includes "fyraftensdrink" (Friday drinks)
- Line 1237: `drinkPattern` detects wine/cocktail menus
- Line 1650: Includes "bar" in programme breakdown
- Line 2308-2320: "Bar åben til..." (bar open until) content
- Line 2524: `isBarVertical` detection for bar-specific content

**Example outputs:**
- "Bar åben til 23:00 — 3 timer efter køkkenet lukker"
- Friday social mode: "fyraftensdrink, weekend starter"
- Drink programme mentions from menu intelligence

### get-weekly-strategy (Weekly Planning)
**Confirmed bar/wine archetypes:**
- Line 78: `wine_bar`, `late_night_bar`, `evening_bar` business modes
- Line 98: `hasBar` detection from programmes
- Line 103-105: `coffee_bar_takeaway` mode
- Line 362: Bar/drinks period detection
- Line 373-374: Morning café vs evening bar differentiation

**Business Modes:**
- `coffee_bar_takeaway`
- `wine_bar`
- `late_night_bar`
- `evening_bar`

---

## Data Flow Architecture

### Brand Profile (Identity) - FILTERS COCKTAILS ✅
```
menu_sources.label = "Cocktails"
         ↓
isDrinksOnlyMenu() = true
         ↓
EXCLUDED from business_programme_profiles
         ↓
Brand identity = Food-focused (FROKOST, Brunch, AFTEN)
```

### Content Generation (Posts) - KEEPS COCKTAILS ✅
```
menu_sources.label = "Cocktails"
         ↓
NO FILTER APPLIED
         ↓
Available in quick suggestions
         ↓
Posts: "Friday cocktails", "Bar open until...", etc.
```

---

## Verification Needed

While the code structure looks correct, we should verify:

1. **Do quick suggestions actually generate cocktail content?**
   - Test: Get suggestions for Friday evening
   - Expected: "fyraftensdrink", bar mentions, cocktail references

2. **Does weekly strategy recognize bar programmes?**
   - Test: Check if Cafe Faust is classified as hybrid (café + bar)
   - Expected: Evening/bar content in strategy

3. **Where does content generation read menu data?**
   - Does it use `menu_results_v2` directly? ✅ (should include cocktails)
   - Or does it use `business_programme_profiles`? ❌ (would exclude cocktails)

---

## Recommendation

**Test quick suggestions now to confirm cocktails appear in content.**

Run this query to check what data quick-suggestions sees:
```sql
SELECT 
  service_period_name,
  structured_data->>'menuTitle' as menu_title,
  ms.label
FROM menu_results_v2 mr
JOIN menu_sources ms ON mr.source_id = ms.id
WHERE ms.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND mr.status = 'done';
```

If cocktails menu appears here, quick-suggestions will use it ✅
