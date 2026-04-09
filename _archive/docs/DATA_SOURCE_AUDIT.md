# AI Caption Generator - Data Source Audit
**Business:** Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)  
**Date:** 30 January 2026

## ✅ ACTUAL DATA IN DATABASE

### Table: `businesses`
```
name: "Café Faust"
category: "cafe"
country: "DK"
selected_platforms: ["instagram", "facebook"]
```

### Table: `business_locations`
```
city: "Aarhus"
country: "Danmark"
is_primary: true
```

### Table: `business_brand_profile`
```
tone_keywords: ["friendly", "welcoming", "warm"]
voice_style: "Venlig og imødekommende"
business_voice: "friendly"
values: null ❌
certifications: null ❌
do_not_say: null ✅
booking_link: "https://book.dinnerbooking.com/dk/da-DK/book/index/263/2"
```

### Table: `menu_results_v2`
```
73 menu items across 3 menus (Brunch, FROKOST, AFTEN)
19 categories
status: 'done' ✅
```

---

## 🎯 WHAT AI CAPTION GENERATOR NEEDS

### Required Fields (from CaptionGenerationContext type):
```typescript
{
  businessName: string              // ✅ "Café Faust"
  businessCategory: string          // ✅ "cafe"
  city: string                      // ✅ "Aarhus"
  country: string                   // ✅ "DK" / "Danmark"
  
  brandVoice: {
    tone_keywords: string[]         // ✅ ["friendly", "welcoming", "warm"]
    voice_style: string             // ✅ "Venlig og imødekommende"
    values: string[]                // ❌ null (falls back to defaults)
    certifications: string[]        // ❌ null (falls back to defaults)
    do_not_say: { words: string[] } // ✅ null → defaults to { words: [] }
  }
  
  contentOpportunity: {
    type: string                    // ✅ From opportunity selector
    subject: string                 // ✅ Menu item name or content angle
    menuItem: {
      name: string                  // ✅ From menu_results_v2
      description: string           // ✅ From menu_results_v2
      price: string                 // ✅ From menu_results_v2
    }
  }
  
  temporalContext: {
    season: string                  // ✅ From date calculation
    dayOfWeek: string               // ✅ From schedule optimizer
    timeOfDay: string               // ✅ From schedule optimizer
    weather: string                 // ✅ From OpenWeather API
  }
  
  format: string                    // ✅ From media format selector
  platform: string                  // ✅ "instagram" or "facebook"
}
```

---

## 🔄 DATA FLOW MAPPING

### Layer 1: Business Info
**Source:** `businesses` table + `business_locations` table  
**Query in code:**
```typescript
// generate-weekly-plan/index.ts:53-56
const { data: business } = await supabaseClient
  .from('businesses')
  .select('*')
  .eq('owner_id', user.id)
  .single()

// weekly-plan-generator.ts:463-469
const { data: businessLocation } = await supabaseClient
  .from('business_locations')
  .select('city, country')
  .eq('business_id', businessId)
  .eq('is_primary', true)
  .single()
```
**Status:** ✅ Correctly fetched

### Layer 2: Brand Voice
**Source:** `business_brand_profile` table  
**Query in code:**
```typescript
// weekly-plan-generator.ts:456-461
const { data: fullBrandProfile } = await supabaseClient
  .from('business_brand_profile')
  .select('*')
  .eq('business_id', businessId)
  .single()
```
**Status:** ✅ Correctly fetched  
**Mapping:**
```typescript
brandVoice: {
  tone_keywords: fullBrandProfile?.tone_keywords || [],  // ✅ ["friendly", "welcoming", "warm"]
  voice_style: fullBrandProfile?.voice_style || 'casual', // ✅ "Venlig og imødekommende"
  values: fullBrandProfile?.values || [],                 // ❌ null → []
  certifications: fullBrandProfile?.certifications || [], // ❌ null → []
  do_not_say: fullBrandProfile?.do_not_say || { words: [] } // ✅ null → { words: [] }
}
```

### Layer 3: Menu Data
**Source:** `menu_results_v2` table  
**Query in code:**
```typescript
// generate-weekly-plan/index.ts:87-90
const { data: menuItems } = await supabaseClient
  .from('menu_results_v2')
  .select('*')
  .eq('business_id', business.id)
```
**Status:** ✅ 73 items found, correctly parsed

### Layer 4: Weather/Season
**Source:** OpenWeather API + date calculations  
**Status:** ✅ Working (seen in logs)

### Layer 5-7: Content Selection
**Source:** Opportunity selector, scheduler, format selector  
**Status:** ✅ Working (4 posts generated)

### Layer 8: AI Caption Generation
**Source:** Gemini 2.5 Flash API  
**Status:** ⚠️ **FAILING** - But why?

---

## ❌ THE PROBLEM

### Error from logs:
```
[AI Caption] ❌ Generation failed: {
  error: "Cannot read properties of undefined (reading 'values')"
  at buildBusinessContext (prompt-builder.ts:93:26)
}
```

### Root Cause:
The code was accessing `context.brandVoice.values` **before we added optional chaining (`?.`)**

### Fixes Applied:
1. ✅ Changed `brandProfile` → `brandVoice` (correct property name)
2. ✅ Added `city` and `country` as separate fields
3. ✅ Added optional chaining: `context.brandVoice?.values?.length`
4. ✅ Fixed `do_not_say` format: `{ words: [] }` instead of `[]`
5. ✅ Removed duplicate code sections
6. ✅ Deployed to Supabase

---

## 🧪 NEXT STEPS

1. **Verify deployment worked:**
   - Check browser console for new errors
   - Check Edge Function logs for AI caption attempts

2. **Test again:**
   - Generate new plan
   - Wait 30-60 seconds
   - Check if "AI Captions: X/4" increases

3. **If still failing:**
   - Check Gemini API key is valid
   - Check API rate limits
   - Check for new error messages in logs

---

## 📊 DATA COMPLETENESS

| Data Point | Available | Used By AI |
|------------|-----------|------------|
| Business Name | ✅ Café Faust | ✅ Yes |
| Category | ✅ cafe | ✅ Yes |
| Location | ✅ Aarhus, DK | ✅ Yes |
| Tone Keywords | ✅ 3 keywords | ✅ Yes |
| Voice Style | ✅ "Venlig og imødekommende" | ✅ Yes |
| Values | ❌ null | ⚠️ Falls back to defaults |
| Certifications | ❌ null | ⚠️ Falls back to defaults |
| Menu Items | ✅ 73 items | ✅ Yes |
| Weather | ✅ API data | ✅ Yes |
| Season | ✅ Calculated | ✅ Yes |

**Conclusion:** All critical data exists. Missing `values` and `certifications` will use category defaults (Cafes: "friendly, welcoming, authentic").
