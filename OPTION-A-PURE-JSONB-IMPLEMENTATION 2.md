# Option A Pure JSONB - Implementation Files Created

**Status:** Phase 1-4 Implementation Files Complete  
**Created:** May 9, 2026  
**Timeline:** 3-Week Aggressive Migration

---

## ✅ What's Been Created (You Said "Go")

### Phase 1: Database Schema ✅
**File:** `supabase/migrations/20260509_add_brand_profile_v5_jsonb.sql`

- Adds `brand_profile_v5` JSONB column to `business_brand_profile`
- Creates indexes for performance (`version`, `generated_at`)
- Adds validation constraint (`check_v5_has_version`)
- Creates monitoring view (`v5_profile_summary`)
- Comprehensive COMMENT documenting complete JSONB structure

**Action Required:** Execute this SQL in Supabase Dashboard

---

### Phase 2: V5 Generator Update ✅
**Files Created:**

1. **Type Definitions:** `supabase/functions/_shared/brand-profile/types-v5.ts`
   - Complete V5 type system
   - Interfaces for all 5 layers
   - Generation input/output types
   - 200+ lines of TypeScript interfaces

2. **Layer 5a Generator:** `supabase/functions/_shared/brand-profile/voice-profile.ts`
   - Generates structured voice guidelines
   - Parses legacy tone_of_voice if exists
   - AI-generates from identity if missing
   - Fallback logic for resilience

3. **Layer 5b Generator:** `supabase/functions/_shared/brand-profile/writing-examples.ts`
   - Copies typical_openings/closings from legacy (100% populated for Café Faust!)
   - AI-generates missing examples
   - Extracts signature phrases from business context

4. **Layer 5c Generator:** `supabase/functions/_shared/brand-profile/guardrails.ts`
   - Copies never_say from legacy
   - Parses things_to_avoid into structured format
   - AI-generates brand-specific rules
   - Adds standard factual constraints

5. **Implementation Guide:** `PHASE2-V5-GENERATOR-UPDATE-GUIDE.md`
   - Step-by-step code changes for `brand-profile-generator-v5/index.ts`
   - Before/after code examples
   - Testing instructions
   - Rollback plan

**Action Required:** Update `brand-profile-generator-v5/index.ts` using guide

---

### Phase 3: Backfill Script ✅
**File:** `scripts/backfill-v5-profiles.ts`

- Migrates existing businesses to V5 JSONB format
- Reads from legacy columns + business_programme_profiles
- AI-generates missing pieces
- Assembles complete V5 structure
- Saves to brand_profile_v5 column

**Usage:**
```bash
deno run --allow-net --allow-env scripts/backfill-v5-profiles.ts
```

**Action Required:** Run after Phase 2 deployed

---

### Phase 4: V5 Profile Reader ✅
**File:** `supabase/functions/_shared/v5-profile-reader.ts`

**Core Functions:**
- `getV5Profile()` - Get complete profile
- `getV5Programmes()` - Layer 1-2-4
- `getV5Identity()` - Layer 3
- `getV5Voice()` - Layer 5a
- `getV5WritingExamples()` - Layer 5b
- `getV5Guardrails()` - Layer 5c

**Convenience Helpers:**
- `getV5ToneRules()` - Most common voice query
- `getV5TypicalOpenings()` - For content generation
- `getV5NeverSay()` - For content validation
- `getV5BrandEssence()` - Most common identity query

**Formatting Helpers:**
- `getV5VoiceForPrompt()` - Formatted for AI prompts
- `getV5GuardrailsForPrompt()` - Formatted for AI prompts
- `formatToneRulesAsText()` - Bullet list formatting

**Action Required:** Use this service for ALL future profile reads (Phase 5-6)

---

## 📋 Execution Sequence

### Week 1: Schema + Generator + Backfill

1. **Execute Phase 0 Migration (if not done)** ⏳
   ```sql
   -- Open Supabase Dashboard → SQL Editor
   -- Run: MANUAL-MIGRATION-PHASE0.sql
   -- Drops do_not_say, adds V5 metadata columns
   ```

2. **Execute Phase 1 Migration** ⏳
   ```sql
   -- Open Supabase Dashboard → SQL Editor
   -- Run: supabase/migrations/20260509_add_brand_profile_v5_jsonb.sql
   -- Adds brand_profile_v5 JSONB column
   ```

3. **Verify Database Schema** ⏳
   ```sql
   -- Check v5_profile_summary view
   SELECT * FROM v5_profile_summary;
   
   -- Expected: Café Faust shows "Not Generated"
   ```

4. **Update V5 Generator** ⏳
   - Follow `PHASE2-V5-GENERATOR-UPDATE-GUIDE.md`
   - Add Layer 5 generation (voice, examples, guardrails)
   - Change save logic to write to brand_profile_v5 JSONB
   - Deploy: `supabase functions deploy brand-profile-generator-v5`

5. **Test V5 Generator** ⏳
   ```bash
   # Trigger for Café Faust
   curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5 \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"businessId": "2037d63c-a138-4247-89c5-5b6b8cef9f3f"}'
   ```

6. **Verify Complete V5 Profile** ⏳
   ```sql
   -- Check structure
   SELECT 
     business_name,
     brand_profile_v5->>'version' as version,
     jsonb_array_length(brand_profile_v5->'programmes') as programmes,
     jsonb_array_length(brand_profile_v5->'voice'->'tone_rules') as tone_rules,
     jsonb_array_length(brand_profile_v5->'writing_examples'->'typical_openings') as openings
   FROM business_brand_profile
   WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
   
   -- Expected: version=5.0, programmes=4, tone_rules=5-7, openings=4
   ```

7. **Run Backfill for Other Businesses** ⏳
   ```bash
   deno run --allow-net --allow-env scripts/backfill-v5-profiles.ts
   ```

---

### Week 2: Reader + Consumers + Frontend

8. **Migrate get-weekly-strategy** ⏳
   - Replace column queries with `getV5Voice()`, `getV5Identity()`, etc.
   - Use `getV5VoiceForPrompt()` for prompt injection
   - Test: Generate weekly plan, verify reads from brand_profile_v5

9. **Migrate resolve-context.ts** ⏳
   - Replace column queries with V5 Reader functions
   - Use `getV5GuardrailsForPrompt()` for content validation
   - Test: Generate 5 posts, verify guardrails enforced

10. **Migrate post-helpers** ⏳
    - Update phase2b.ts, phase2c.ts
    - Replace legacy queries with V5 Reader
    - Test: Post generation workflow

11. **Migrate dagens-forslag-prompt-builder.ts** ⏳
    - Replace column queries with V5 Reader
    - Use formatting helpers
    - Test: Daily suggestions generation

12. **Create Frontend V5 Display** ⏳
    - 4-tab interface: Programmes | Identity | Audience | **Voice & Guidelines** ⭐
    - Single query: `SELECT brand_profile_v5 FROM business_brand_profile`
    - Display tone rules, examples, guardrails
    - Test: View all layers in UI

---

### Week 3: Cleanup + Testing

13. **Delete Legacy Columns** ⏳
    ```sql
    -- Drop individual columns (after confirming all consumers migrated)
    ALTER TABLE business_brand_profile
    DROP COLUMN tone_of_voice,
    DROP COLUMN tone_keywords,
    DROP COLUMN tone_model,
    DROP COLUMN typical_openings,
    DROP COLUMN typical_closings,
    DROP COLUMN signature_phrases,
    DROP COLUMN never_say,
    DROP COLUMN things_to_avoid,
    DROP COLUMN voice_constraints,
    DROP COLUMN brand_essence,
    DROP COLUMN positioning,
    DROP COLUMN core_values;
    ```

14. **Delete business_programme_profiles Table** ⏳
    ```sql
    -- All programme data now in brand_profile_v5.programmes[]
    DROP TABLE business_programme_profiles;
    ```

15. **Final Testing** ⏳
    - Generate weekly plan → Verify works ✅
    - Generate 5 posts → Verify guardrails enforced ✅
    - View frontend → All 5 layers display ✅
    - "Regenerate Profile" button → Works ✅

16. **Celebrate** 🎉
    - Clean JSONB architecture ✅
    - Single source of truth ✅
    - 40+ columns → ~6 core columns + 1 JSONB ✅
    - No legacy cruft ✅

---

## 📊 Current Status

| Phase | Files | Status | Action |
|-------|-------|--------|--------|
| 0 | Phase 0 Migration | ✅ Ready | Execute SQL |
| 1 | Database Schema | ✅ Ready | Execute SQL |
| 2 | V5 Generator Update | ✅ Ready | Code + Deploy |
| 3 | Backfill Script | ✅ Ready | Run after Phase 2 |
| 4 | V5 Profile Reader | ✅ Ready | Use in Phase 5-6 |
| 5 | Consumer Migration | ⏳ Pending | Week 2 work |
| 6 | Frontend Integration | ⏳ Pending | Week 2 work |
| 7 | Legacy Deletion | ⏳ Pending | Week 3 work |
| 8 | Testing | ⏳ Pending | Week 3 work |

---

## 🎯 Next Immediate Actions

### Action 1: Execute Phase 0 + 1 Migrations
Open Supabase Dashboard SQL Editor and run:
1. `MANUAL-MIGRATION-PHASE0.sql` (drop do_not_say)
2. `supabase/migrations/20260509_add_brand_profile_v5_jsonb.sql` (add JSONB column)

**Verification:**
```sql
SELECT * FROM v5_profile_summary;
-- Should show Café Faust with "Not Generated" status
```

### Action 2: Update V5 Generator
Follow `PHASE2-V5-GENERATOR-UPDATE-GUIDE.md`:
1. Add imports for voice-profile.ts, writing-examples.ts, guardrails.ts
2. Add Layer 5 generation code after Layer 4
3. Assemble complete V5 JSONB structure
4. Change save logic to use `saveV5Profile()` function
5. Deploy: `supabase functions deploy brand-profile-generator-v5`

### Action 3: Test Complete Flow
```bash
# Trigger V5 generation for Café Faust
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5 \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"businessId": "2037d63c-a138-4247-89c5-5b6b8cef9f3f"}'
```

**Verify in database:**
```sql
SELECT 
  business_name,
  brand_profile_v5->'voice'->'tone_rules' as tone_rules,
  brand_profile_v5->'writing_examples'->'typical_openings' as openings,
  brand_profile_v5->'guardrails'->'never_say' as never_say
FROM business_brand_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

---

## 📚 Files Reference

### Created Implementation Files
```
supabase/migrations/20260509_add_brand_profile_v5_jsonb.sql
supabase/functions/_shared/brand-profile/types-v5.ts
supabase/functions/_shared/brand-profile/voice-profile.ts
supabase/functions/_shared/brand-profile/writing-examples.ts
supabase/functions/_shared/brand-profile/guardrails.ts
supabase/functions/_shared/v5-profile-reader.ts
scripts/backfill-v5-profiles.ts
PHASE2-V5-GENERATOR-UPDATE-GUIDE.md
OPTION-A-PURE-JSONB-IMPLEMENTATION.md (this file)
```

### Files to Update (Week 1-2)
```
supabase/functions/brand-profile-generator-v5/index.ts (Phase 2)
supabase/functions/get-weekly-strategy/index.ts (Week 2)
supabase/functions/generate-text-from-idea/resolve-context.ts (Week 2)
supabase/functions/_shared/dagens-forslag-prompt-builder.ts (Week 2)
supabase/functions/_shared/post-helpers/phase2b.ts (Week 2)
supabase/functions/_shared/post-helpers/phase2c.ts (Week 2)
```

### Frontend Files to Create (Week 2)
```
src/components/BrandProfile/V5ProfileDisplay.tsx
src/components/BrandProfile/VoiceGuidelinesTab.tsx
```

---

## 🚀 Why This Works

1. **Clean Architecture:** Single JSONB column as source of truth
2. **Preserves Existing Data:** Copies from legacy columns (typical_openings 100% populated!)
3. **AI Fills Gaps:** Generates missing pieces (typical_closings, guardrails)
4. **No Breaking Changes:** Old code works until Week 2 migration
5. **Aggressive Timeline:** No backward compatibility needed (only 1 test business)
6. **Monitored Migration:** v5_profile_summary view tracks progress
7. **Rollback Safe:** Each phase can be rolled back independently

---

## 💡 Key Insights

- **typical_openings preserved:** Café Faust has 4 perfect examples already ✅
- **tone_of_voice parsed:** No manual re-entry needed ✅
- **Layer 5 completes V5:** Now have ALL 5 layers (was missing voice/examples/guardrails) ✅
- **Reader service abstracts JSONB:** Consumers don't write JSONB queries ✅
- **Formatting helpers:** Pre-built for AI prompt injection ✅

---

## 🎉 What You Get

After 3 weeks:
- ✅ Complete V5 Brand Profile (Layers 1-5)
- ✅ Single source of truth (brand_profile_v5 JSONB)
- ✅ Clean database (40+ columns → ~6 core + 1 JSONB)
- ✅ Voice guidelines visible in frontend
- ✅ Content generation uses guardrails
- ✅ No legacy cruft or "unused" fields
- ✅ Fast queries (JSONB indexed)
- ✅ Easy to extend (add Layer 6 in future)

**Ready to execute! 🚀**
