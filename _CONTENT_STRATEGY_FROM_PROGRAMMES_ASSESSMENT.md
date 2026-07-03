# Content Strategy from Programmes - Assessment

## Current Situation

You're **absolutely correct** - we should use **real business data** from `business_programme_profiles` instead of hardcoded templates!

### Data Available in business_programme_profiles

Each programme (brunch, lunch, dinner, bar) has:

```json
{
  "baseline_goal_split": {
    "drive_footfall": 60,
    "strengthen_brand": 20,
    "retain_regulars": 20
  },
  "content_type_affinity": {
    "place": 30,
    "proof": 5,
    "process": 10,
    "product": 40,
    "urgency": 10,
    "retention": 5
  }
}
```

---

## The Mismatch Problem

**Two different taxonomies exist:**

### Taxonomy 1: V5 Programmes (in business_programme_profiles)
- **Goal fields:** `drive_footfall`, `strengthen_brand`, `retain_regulars`
- **Content types:** `place`, `proof`, `process`, `product`, `urgency`, `retention`

### Taxonomy 2: Weekly Plan (expected by strategy-modulator.ts)
- **Goal fields:** `drive_footfall`, `build_brand`, `retain_loyalty`  
- **Content types:** `product_menu`, `craving_visual`, `behind_scenes`, `team_people`

**Field name mapping needed:**
- `strengthen_brand` → `build_brand`  
- `retain_regulars` → `retain_loyalty`

**Content type mapping unclear:**
- How does `place/proof/process/product/urgency/retention` map to `product_menu/craving_visual/behind_scenes/team_people`?

---

## Proposed Solution

### Step 1: Aggregate baseline_goal_split from programmes

```typescript
// In brand-profile-generator Stage PS, before writing posting_strategy:

// 1. Query business_programme_profiles
const { data: programmes } = await supabaseClient
  .from('business_programme_profiles')
  .select('baseline_goal_split')
  .eq('business_id', businessId)

if (programmes && programmes.length > 0) {
  // 2. Aggregate goal splits across all programmes
  const aggregated = programmes.reduce((acc, p) => {
    const split = p.baseline_goal_split || {}
    acc.drive_footfall += split.drive_footfall || 0
    acc.strengthen_brand += split.strengthen_brand || 0
    acc.retain_regulars += split.retain_regulars || 0
    return acc
  }, { drive_footfall: 0, strengthen_brand: 0, retain_regulars: 0 })
  
  const count = programmes.length
  
  // 3. Normalize to 100% and rename fields
  const total = aggregated.drive_footfall + aggregated.strengthen_brand + aggregated.retain_regulars
  goal_blend = {
    drive_footfall: Math.round((aggregated.drive_footfall / total) * 100),
    build_brand: Math.round((aggregated.strengthen_brand / total) * 100),  // RENAME
    retain_loyalty: Math.round((aggregated.retain_regulars / total) * 100) // RENAME
  }
  
  console.log(`[Stage PS] Aggregated goal_blend from ${count} programmes:`, goal_blend)
} else {
  // Fallback to booking_model_type-based template
  goal_blend = { drive_footfall: 50, build_brand: 30, retain_loyalty: 20 }
}
```

### Step 2: Map or Ignore content_type_affinity

**Option A: Simple mapping (heuristic)**
```typescript
// Rough mapping from V5 to Weekly Plan taxonomy
const affinity = aggregateContentAffinity(programmes) // average across programmes
content_category_weights = {
  product_menu: affinity.product + affinity.proof,      // product + proof of quality
  craving_visual: affinity.place + affinity.urgency,    // place appeal + urgency
  behind_scenes: affinity.process,                       // process/craft
  team_people: affinity.retention                        // retention/loyalty
}
```

**Option B: Ignore it - use business characteristics**
```typescript
// Ignore content_type_affinity for now, derive from establishment type
const isBarOriented = psEstablishmentType.toLowerCase().includes('bar')
content_category_weights = isBarOriented
  ? { product_menu: 30, craving_visual: 35, behind_scenes: 20, team_people: 15 }
  : { product_menu: 35, craving_visual: 25, behind_scenes: 25, team_people: 15 }
```

**Recommendation:** Use **Option B** initially because the taxonomies don't cleanly map.

---

## Implementation Priority

### High Priority ✅
- **Aggregate `baseline_goal_split` from programmes** → This is real data and directly applicable
- Fallback to booking_model_type template if no programmes exist

### Medium Priority ⚠️
- **Derive `content_category_weights` from establishment type** → Good enough heuristic
- Consider programme count (3+ programmes = balanced, 1-2 = focused)

### Low Priority (Future)
- Reconcile the two taxonomies (might require V5 architecture update)
- Generate `content_type_affinity` that maps to weekly plan categories

---

## Code Changes Required

### File: `supabase/functions/brand-profile-generator/index.ts`

**Location:** Stage PS (around line 2215)

**Before:**
```typescript
// Hardcoded based on booking_model_type only
let goal_blend = { drive_footfall: 50, build_brand: 30, retain_loyalty: 20 }
if (ps?.booking_model_type === 'booking_only') {
  goal_blend = { drive_footfall: 30, build_brand: 45, retain_loyalty: 25 }
} else if (ps?.booking_model_type === 'walk_in') {
  goal_blend = { drive_footfall: 55, build_brand: 25, retain_loyalty: 20 }
}
```

**After:**
```typescript
// 1. Try to get goal_blend from business_programme_profiles
const { data: programmes } = await supabaseClient
  .from('business_programme_profiles')
  .select('baseline_goal_split, programme_type')
  .eq('business_id', businessId)

let goal_blend = { drive_footfall: 50, build_brand: 30, retain_loyalty: 20 }  // default

if (programmes && programmes.length > 0) {
  // Aggregate from real programme data
  const agg = programmes.reduce((acc, p) => {
    const s = p.baseline_goal_split || {}
    acc.drive_footfall += s.drive_footfall || 0
    acc.strengthen_brand += s.strengthen_brand || 0
    acc.retain_regulars += s.retain_regulars || 0
    return acc
  }, { drive_footfall: 0, strengthen_brand: 0, retain_regulars: 0 })
  
  const total = agg.drive_footfall + agg.strengthen_brand + agg.retain_regulars
  if (total > 0) {
    goal_blend = {
      drive_footfall: Math.round((agg.drive_footfall / total) * 100),
      build_brand: Math.round((agg.strengthen_brand / total) * 100),
      retain_loyalty: Math.round((agg.retain_regulars / total) * 100)
    }
    console.log(`[${requestId}] Stage PS: goal_blend from ${programmes.length} programmes:`, goal_blend)
  } else {
    console.warn(`[${requestId}] Stage PS: programmes exist but no valid baseline_goal_split — using fallback`)
  }
} else {
  // Fallback to booking_model_type template
  if (ps?.booking_model_type === 'booking_only') {
    goal_blend = { drive_footfall: 30, build_brand: 45, retain_loyalty: 25 }
  } else if (ps?.booking_model_type === 'walk_in') {
    goal_blend = { drive_footfall: 55, build_brand: 25, retain_loyalty: 20 }
  }
  console.log(`[${requestId}] Stage PS: No programmes — using ${ps?.booking_model_type || 'default'} template`)
}
```

---

## Testing Plan

1. **Check Café Faust programmes:**
   ```sql
   SELECT 
     programme_type,
     programme_name,
     baseline_goal_split,
     content_type_affinity
   FROM business_programme_profiles
   WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
   ```

2. **Regenerate brand profile** → Should aggregate goal_blend from programmes

3. **Verify content_strategy** in brand_voice:
   ```sql
   SELECT 
     business_name,
     brand_voice->'content_strategy'->'goal_blend' as goal_blend
   FROM business_brand_profile
   WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
   ```

4. **Generate weekly plan** → Should use personalized goal_blend

---

## Summary

- ✅ **Use real data:** Aggregate `baseline_goal_split` from business_programme_profiles
- ✅ **Rename fields:** `strengthen_brand` → `build_brand`, `retain_regulars` → `retain_loyalty`
- ⚠️ **Content weights:** Keep establishment-based heuristic for now (taxonomy mismatch)
- ✅ **Fallback:** Use booking_model_type template if no programmes exist

This gives you **personalized** goal_blend based on actual business programmes while keeping content_category_weights as a reasonable heuristic.
