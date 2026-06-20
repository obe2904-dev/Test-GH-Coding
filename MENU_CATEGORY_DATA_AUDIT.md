# Menu Category Data Audit

**Date:** 2. juni 2026  
**Business:** Cafe Faust (f4679fa9-3120-4a59-9506-d059b010c34a)  
**Problem:** Menu categories scattered across 8+ database fields with inconsistent data

---

## The Problem

Menu categories exist in **multiple tables and fields**, with **conflicting data** between them. This causes:
- Drinks menus misclassified as food programmes
- Brand profile contamination (AFTEN cocktails appearing in gastronomic profile)
- No single source of truth

---

## Data Locations - BRUNCH vs COCKTAILS Comparison

### 1. `menu_results_v2` Table

| Field | Brunch Value | Cocktails Value | Status |
|-------|-------------|-----------------|--------|
| **raw_text** | "Brunch - Cafe Faust<br>Serveres til kl. 14.00..." | "Cocktails - Cafe Faust<br>Klassiske cocktails..." | ✅ Correct (original text) |
| **structured_data.menuTitle** | `"Brunch"` | `"MENUKORT"` | ❌ Cocktails WRONG (generic label) |
| **structured_data.categories[0].name** | `"BRUNCH"` | `"COCKTAILS"` | ✅ Correct |
| **structured_data.startTime** | `"09:00"` | `"00:00"` | ⚠️ Cocktails placeholder time |
| **structured_data.endTime** | `"14:00"` | `"23:59"` | ⚠️ Cocktails placeholder time |
| **service_periods** | `["brunch"]` | `["brunch"]` | ❌ Cocktails WRONG (copied from brunch?) |
| **service_period_name** | `"brunch"` | `"brunch"` | ❌ Cocktails WRONG (should be "bar" or "cocktails") |

**Issues:**
- Cocktails menu has `menuTitle = "MENUKORT"` (generic Danish for "menu card")
- Cocktails menu has `service_period_name = "brunch"` ❌ CRITICAL ERROR
- Cocktails menu has `service_periods = ["brunch"]` ❌ CRITICAL ERROR
- AI extraction failed to properly classify cocktails menu

---

### 2. `menu_items_normalized` Table

| Field | Brunch Items | Cocktails Items | Status |
|-------|--------------|-----------------|--------|
| **category_name** | `"BRUNCH"` | `"COCKTAILS"` | ✅ Correct for both |
| **category_type** | `"Main"` | `"Main"` | ✅ Correct classification |

**Issues:**
- None - this table has correct data
- Individual items are properly categorized

---

### 3. `menu_sources` Table (GROUND TRUTH)

| Field | Brunch Value | Cocktails Value | Status |
|-------|-------------|-----------------|--------|
| **label** | `"Brunch"` | `"Cocktails"` | ✅ CORRECT - Source of truth |
| **menu_type** | ? | ? | Unknown (not provided) |
| **source_url** | https://cafefaust.dk/brunch/ | https://cafefaust.dk/cocktails/ | ✅ URL contains correct keyword |

**Issues:**
- None - this is the authoritative source
- V4 drinks filter uses this field ✅
- V5 generator does NOT use this field ❌

---

## Data Flow Problems

```
menu_sources.label = "Cocktails" ✅
         ↓
         ↓ (AI extraction process)
         ↓
menu_results_v2.structured_data.menuTitle = "MENUKORT" ❌
menu_results_v2.service_period_name = "brunch" ❌
menu_results_v2.service_periods = ["brunch"] ❌
         ↓
         ↓ (V5 generator reads this)
         ↓
business_programme_profiles = INCLUDES AFTEN ❌
```

**Root Cause:** AI extraction step overwrites ground truth with incorrect inferences.

---

## Source of Truth Analysis

| Field | Reliability | Used By | Notes |
|-------|------------|---------|-------|
| `menu_sources.label` | 🟢 **HIGH** - Ground truth | V4 generator ✅ | Manually set or validated |
| `menu_sources.source_url` | 🟢 **HIGH** - Ground truth | V4 filter (URL check) ✅ | Contains /cocktails/, /brunch/, etc. |
| `menu_results_v2.structured_data.menuTitle` | 🔴 **LOW** - AI extracted | V5 generator? | Cocktails → "MENUKORT" (wrong) |
| `menu_results_v2.service_period_name` | 🔴 **LOW** - AI extracted | V4 filter (tier 2) | Cocktails → "brunch" (wrong) |
| `menu_results_v2.service_periods` | 🔴 **LOW** - AI extracted | Unknown | Cocktails → ["brunch"] (wrong) |
| `menu_items_normalized.category_name` | 🟡 **MEDIUM** - Normalized | Menu displays | Correct but item-level, not menu-level |
| `menu_results_v2.raw_text` | 🟢 **HIGH** - Original source | V4 filter (tier 4) | Original text, reliable |

---

## The Correct Architecture

### What SHOULD Happen:

```
1. menu_sources.label (GROUND TRUTH)
   ↓
2. Use this to VALIDATE AI extraction
   ↓
3. If AI says "brunch" but label says "Cocktails" → Trust label
   ↓
4. Update service_period_name to match label
   ↓
5. All downstream systems read consistent data
```

### What ACTUALLY Happens:

```
1. menu_sources.label = "Cocktails" ✅
2. AI extracts menuTitle = "MENUKORT" ❌
3. AI extracts service_period_name = "brunch" ❌
4. NO VALIDATION against ground truth
5. V5 reads wrong data → AFTEN in profile ❌
```

---

## Why This Matters

### For Brand Profile Generation:
- **V4 Generator:** Uses `menu_sources.label` (ground truth) → Filters correctly ✅
- **V5 Generator:** Queries `menu_results_v2` directly (no JOIN to menu_sources) → No filter ❌

### For Cafe Faust Specifically:
- Brunch menu: All 8 fields agree ✅
- Cocktails menu: 3 fields wrong (menuTitle, service_period_name, service_periods) ❌
- **Result:** AFTEN programme (cocktails) appears in gastronomic brand profile

---

## Data Quality Issues Found

| Issue | Field | Correct Value | Actual Value | Impact |
|-------|-------|--------------|--------------|--------|
| Generic label | `structured_data.menuTitle` | "Cocktails" | "MENUKORT" | Ambiguous menu identification |
| Wrong service period | `service_period_name` | "bar" or "cocktails" | "brunch" | Drinks classified as food |
| Wrong service periods array | `service_periods` | ["bar"] or ["cocktails"] | ["brunch"] | Programme detection fails |

---

## Recommendations

### Immediate Fix (V5 Drinks Filter):
1. Add JOIN to `menu_sources` in V5 generator query
2. Import `isDrinksOnlyMenu()` from V4's data-gatherer
3. Filter menus WHERE `menu_sources.label` indicates drinks

### Medium-term Fix (Data Sync):
1. Create trigger: When `menu_sources.label` = "Cocktails" → Update `menu_results_v2.service_period_name`
2. Add validation: AI extraction must match `menu_sources.label` or flag for review
3. Backfill: Fix existing cocktails menus with wrong service_period_name

### Long-term Fix (Architecture):
1. **Single Source of Truth:** `menu_sources.label` is authoritative
2. **Validation Layer:** AI extractions validated against ground truth before saving
3. **Sync Mechanism:** Changes to `menu_sources.label` cascade to dependent fields
4. **Data Quality Monitoring:** Alert when AI extraction conflicts with ground truth

---

## Example Queries

### Find all menus with mismatched labels:
```sql
SELECT 
  ms.label as ground_truth,
  mr.service_period_name as ai_extracted,
  mr.structured_data->>'menuTitle' as menu_title,
  ms.source_url
FROM menu_results_v2 mr
JOIN menu_sources ms ON mr.source_id = ms.id
WHERE ms.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (
    mr.service_period_name != LOWER(ms.label)
    OR mr.structured_data->>'menuTitle' != ms.label
  );
```

### Find all drinks menus misclassified as food:
```sql
SELECT 
  ms.label,
  mr.service_period_name,
  mr.structured_data->>'menuTitle' as menu_title,
  ms.source_url
FROM menu_results_v2 mr
JOIN menu_sources ms ON mr.source_id = ms.id
WHERE ms.label ~* '(cocktail|drink|wine|gin|beverage)'
  AND mr.service_period_name NOT IN ('bar', 'cocktails', 'drinks');
```

---

## Related Files

- V4 Data Gatherer: [supabase/functions/_shared/brand-profile/data-gatherer.ts](supabase/functions/_shared/brand-profile/data-gatherer.ts)
- V5 Generator: [supabase/functions/brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts)
- Drinks Filter Issue: Original user report about AFTEN contamination
