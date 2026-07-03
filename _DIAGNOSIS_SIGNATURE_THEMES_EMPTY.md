# DIAGNOSIS: Signature Themes Empty Array Error

## Error Summary
**Error:** `[Layer 0] Validation failed: menuOverview.signature_themes must have at least 1 theme`
**Status:** HTTP 500 from brand-profile-generator-v5
**Root Cause:** AI returning empty `signature_themes: []` array during menu-overview-summary generation

---

## Error Flow

```
Frontend (useBrandProfileV5Generation.ts)
  ↓
1. Call menu-overview-summary Edge Function
   ↓ Generates cross-menu summary using GPT-4o
   ↓ Returns: signature_themes = [] ❌ EMPTY!
   ↓
2. Pass menuOverviewSummary to brand-profile-generator-v5
   ↓
3. Layer 0 construction (index.ts:1125-1145)
   menuOverview: {
     signature_themes: crossMenuSummary.signature_themes,  // []
     ...
   }
   ↓
4. Layer 0 validation (layer-validators.ts:42)
   if (!output.menuOverview?.signature_themes?.length) {
     throw new Error(...)  // ❌ FAILS HERE
   }
```

---

## Why Is AI Returning Empty Array?

### Potential Causes:

1. **Menu summaries are empty/null**
   - `menu_results_v2.ai_summary` might be NULL or empty
   - AI has no content to analyze → returns []

2. **AI prompt not clear enough**
   - Prompt asks for "2-10 labels" but doesn't enforce minimum
   - AI might interpret minimal data as warranting 0 themes

3. **JSON parsing issue**
   - AI might be returning malformed JSON
   - Fallback to empty array

4. **Single menu fallback activated**
   - If menuResults.length < 2, hardcoded `signature_themes: []`
   - But logs show 6 menus, so this shouldn't trigger

---

## Validation Gap

**Problem:** menu-overview-summary.ts only WARNS about empty themes, doesn't ERROR:

```typescript
// Line 266-268 in menu-overview-summary.ts
if (parsed.signature_themes.length < 1 || parsed.signature_themes.length > 15) {
  console.warn(`[CrossMenu] Unusual theme count: ${parsed.signature_themes.length}`);
  // ⚠️ WARNING ONLY - continues execution
}
```

This allows empty array to propagate to Layer 0 validation which REQUIRES at least 1 theme.

---

## Diagnostic Queries

### 1. Check menu summaries for Café Faust
```sql
SELECT 
  service_period_name,
  CASE 
    WHEN ai_summary IS NULL THEN 'NULL'
    WHEN ai_summary = '' THEN 'EMPTY STRING'
    ELSE SUBSTRING(ai_summary, 1, 100)
  END as summary_preview,
  LENGTH(ai_summary) as summary_length,
  jsonb_array_length(structured_data->'categories') as category_count
FROM menu_results_v2
WHERE business_id = '38fc71f8-8afb-4702-a4d7-c981e84bb779'
  AND status = 'done'
ORDER BY created_at DESC;
```

### 2. Check stored menu_overview_summary
```sql
SELECT 
  menu_overview_summary->'total_menus' as total_menus,
  menu_overview_summary->'total_items' as total_items,
  jsonb_array_length(menu_overview_summary->'signature_themes') as theme_count,
  menu_overview_summary->'signature_themes' as themes,
  menu_overview_summary->'gastronomic_profile' as gastro_profile,
  SUBSTRING(menu_overview_summary->'cross_menu_summary'::text, 1, 100) as summary_preview
FROM business_brand_profile
WHERE business_id = '38fc71f8-8afb-4702-a4d7-c981e84bb779';
```

### 3. Check if single-menu fallback was used
```sql
SELECT 
  menu_overview_summary->'is_single_menu' as is_single_menu,
  menu_overview_summary->'total_menus' as total_menus,
  signature_themes
FROM business_brand_profile
WHERE business_id = '38fc71f8-8afb-4702-a4d7-c981e84bb779';
```

---

## Fixes Required

### Fix 1: Strengthen validation in menu-overview-summary.ts

**File:** `supabase/functions/_shared/brand-profile/menu-overview-summary.ts`
**Line:** 266-268

```typescript
// BEFORE (warning only):
if (parsed.signature_themes.length < 1 || parsed.signature_themes.length > 15) {
  console.warn(`[CrossMenu] Unusual theme count: ${parsed.signature_themes.length}`);
}

// AFTER (enforce minimum):
if (parsed.signature_themes.length < 1) {
  throw new Error(`AI returned empty signature_themes array. Prompt may need adjustment or menu summaries may be insufficient.`);
}

if (parsed.signature_themes.length > 15) {
  console.warn(`[CrossMenu] Unusually high theme count: ${parsed.signature_themes.length}`);
}
```

### Fix 2: Improve AI prompt clarity

**File:** `supabase/functions/_shared/brand-profile/menu-overview-summary.ts`
**Line:** ~125 (buildCrossMenuPrompt function)

```typescript
// STRENGTHEN THIS SECTION:
SIGNATUR-TEMAER:
- Vælg MINIMUM 2 og MAXIMUM 10 labels baseret på etablissementets kompleksitet
- Tilpas antal efter hvor mange unikke karakteristika der faktisk findes
- Du må opfinde nye labels hvis de beskriver stedet præcist
- VIGTIGT: Du skal ALTID returnere mindst 2 temaer - selv simple steder har minimum 2 karakteristika

Returner JSON:
{
  "summary": "• Bullet 1\\n• Bullet 2\\n...",
  "signature_themes": ["Label 1", "Label 2", ...]  // MINIMUM 2 labels påkrævet!
}
```

### Fix 3: Add fallback theme generation

**File:** `supabase/functions/_shared/brand-profile/menu-overview-summary.ts`
**Line:** After AI generation (~270)

```typescript
// After parsing AI response, before return
if (parsed.signature_themes.length === 0) {
  console.warn('[CrossMenu] AI returned 0 themes - generating fallback themes');
  
  // Generate basic fallback themes from menu breakdown
  const fallbackThemes: string[] = [];
  
  if (menuBreakdown.some(m => m.service_period.toLowerCase().includes('brunch'))) {
    fallbackThemes.push('Brunch-tilbud');
  }
  if (menuBreakdown.some(m => m.service_period.toLowerCase().includes('frokost'))) {
    fallbackThemes.push('Frokost-servering');
  }
  if (menuBreakdown.some(m => m.service_period.toLowerCase().includes('aften'))) {
    fallbackThemes.push('Aftensmad');
  }
  if (menuBreakdown.length >= 3) {
    fallbackThemes.push('All-day dining');
  }
  
  // Add generic cafe theme if still empty
  if (fallbackThemes.length === 0) {
    fallbackThemes.push('Café-tilbud', 'Casual dining');
  }
  
  parsed.signature_themes = fallbackThemes;
  console.warn(`[CrossMenu] Using ${fallbackThemes.length} fallback themes: ${fallbackThemes.join(', ')}`);
}

return parsed;
```

### Fix 4: Handle single-menu case better

**File:** `supabase/functions/menu-overview-summary/index.ts`
**Line:** 146-155

```typescript
// CURRENT: hardcoded empty array
signature_themes: [],

// IMPROVED: generate basic themes even for single menu
signature_themes: (() => {
  const themes: string[] = [];
  const summary = menuResults[0].ai_summary?.toLowerCase() || '';
  const period = menuResults[0].service_period_name?.toLowerCase() || '';
  
  // Infer basic themes from service period and summary
  if (period.includes('brunch')) themes.push('Brunch');
  if (period.includes('frokost')) themes.push('Frokost');
  if (period.includes('aften')) themes.push('Aftensmad');
  if (summary.includes('dansk')) themes.push('Dansk madkultur');
  if (summary.includes('international')) themes.push('International');
  
  // Ensure at least 1 theme
  if (themes.length === 0) themes.push('Café-tilbud');
  
  return themes;
})(),
```

---

## Immediate Action Plan

1. **Run diagnostic queries** to confirm menu summaries exist and have content
2. **Check Supabase logs** for the menu-overview-summary function call to see actual AI response
3. **Apply Fix 1** (strengthen validation) to catch issue earlier
4. **Apply Fix 2** (improve prompt) to prevent AI from returning empty arrays
5. **Apply Fix 3** (fallback generation) as safety net
6. **Test regeneration** after fixes

---

## Expected Behavior After Fixes

1. Menu overview summary generation validates minimum 2 themes
2. If AI returns 0 themes → ERROR thrown with clear message
3. Fallback theme generation prevents empty arrays
4. Layer 0 validation passes with at least 2 signature themes
5. Brand profile generation succeeds

---

## Related Files

- `supabase/functions/_shared/brand-profile/menu-overview-summary.ts` - AI generation & validation
- `supabase/functions/menu-overview-summary/index.ts` - Edge function handler
- `supabase/functions/brand-profile-generator-v5/index.ts` - Layer 0 construction
- `supabase/functions/_shared/brand-profile/layer-validators.ts` - Layer 0 validation
- `src/hooks/useBrandProfileV5Generation.ts` - Frontend orchestration
