# Quick Suggestions Integration Plan

**Goal:** Integrate rotation queue + metadata tracking into get-quick-suggestions  
**Timeline:** 1-2 hours  
**Priority:** High (immediate ROI - fair dish rotation + metadata tracking)

---

## 🎯 Objectives

1. **Fair Dish Rotation:** Use rotation queue instead of manual menu fetching
2. **Metadata Tracking:** Add 5 fields to suggestions (menu_item_id, menu_item_name, content_type, service_period, content_angle)
3. **Service-Period Awareness:** Suggest brunch items at brunch time, dinner items at dinner time
4. **Zero Breaking Changes:** Maintain backward compatibility

---

## 📋 Implementation Checklist

### **Step 1: Import New Utilities**
- [ ] Add imports from `../content-planning/index.ts`
- [ ] Import: `getMenuRotationQueue`, `detectServicePeriod`, `loadMinimalBrandVoice`

### **Step 2: Replace Menu Fetching Logic**
**Current (lines ~1490-1560):**
```typescript
// Fetches from key_offerings, menu_signal, or website_analysis_data
const signatureItems = await fetchMenuFromKeyOfferings(...)
```

**New:**
```typescript
// Detect service period
const { currentPeriod } = await detectServicePeriod(supabase, businessId, currentTimeHHMM)

// Get rotation queue (dishes that haven't been posted recently)
const queue = await getMenuRotationQueue(supabase, {
  businessId,
  servicePeriod: currentPeriod,
  lookbackDays: 90,
  limit: 10
})

// Use queue[0] as primary suggestion
const primaryDish = queue[0]
```

### **Step 3: Add Metadata to AI Prompt**
**Current:**
```typescript
const prompt = `Suggest a dish from: ${signatureItems.join(', ')}`
```

**New:**
```typescript
const prompt = `
Primary suggestion: ${primaryDish.menu_item_name}
Last posted: ${primaryDish.days_since_posted} days ago (or never)
Service period: ${currentPeriod}

Create ONE suggestion for this dish.
`
```

### **Step 4: Add Metadata to Output**
**Current (lines ~2800):**
```typescript
const suggestion = {
  title: dishName,
  caption_base: aiOutput.caption,
  photo_idea: aiOutput.photo_idea,
  content_type: 'menu_item',  // OLD: hardcoded
  // Missing: menu_item_id, service_period, content_angle
}
```

**New:**
```typescript
const suggestion = {
  title: primaryDish.menu_item_name,
  caption_base: aiOutput.caption,
  photo_idea: aiOutput.photo_idea,
  
  // ✅ NEW: Metadata fields
  menu_item_id: primaryDish.menu_item_id,
  menu_item_name: primaryDish.menu_item_name,
  content_type: 'product',  // NEW: matches published_posts schema
  service_period: primaryDish.service_period,
  content_angle: aiOutput.content_angle || determineContentAngle(weather, dishName)
}
```

### **Step 5: Update Database INSERT**
**Current:**
```typescript
await supabase.from('daily_suggestions').insert({
  business_id: businessId,
  title: suggestion.title,
  caption_base: suggestion.caption_base,
  content_type: 'menu_item'  // OLD
})
```

**New:**
```typescript
await supabase.from('daily_suggestions').insert({
  business_id: businessId,
  title: suggestion.title,
  caption_base: suggestion.caption_base,
  
  // ✅ NEW: Metadata columns (from Migration 3)
  menu_item_id: suggestion.menu_item_id,
  menu_item_name: suggestion.menu_item_name,
  content_type: suggestion.content_type,  // 'product'
  service_period: suggestion.service_period,
  content_angle: suggestion.content_angle
})
```

### **Step 6: Test with Cafe Faust**
- [ ] Deploy updated function
- [ ] Call endpoint with Cafe Faust business_id
- [ ] Verify suggestion uses rotation queue
- [ ] Verify metadata saved to daily_suggestions
- [ ] User accepts suggestion
- [ ] Verify metadata flows to published_posts

---

## 🔍 Code Locations

**File:** `supabase/functions/get-quick-suggestions/index.ts`

**Key Sections:**
1. **Menu fetching:** Lines 1490-1560 (replace with rotation queue)
2. **AI prompt building:** Lines 2100-2300 (add metadata context)
3. **Output formatting:** Lines 2700-2850 (add metadata fields)
4. **Database insert:** Lines 2900-3000 (add metadata columns)

---

## 🎨 Content Angle Logic

**Deterministic rules based on context:**

```typescript
function determineContentAngle(weather: string, dishName: string): string {
  // Weather-based angles
  if (weather.includes('regn') || weather.includes('rain')) {
    return 'Rainy-day comfort classic'
  }
  if (weather.includes('sol') || weather.includes('sun')) {
    return 'Perfect summer dish'
  }
  
  // Dish-based angles
  if (dishName.includes('brunch') || dishName.includes('morgenmad')) {
    return 'Weekend brunch favorite'
  }
  
  // Default
  return 'Signature menu highlight'
}
```

---

## ✅ Success Criteria

1. **Function deploys without errors**
2. **Suggestions use rotation queue** (least-recently-posted dish selected)
3. **Metadata saved to daily_suggestions** (5 new columns populated)
4. **Metadata flows to published_posts** (when user accepts)
5. **Service period detection works** (brunch items at brunch time)
6. **No breaking changes** (existing functionality intact)

---

## 🚀 Deployment Steps

1. **Make code changes** (steps 1-5 above)
2. **Test locally** (if possible with Deno)
3. **Deploy to Supabase:**
   ```bash
   supabase functions deploy get-quick-suggestions
   ```
4. **Test with Cafe Faust:**
   ```bash
   curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-quick-suggestions \
     -H "Authorization: Bearer <anon-key>" \
     -d '{"businessId":"f4679fa9-3120-4a59-9506-d059b010c34a"}'
   ```
5. **Verify in database:**
   ```sql
   SELECT menu_item_name, content_type, service_period, content_angle
   FROM daily_suggestions
   WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
   ORDER BY created_at DESC
   LIMIT 1;
   ```

---

## 🐛 Rollback Plan

If issues arise:

1. **Revert deployment:**
   ```bash
   # Re-deploy previous version from git
   git checkout HEAD~1 supabase/functions/get-quick-suggestions/
   supabase functions deploy get-quick-suggestions
   ```

2. **Database still works:** Migrations are backward-compatible (nullable columns)

3. **Frontend unaffected:** Output format unchanged (only added fields)

---

**Ready to proceed!** 🎯
