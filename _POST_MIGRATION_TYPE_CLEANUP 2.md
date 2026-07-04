# POST-MIGRATION TYPE CLEANUP PLAN

## Migration: 20260623000003_drop_v4_legacy_fields.sql

This migration drops 10 V4-only fields from `business_brand_profile`.

---

## ✅ SAFE TO RUN

The migration is **100% SAFE** because:
1. brand-profile-generator-v5 doesn't write these fields
2. No active Edge Functions read these fields
3. All V5 data is in `brand_profile_v5` JSONB

---

## Required Post-Migration Cleanup

After running the migration, update TypeScript type definitions to remove dropped fields.

### 1. Update `src/types/supabase.ts`

**Remove these fields from `business_brand_profile` table definition:**

```typescript
// LINE ~44, ~51, ~61, ~64, ~71, ~81, ~84, ~91, ~101
audience_breadth: string | null          // ❌ REMOVE
business_model_type: string | null       // ❌ REMOVE  
voice_style: string | null               // ❌ REMOVE
classification_rationale: string | null  // ❌ REMOVE (if present)
cta_style: string | null                 // ❌ REMOVE (if present)
commercial_strategy_reasoning: string | null  // ❌ REMOVE (if present)
quality_status: string | null            // ❌ REMOVE (if present)
content_pillars_jsonb: any | null        // ❌ REMOVE (if present)
brand_essence_elaboration: string | null // ❌ REMOVE (if present)
values: any | null                       // ❌ REMOVE (if present)
```

### 2. Update `src/types/database.ts`

**Remove same fields from `business_brand_profile` table definition:**

```typescript
// LINE ~99, ~109, and corresponding Insert/Update types
audience_breadth: string | null          // ❌ REMOVE
business_model_type: string | null       // ❌ REMOVE
// ... etc (same 10 fields as above)
```

### 3. Update `supabase/functions/get-quick-suggestions-v2/types.ts`

**Remove unused fields from `BusinessSegments` interface:**

```typescript
export interface BusinessSegments {
  segments: AudienceSegment[]
  audience_breadth?: string           // ❌ REMOVE (never used)
  business_model_type?: string        // ❌ REMOVE (never used)
  primary_copy_hook?: string
}
```

---

## Files That Reference Dropped Fields (But Are Safe)

### ✅ src/services/brandProfileService.ts (line 192)
```typescript
tone_of_voice: (brandData as any)?.tone_of_voice ?? '',  // voice_style column dropped April 2026
```
**Status:** Comment only, safe. Uses `tone_of_voice` (still exists), not `voice_style`.

### ✅ src/services/enhancedAIContext.ts (line 101)
```typescript
// (content_pillars_jsonb was dropped April 2026 — content_strategy is the canonical field)
```
**Status:** Comment only, safe.

### ✅ src/lib/location/conceptFitAnalyzer.ts (line 61, 467, 476)
```typescript
cta_style: 'Friendly invite' | 'Direct action' | 'Community style';
```
**Status:** **Different context** - This is for concept-fit analysis output, NOT the database field.

### ✅ supabase/functions/analyze-concept-fit/index.ts
```typescript
cta_style: strategy.cta_style,
```
**Status:** **Different context** - Same as above, concept-fit analysis, not database.

### ❓ supabase/functions/brand-profile-generator/index.ts
```typescript
'content_focus', 'cta_style', 'communication_goal', 'competitive_positioning'
```
**Status:** This is the **V4 legacy generator**. Should it be deprecated?

---

## Deployment Steps

### 1. Run Migration
```bash
supabase migration up
```

### 2. Regenerate Types from Database
```bash
supabase gen types typescript --project-id kvqdkohdpvmdylqgujpn > src/types/supabase-generated.ts
```

### 3. Update Manual Type Files
- Remove dropped fields from `src/types/supabase.ts`
- Remove dropped fields from `src/types/database.ts`
- Remove unused fields from `get-quick-suggestions-v2/types.ts`

### 4. Test Compile
```bash
npm run build
```

### 5. Test Runtime
- Generate brand profile (should succeed)
- Get quick suggestions (should succeed)
- Check no TypeScript errors

---

## Optional: Deprecate V4 Generator

The `brand-profile-generator` Edge Function is V4 legacy. Consider:

1. **Mark as deprecated** in comments
2. **Remove from deployment** (keep in git history)
3. **Document that brand-profile-generator-v5 is canonical**

This would prevent confusion and ensure V5-only usage.

---

## Success Criteria

After migration + cleanup:

✅ No TypeScript compile errors
✅ Brand profile generation works (V5)
✅ Quick suggestions work
✅ No references to dropped fields in types
✅ Database schema matches TypeScript types
