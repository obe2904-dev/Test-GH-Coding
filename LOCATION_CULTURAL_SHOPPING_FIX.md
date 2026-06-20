# Location Intelligence: Cultural & Shopping Context Fix

**Date:** May 22, 2026  
**Issue:** Strategy generation wasn't emphasizing cultural venues or shopping context for city center locations

---

## 🔍 Problem Identified

When analyzing a business in Aarhus city center, the output showed:
- ❌ No mention of cultural venues (ARoS museum, Aarhus Teater, Musikhuset)
- ❌ Shopping context barely mentioned ("shopping-pause" buried in strengths)
- ❌ No pre-show/post-show positioning despite proximity to theaters/museums
- ✅ Generic strategy: "all-day service", "udeservering", "tourist-friendly"

**Root Cause:**
The location intelligence data was collected correctly (including `neighborhood_character`, `landmarks_nearby`, `category_modifiers`), but **NOT passed to the AI strategy generator**.

---

## ✅ Solution Implemented

### Changes Made to `analyze-concept-fit/index.ts`

#### 1. Pass Location Data Through Analysis Chain

**Before:**
```typescript
const conceptFit = await analyzeConceptFit({
  locationExpectations,
  categoryModifiers: modifiers,
  businessData,
  language,
});
```

**After:**
```typescript
const conceptFit = await analyzeConceptFit({
  locationExpectations,
  categoryModifiers: modifiers,
  locationData: locationData,  // ✅ Now includes full location intelligence
  businessData,
  language,
});
```

#### 2. Extract Cultural & Shopping Context in Strategy Prompt

**New Code:**
```typescript
// Extract location context
const neighborhoodCharacter = locationData?.neighborhood_character || '';
const landmarks = locationData?.landmarks_nearby || [];
const hasShoppingModifier = categoryModifiers?.includes('shopping');

// Identify cultural venues from landmarks
const culturalVenues = landmarks
  .filter((l: any) => 
    l.type?.includes('museum') || 
    l.type?.includes('theater') || 
    l.type?.includes('performing_arts') || 
    l.type?.includes('cultural') ||
    l.type?.includes('entertainment')
  )
  .slice(0, 5);

const hasCulturalVenues = culturalVenues.length > 0;
```

#### 3. Enhanced AI Prompt with Cultural & Shopping Context

**New Sections Added:**

```
🏛️ LOKATIONS KONTEKST (FAKTISK OMGIVELSER):

OMRÅDEBESKRIVELSE:
{neighborhood_character from AI analysis}

🎭 KULTURELLE VENUES I NÆRHEDEN (HØJESTE PRIORITET):
- ARoS Kunstmuseum (2 min gang)
- Aarhus Teater (3 min gang)
- Musikhuset (4 min gang)

⚡ STRATEGISK MULIGHED:
- Pre-show positionering: "Aperitif før forestilling", "Let middag før koncert"
- Post-show positionering: "Midnatsmad efter teater", "Drinks efter museumsbesøg"
- Kulturpublikum: Kvalitetsbevidste gæster der søger autentiske oplevelser

🛍️ SHOPPING KONTEKST:
Denne lokation ligger i et stærkt shoppingområde med stormagasiner og butikker.

⚡ STRATEGISK MULIGHED:
- Shopping-pause positionering: "Hvil under shopping-turen", "Energi-boost mellem butikker"
- Post-shopping positioning: "Belønning efter shopping", "Måltid efter handletur"
- Shopping-publikum: Målrettede shoppere der søger bekvemmelighed og komfort
```

#### 4. Updated Strategy Generation Rules

**New Requirements:**
```
- **PRIORITÉR KULTUREL KONTEKST**: Hvis museer/teatre i nærheden → pre-show/post-show positioning
- **PRIORITÉR SHOPPING KONTEKST**: Hvis shopping-modifier → shopping-pause/post-shopping positioning

KRAV:
- **HVIS KULTURELLE VENUES** (museer/teatre): SKAL inkludere pre-show eller post-show strategi
- **HVIS SHOPPING MODIFIER**: SKAL inkludere shopping-pause eller post-shopping strategi
- Prioritér kulturel og shopping kontekst højere end generiske budskaber
```

**New Examples:**
```
✅ "Pre-show positioning: Let middag eller aperitif før teater/koncert"
✅ "Post-show positioning: Midnatsmad eller drinks efter forestilling"
✅ "Shopping-pause: Hvil og genoplad mellem butikker"
✅ "Target kulturpublikum med kvalitetsbevidst tilgang"
```

---

## 🎯 Expected Improvements

### For Aarhus City Center Business

**Before:**
```
Marketingstrategi:
→ Fremhæv all-day service fra brunch til sen aften
→ Udnyt udeservering som sæsonfordel ved åen
→ Target familier weekend formiddag med børnemenu
→ Positioner som turistvenligt med centrale placering
```

**After (Expected):**
```
Marketingstrategi:
→ Pre-show positioning: Let middag eller aperitif før Aarhus Teater/Musikhuset (3-4 min gang)
→ Post-show positioning: Midnatsmad eller drinks efter forestilling
→ Shopping-pause: Hvil og genoplad mellem stormagasiner og butikker
→ Target kulturpublikum med kvalitetsbevidst tilgang
→ Fremhæv udeservering som sæsonfordel ved åen april-september
```

### Key Changes:
1. **Cultural positioning now FIRST** (pre-show/post-show)
2. **Shopping context explicitly mentioned**
3. **Specific venues referenced** (Aarhus Teater, Musikhuset)
4. **Walking times included** (3-4 min gang)
5. **Generic strategies moved to lower priority**

---

## 📊 Data Flow (After Fix)

```
populate-location-intelligence (Edge Function)
    ├── Google Maps: POI detection, landmarks
    ├── GPT-4o: Cultural context analysis
    │   ├── Museums, theaters (HIGHEST PRIORITY)
    │   ├── Shopping areas (if significant)
    │   └── neighborhood_character generated
    └── Save to business_location_intelligence
        ├── category_scores
        ├── category_modifiers: { city_centre: ['shopping'] }
        ├── landmarks_nearby: [{ name: 'ARoS', type: 'museum' }]
        └── neighborhood_character

analyze-concept-fit (Edge Function)
    ├── Load location_intelligence ✅
    ├── Extract cultural venues ✅ NEW
    ├── Extract shopping modifier ✅ NEW
    ├── Pass to strategy generator ✅ NEW
    └── GPT-4o Strategy Generation
        ├── Sees cultural venues in prompt ✅
        ├── Sees shopping context in prompt ✅
        └── REQUIRED to prioritize these in output ✅
```

---

## 🧪 Testing

### To Verify Fix Works:

1. **Re-run location analysis** for Aarhus business:
   ```
   Go to /dashboard/location
   Click "Analysér" (with force refresh if needed)
   ```

2. **Check database** for location intelligence:
   ```sql
   SELECT 
     neighborhood_character,
     landmarks_nearby,
     category_modifiers
   FROM business_location_intelligence
   WHERE business_id = 'your-business-id';
   ```

3. **Verify strategy output** includes:
   - ✅ Pre-show or post-show positioning
   - ✅ Shopping-pause positioning
   - ✅ Specific venue names (ARoS, Aarhus Teater)
   - ✅ Walking times (2-4 min gang)

### Expected Results for Different Scenarios:

| Location Type | Cultural Venues | Shopping | Expected Strategy Elements |
|--------------|----------------|----------|---------------------------|
| City Centre (Aarhus) | ✅ Yes | ✅ Yes | Pre-show, post-show, shopping-pause |
| Residential | ❌ No | ❌ No | Family-friendly, local community |
| Tourist Area | ✅ Yes | ❌ No | Pre-show, destination dining |
| Shopping District | ❌ No | ✅ Yes | Shopping-pause, post-shopping |

---

## 📝 Files Modified

1. **`supabase/functions/analyze-concept-fit/index.ts`**
   - Added `locationData` parameter to `AnalysisInput` interface
   - Pass `locationData` to `analyzeConceptFit()`
   - Pass `locationData` and `categoryModifiers` to `generateStrategy()`
   - Extract cultural venues and shopping context in `buildStrategyPrompt()`
   - Enhanced prompt with cultural/shopping sections
   - Updated rules to require cultural/shopping emphasis

---

## 🔄 Deployment Steps

1. **Deploy Edge Function:**
   ```bash
   cd supabase
   supabase functions deploy analyze-concept-fit
   ```

2. **Test with real business:**
   - Navigate to `/dashboard/location`
   - Click "Analysér" button
   - Review generated strategy

3. **Verify improvements:**
   - Check for cultural positioning
   - Check for shopping positioning
   - Verify specific venue mentions

---

## 💡 Future Enhancements

### Potential Additions:

1. **Seasonal Cultural Events:**
   - Aarhus Festival (September)
   - Christmas markets (December)
   - Student events (September/February)

2. **Time-Based Positioning:**
   - Matinee shows (lunch positioning)
   - Evening shows (dinner positioning)
   - Weekend shows (brunch positioning)

3. **Distance-Based Messaging:**
   - < 5 min walk: "Perfect for pre-show aperitif"
   - 5-10 min walk: "Quick walk from [venue]"
   - > 10 min: "Worth the walk from [venue]"

4. **Competitive Context:**
   - "Only café with outdoor seating near ARoS"
   - "Best brunch option within 5 min of Musikhuset"

---

## 📚 Related Documentation

- [DASHBOARD_LOCATION_CODE_AND_PROMPTS.md](DASHBOARD_LOCATION_CODE_AND_PROMPTS.md) - Full code reference
- [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md) - Shopping modifier implementation
- Location Context Analysis Prompt (in `claude-analyzer.ts`)

---

**Status:** ✅ Fixed - Ready for deployment and testing

**Next Steps:**
1. Deploy updated Edge Function
2. Test with Aarhus business
3. Monitor strategy output quality
4. Iterate based on results
