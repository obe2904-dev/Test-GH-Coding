# Phase 1 Complete: V5 Schema Extended with Legacy Fields

**Date**: May 13, 2026  
**Status**: ✅ DEPLOYED  
**Next**: Phase 2 - Remove Legacy Fallback Logic

---

## What Was Accomplished

### 1. Extended V5Identity Interface

**New fields added to `types-v5.ts`:**

```typescript
export interface V5Identity {
  // ... existing fields ...
  
  // === MIGRATED FROM LEGACY (Phase 1) ===
  target_audience?: string;             // Who the brand speaks to
  communication_goal?: string;          // What each post should achieve
  emotional_promise?: string;           // Emotional value proposition
  brand_context?: {                     // Origin story and differentiators
    origin_story?: string;
    unique_differentiator?: string;
    local_landmarks?: string[];
  };
  venue_identity?: string;              // Recognizable interior identity
  visual_identity?: {                   // Photo analysis results
    visual_character?: string;
    venue_scene?: string;
  };
}
```

### 2. Extended V5Voice Interface

**Added legacy humor_level compatibility:**

```typescript
export interface V5Voice {
  // ... existing fields ...
  humor_level?: 'none' | 'subtle' | 'moderate' | 'high';  // Legacy format
}
```

### 3. Updated Brand Profile Generator

**brand-profile-generator-v5/index.ts changes:**

1. **Extended SELECT query** to fetch 8 additional legacy fields:
   - `target_audience`
   - `communication_goal`
   - `emotional_promise`
   - `brand_context`
   - `recognizable_interior_identity`
   - `visual_character`
   - `venue_scene`
   - `humor_level`

2. **Added migration logic** to copy legacy → V5:
   ```typescript
   identity: {
     // ... generated identity fields ...
     
     // Migration: Copy legacy fields
     target_audience: existingProfile?.target_audience || undefined,
     communication_goal: existingProfile?.communication_goal || undefined,
     emotional_promise: existingProfile?.emotional_promise || undefined,
     brand_context: existingProfile?.brand_context || undefined,
     venue_identity: existingProfile?.recognizable_interior_identity || undefined,
     visual_identity: {
       visual_character: existingProfile?.visual_character || undefined,
       venue_scene: existingProfile?.venue_scene || undefined
     }
   }
   ```

3. **Added humor_level migration** to voice profile:
   ```typescript
   if (existingProfile?.humor_level) {
     voiceProfile.humor_level = existingProfile.humor_level
   }
   ```

### Deployment

- ✅ **Deployed**: brand-profile-generator-v5 (300.4kB)
- ✅ **Version**: 5.1 (now includes legacy migration)
- ✅ **No Breaking Changes**: Generator still writes legacy columns (backward compatible)

---

## Impact

### What This Enables

1. **V5 is now complete**: All legacy identity/voice data can be stored in V5 JSONB
2. **No data loss**: Next regeneration will copy all legacy → V5
3. **Ready for Phase 2**: Can now remove legacy fallback logic safely

### What Hasn't Changed Yet

1. ⚠️ **Generator still writes legacy columns** (for backward compatibility during migration)
2. ⚠️ **resolve-context.ts still has fallback logic** (~200 lines of dual-source reads)
3. ⚠️ **No production data migrated yet** (awaiting testing + Phase 2)

---

## Testing Checklist

Before proceeding to Phase 2, verify:

- [ ] Regenerate Café Faust V5 profile
- [ ] Verify `brand_profile_v5.identity.target_audience` populated from legacy
- [ ] Verify `brand_profile_v5.identity.communication_goal` populated
- [ ] Verify `brand_profile_v5.identity.emotional_promise` populated
- [ ] Verify `brand_profile_v5.identity.brand_context` populated (if exists)
- [ ] Verify `brand_profile_v5.identity.venue_identity` populated
- [ ] Verify `brand_profile_v5.identity.visual_identity` populated
- [ ] Verify `brand_profile_v5.voice.humor_level` populated (if exists)
- [ ] Verify no TypeScript errors in deployed function

---

## Next Steps: Phase 2

**Goal**: Remove legacy fallback logic from resolve-context.ts

**Changes Required:**

1. **Simplify SELECT query** (resolve-context.ts line 364):
   ```typescript
   // BEFORE (30+ columns):
   .select('brand_profile_v5, brand_essence, tone_of_voice, tone_model, ...')
   
   // AFTER (V5 + operational only):
   .select('brand_profile_v5, booking_link, content_strategy, location_intelligence, venue_data_source')
   ```

2. **Remove fallback chains** (resolve-context.ts lines 370-580):
   - Replace ~200 lines of `if v5 → else if legacy → else default` with direct V5 reads
   - Add error handling for missing V5 profiles

3. **Update other consumers**:
   - get-quick-suggestions/index.ts
   - ai-enhance/index.ts
   - adjust-text/index.ts

**Risk**: Breaking change for businesses without V5 profiles

**Mitigation**: Pre-migrate all active businesses before deploying Phase 2

---

## Code Diff Summary

**Files Modified**: 2
**Lines Added**: ~35
**Lines Removed**: 0 (Phase 2 will remove ~200 lines)

**Type Changes**:
- V5Identity: +6 optional fields
- V5Voice: +1 optional field (humor_level)

**Generator Changes**:
- SELECT: +8 columns
- Identity population: +7 field assignments
- Voice migration: +3 lines

**No breaking changes in Phase 1** - fully backward compatible.

---

**Ready for Phase 2?** Once testing confirms data migration works correctly.
