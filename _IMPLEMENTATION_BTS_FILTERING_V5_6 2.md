# BTS ANCHOR FILTERING IMPLEMENTATION
## Option 4 - Phase 1: Menu-Based Validation Layer

**Date**: June 22, 2026  
**Version**: V5.6  
**Status**: ✅ IMPLEMENTED & TESTED

---

## 🎯 OBJECTIVE

Prevent AI hallucinations in Behind-The-Scenes (BTS) content by filtering editorial templates against actual menu evidence and verified facilities.

**Target Issue**: Café Faust Week 27 Post #3 generated "Vores barista forbereder dagens første kaffe" despite the business not serving coffee.

**Root Cause**: BTS templates were selected based on business vertical alone ('cafe') without cross-validation against actual menu offerings.

---

## 📋 IMPLEMENTATION SUMMARY

### 1. Files Modified

#### `supabase/functions/_shared/post-helpers/bts-by-vertical.ts`
- **Added**: `getBTSAnchorsFiltered()` function (190 lines)
- **Added**: `requiresVerification()` helper function
- **Preserved**: Original `getBTSAnchors()` for backward compatibility
- **Filtering Rules**:
  1. Barista references → Requires coffee in menu
  2. Coffee/kaffe keywords → Requires coffee in menu
  3. Outdoor/terrace references → Requires verified outdoor seating
  4. Sommelier → Requires wine in menu
  5. Bartender → Requires bar/cocktails in menu
  6. Chef/kok → Requires kitchen operation

#### `supabase/functions/_shared/dagens-forslag-prompt-builder.ts`
- **Updated**: Import statement to include `getBTSAnchorsFiltered`
- **Updated**: BTS anchor generation logic (lines 1080-1110)
- **Added**: Menu data extraction from `DagensPromptContext`
- **Added**: Verified facilities derivation logic
- **Changed**: Call site to use `getBTSAnchorsFiltered()` instead of `getBTSAnchors()`

---

## 🧪 TEST COVERAGE

### Test 1: General Filtering Logic
**File**: `_test_bts_anchor_filtering.mjs`
- ✅ Café Faust scenario (no coffee → barista blocked)
- ✅ Coffee shop with coffee (barista allowed)
- ✅ No menu data (safe fallbacks only)
- ✅ All templates filtered (generic fallbacks provided)
- ✅ Different time buckets (midday anchors)

**Result**: 5/5 tests PASSED

### Test 2: Café Faust Integration
**File**: `_test_cafe_faust_integration.mjs`
- ✅ Morning (9 AM) scenario validation
- ✅ Barista templates blocked
- ✅ Coffee templates blocked
- ✅ Safe alternatives provided
- ✅ Afternoon (3 PM) scenario validation

**Result**: ALL VALIDATION CHECKS PASSED

### Test 3: Database Validation
**File**: `_test_cafe_faust_validation.sql`
- Queries to validate actual Café Faust data
- Menu items check (no coffee found)
- Business operations verification
- Expected filtering outcomes documented

---

## 🔍 VALIDATION RESULTS

### Before Implementation (Week 27 - Hallucination)
```
Templates returned: ALL cafe morning templates
Included:
  • "Hvordan starter din dag som ejer/barista?"
  • "Kaffen inden kaffen — hvad drikker personalet om morgenen?"

AI selected: Barista template
Generated title: "Vores barista forbereder dagens første kaffe"
Result: 🚨 HALLUCINATION - Café Faust does not serve coffee
```

### After Implementation (With Filtering)
```
Templates returned: FILTERED cafe morning templates
Blocked:
  • "Hvordan starter din dag som ejer/barista?" (no coffee)
  • "Kaffen inden kaffen — hvad drikker personalet..." (no coffee)
Allowed:
  • "Det første hold gæster: hvem er de, og hvad siger de altid?"
  • "Hvad gøres klar inden åbning — det ingen gæster ser"

Result: ✅ SAFE - Only factually grounded templates available
```

---

## 📊 FILTERING LOGIC DETAILS

### Data Sources
1. **Menu Categories**: From `DagensPromptContext.menuCategories`
2. **Menu Items Text**: Combined names + descriptions from menu items
3. **Verified Facilities**: Derived from business operations and menu analysis

### Filtering Process
```typescript
// Extract menu data
const menuCategories = ctx.menuCategories?.map(cat => cat.catName) ?? []
const menuItemsText = ctx.menuCategories
  ?.flatMap(cat => cat.items.map(item => `${item.name} ${item.description || ''}`))
  .join(' ') ?? ''

// Derive facilities
const verifiedFacilities = {
  has_outdoor_seating: ctx.outdoorSuitability ?? undefined,
  has_bar: ['bar', 'cocktail_bar', 'wine_bar'].includes(ctx.effectiveVertical),
  has_kitchen: ['restaurant', 'cafe', 'bakery'].includes(ctx.effectiveVertical),
  serves_coffee: menuItemsText.toLowerCase().includes('kaffe') || 
                menuItemsText.toLowerCase().includes('coffee'),
  serves_alcohol: menuItemsText.toLowerCase().includes('vin') || 
                 menuItemsText.toLowerCase().includes('cocktail')
}

// Call filtered function
const btsAnchors = effectiveSlotC === 'behind_scenes'
  ? getBTSAnchorsFiltered(
      ctx.effectiveVertical, 
      ctx.currentHour,
      menuCategories,
      menuItemsText,
      verifiedFacilities
    )
  : []
```

### Keyword Detection
- **Coffee**: kaffe, coffee, espresso, latte, cappuccino
- **Wine**: vin, wine, rødvin, hvidvin
- **Bar**: cocktail, drink, øl, beer
- **Outdoor**: udendørs, udeservering, terrasse, outdoor
- **Kitchen**: Categories matching frokost, middag, brunch, lunch, dinner

---

## 🔒 SAFETY MECHANISMS

1. **No Menu Data → Safe Fallbacks Only**
   - Returns generic BTS anchors that don't require verification
   - Prevents any personnel/facility assumptions

2. **All Templates Filtered → Generic Fallbacks**
   - Provides 4 safe alternative templates
   - Ensures content generation always has valid options

3. **Console Logging**
   - Each filtered template logged with reason
   - Helps debugging and monitoring

4. **Backward Compatibility**
   - Original `getBTSAnchors()` preserved
   - Can be used if filtering not desired

---

## 🚀 DEPLOYMENT READINESS

### ✅ Pre-Deployment Checklist
- [x] Implementation completed
- [x] Unit tests passing (5/5)
- [x] Integration tests passing
- [x] Café Faust scenario validated
- [x] Code quality verified
- [x] Logging added for monitoring
- [x] Backward compatibility maintained

### 📈 Expected Impact
- **Hallucination Prevention**: Barista/coffee references blocked when no coffee in menu
- **Factual Grounding**: All BTS templates verified against actual business data
- **Content Quality**: AI forced to work with verified facts only
- **User Trust**: Reduced risk of invented content in generated posts

### 🎯 Success Metrics
1. Zero barista/coffee hallucinations for non-coffee businesses
2. BTS content aligned with actual menu offerings
3. No increase in content generation failures
4. Maintained or improved content quality scores

---

## 🔄 NEXT PHASES (Future Work)

### Phase 2: Owner Questionnaire (Week 2-3)
- Add `verified_team_facts` field to brand profile
- Create questionnaire for personnel roles
- Integrate questionnaire in onboarding flow

### Phase 3: Photo Analysis (Month 2)
- Integrate `analyze-visual-identity` in onboarding
- Auto-populate `recognizable_interior_identity`
- Enable rich BTS content with visual verification

---

## 📝 NOTES

- **Version**: V5.6 (June 22, 2026)
- **Approach**: Option 4 - Hybrid validation layer
- **Preserves**: Future photo analysis capability via `recognizable_interior_identity` field
- **Scope**: Phase 1 only - menu-based filtering
- **Testing**: Comprehensive test coverage with real Café Faust data

---

## 🎉 RECOMMENDATION

**✅ DEPLOY TO PRODUCTION**

All validation checks passed. The implementation successfully prevents the Café Faust barista hallucination while maintaining content generation quality and providing safe fallbacks.
