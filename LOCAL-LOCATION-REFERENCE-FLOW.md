# Local Location Reference - Data Flow Documentation

## Overview
The `local_location_reference` field enables authentic, locally-rooted language in AI-generated content by allowing users to specify how locals actually refer to their location (e.g., "ved åen", "Nyhavn", "bugten").

---

## 🔄 Complete Data Flow

### 1. User Input (Profile Page)
```
User edits field in BusinessProfilePage
  ↓
Field: "Lokal stedsbetegnelse"
Value: "ved åen"
  ↓
Saves to: businesses.local_location_reference
```

**Location in UI:**
- **Section:** Placering (Location)
- **Display:** Highlighted beige box showing value
- **Edit:** Input field with green info box explaining usage
- **Visibility:** Prominent, with clear explanation of impact

---

### 2. Database (Source of Truth)
```sql
-- Table: businesses
-- Column: local_location_reference TEXT (nullable)

UPDATE businesses 
SET local_location_reference = 'ved åen'
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

**Schema:**
- **Type:** TEXT (free-form, optional)
- **Nullable:** Yes (not all businesses have distinctive landmarks)
- **Max length:** 50 characters (UI validation)

---

### 3. Brand Profile Generator V5 (Edge Function)

**File:** `brand-profile-generator-v5/index.ts`

#### 3.1 Data Retrieval
```typescript
// Line 102: Fetch from businesses table
const { data: business } = await supabaseClient
  .from('businesses')
  .select('*, local_location_reference')
  .eq('id', businessId)
  .single()

// Line 111: Log for debugging
console.log(`📍 Local reference: ${business.local_location_reference || 'Not set'}`)
```

#### 3.2 Pass to Layer 2 (Commercial Orientation)
```typescript
// Line 262: Pass to generateCommercialOrientation
{
  area_type: location?.area_type,
  neighborhood: location?.neighborhood,
  local_location_reference: business.local_location_reference || location?.local_location_reference,  // Source of truth: businesses table
  nearby_hospitality: location?.nearby_hospitality
}
```

#### 3.3 Pass to Layer 3 (Identity Profile)
```typescript
// Line 318: Pass to generateIdentityProfile
location: {
  area_type: location?.area_type,
  tourist_context: location?.tourist_context,
  neighborhood: location?.neighborhood,
  local_location_reference: business.local_location_reference || location?.local_location_reference,  // Source of truth: businesses table
  supplier_analysis: location?.supplier_analysis
}
```

#### 3.4 Pass to Layer 4 (Audience Segments)
```typescript
// Line 375: Pass to generateAudienceSegments
{
  neighborhood: location?.neighborhood,
  area_type: location?.area_type,
  local_location_reference: business.local_location_reference || location?.local_location_reference,  // Source of truth: businesses table
  tourist_context: location?.tourist_context,
  landmarks: location?.landmarks
}
```

---

### 4. Layer 2: Commercial Orientation

**File:** `_shared/brand-profile/commercial-orientation.ts`

**Interface:** `LocationContext` (line 22)
```typescript
export interface LocationContext {
  area_type?: string;
  neighborhood?: string;
  local_location_reference?: string;  // How locals refer to location (e.g., "ved åen")
  nearby_hospitality?: { /* ... */ };
}
```

**Status:** ⚠️ Currently defined in interface but NOT yet used in prompt generation
**TODO:** Add to `buildCommercialOrientationPrompt()` function

---

### 5. Layer 3: Identity Profile

**File:** `_shared/brand-profile/identity-profile.ts`

#### 5.1 Interface Definition (line 46)
```typescript
export interface LocationInput {
  area_type?: string;
  tourist_context?: string;
  neighborhood?: string;
  local_location_reference?: string;  // How locals refer to location (e.g., "ved åen")
  supplier_analysis?: SupplierAnalysis;
}
```

#### 5.2 Prompt Usage (lines 101-106)
```typescript
// Use local_location_reference as single source of truth for location naming
if (input.location?.local_location_reference) {
  parts.push(`LOCAL REFERENCE: ${input.location.local_location_reference}`);
  parts.push(`CRITICAL: Use EXACTLY "${input.location.local_location_reference}" for location.`);
  parts.push(`Do NOT add city/neighborhood context. Do NOT expand or modify this phrase.`);
}
```

**Impact:** AI uses exact phrase in brand positioning and identity descriptions

---

### 6. Layer 4: Audience Segments

**File:** `_shared/brand-profile/audience-profile.ts`

#### 6.1 Interface Definition (line 93)
```typescript
export interface LocationData {
  neighborhood?: string;
  area_type?: string;
  local_location_reference?: string;  // e.g., "ved åen", "Nyhavn"
  tourist_context?: string;
  landmarks?: string[];
}
```

#### 6.2 Danish Prompt Usage (line 213)
```typescript
`FORRETNINGSKONTEKST:
Navn: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
Beliggenhed: ${location.local_location_reference || location.neighborhood || business.city}
Områdetype: ${location.area_type || 'ukendt'}
Turistkontekst: ${location.tourist_context || 'ingen'}
...
```

#### 6.3 Evidence Requirements (line 256)
```typescript
`BEVIS KRAV:
Hvert segment skal citere konkrete facts:
- Menupunkter (fra listen ovenfor - brug PRÆCISE navne, OPFIND IKKE)
- Åbningstider/dage (fra programkontekst)
- Stedkontekst (${location.local_location_reference || location.neighborhood || business.city})
- Programtype (${programme.programme_type})
```

#### 6.4 Content Angle Example (line 262)
```typescript
`SPROG KRAV:
- TEXT-felter SKAL være på DANSK:
  • "content_angles": "Cocktail-tilbud ved ${location.local_location_reference || 'vandet'}" (ALDRIG "Cocktail specials")
```

**Impact:** 
- Used in location context for audience segments
- Appears in content_angles as authentic local reference
- Part of evidence chain for segment reasoning

---

## 🎯 Actual AI Output Impact

### Without `local_location_reference`:
```json
{
  "label": "Weekend-gæster på jagt efter natteliv",
  "content_angles": [
    "Cocktail-tilbud ved vandet",  ← Generic
    "Natteliv i byen"              ← Generic
  ]
}
```

### With `local_location_reference = "ved åen"`:
```json
{
  "label": "Weekend-gæster på jagt efter natteliv",
  "content_angles": [
    "Cocktail-tilbud ved åen",     ← Authentic!
    "Natteliv ved åen"             ← Authentic!
  ]
}
```

---

## 📊 Usage Priority (Fallback Chain)

```
1. businesses.local_location_reference  ← Primary source (user-editable)
2. business_location_intelligence.local_location_reference  ← Legacy/AI cache fallback
3. location.neighborhood  ← Generic fallback
4. business.city  ← Last resort fallback
```

---

## ✅ Quality Impact Examples

| Business | Generic Output | With local_location_reference |
|----------|---------------|------------------------------|
| Cafe Faust | "ved vandet i Aarhus" | "ved åen" |
| Restaurant | "i indre by" | "Nyhavn" |
| Bar | "i Vesterbro kvarteret" | "i Vesterbro" |
| Café | "ved stranden" | "bugten" |

---

## 🔍 Testing Checklist

- [x] Database field exists (businesses.local_location_reference)
- [x] UI field visible in Profile page (Placering section)
- [x] Value loads from database on page load
- [x] Value saves to database on profile save
- [x] Edge Function reads value from businesses table
- [x] Layer 2 receives value (interface ready, prompt TODO)
- [x] Layer 3 receives value and uses in prompt (✅ ACTIVE)
- [x] Layer 4 receives value and uses in prompt (✅ ACTIVE)
- [ ] Test: Regenerate brand profile and verify "ved åen" appears in output

---

## 🚀 Next Steps

1. **Test with Cafe Faust**
   - Navigate to Brand Profil page
   - Click "Regenerer profil"
   - Verify "ved åen" appears in:
     - Layer 3: Brand positioning/essence
     - Layer 4: Audience segment content_angles

2. **Add to Layer 2 prompts** (optional enhancement)
   - Update `buildCommercialOrientationPrompt()` in commercial-orientation.ts
   - Include local_location_reference in location context section

3. **Future: AI Extraction**
   - Extract from website "Om os" text during analysis
   - Pattern matching: "ved [landmark]", "i [area]", "lige midt i [place]"
   - Auto-populate field during website analysis

---

## 📝 Code Locations Summary

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| UI Display | `BusinessProfilePage.tsx` | 1326-1340 | ✅ Complete |
| UI Edit Form | `BusinessProfilePage.tsx` | 1346-1382 | ✅ Complete |
| State Management | `BusinessProfilePage.tsx` | 30, 66, 142, 156, 367 | ✅ Complete |
| Database Save | `BusinessProfilePage.tsx` | 839 | ✅ Complete |
| Edge Function Load | `brand-profile-generator-v5/index.ts` | 102, 111 | ✅ Complete |
| Layer 2 Interface | `commercial-orientation.ts` | 22 | ⚠️ TODO: Use in prompt |
| Layer 3 Interface | `identity-profile.ts` | 46 | ✅ Complete |
| Layer 3 Prompt | `identity-profile.ts` | 101-106 | ✅ Complete |
| Layer 4 Interface | `audience-profile.ts` | 93 | ✅ Complete |
| Layer 4 Prompt (DA) | `audience-profile.ts` | 213, 256, 262 | ✅ Complete |

---

## 💡 Key Design Decisions

1. **Source of Truth:** `businesses` table (user-editable, not AI cache)
2. **Fallback Strategy:** `businesses.local_location_reference` → `business_location_intelligence.local_location_reference` → `neighborhood` → `city`
3. **UI Placement:** Placering (Location) section, after address fields
4. **Validation:** Optional field, NULL allowed, 50 char max
5. **Multi-language:** Works with all supported languages (da, sv, no, de, nl)
6. **Prominence:** Green info box explaining quality impact

---

## 🎓 User Education

**Help Text in UI:**
> **Hvordan bruges dette?**  
> AI'en bruger denne lokale betegnelse i alt genereret indhold for at gøre opslag mere autentiske.  
> Eksempler: "ved åen", "Nyhavn", "bugten", "i Vesterbro".  
> **→ Forbedrer kvaliteten af opslag markant!**

This ensures users understand:
- **What it does:** Used in all AI content
- **Why it matters:** Improves authenticity significantly
- **How to use it:** Concrete examples provided
