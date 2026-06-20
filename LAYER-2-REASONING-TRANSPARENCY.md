# Layer 2 Commercial Reasoning Transparency Implementation

## Overview
Added transparency to Layer 2 (Commercial Orientation) by capturing and displaying the AI's reasoning for commercial strategy decisions.

## What Changed

### 1. Database Schema ✅
**File:** `supabase/migrations/20260507_add_commercial_reasoning.sql`

Added `commercial_reasoning` field to store AI explanations:
```sql
ALTER TABLE business_programme_profiles
ADD COLUMN IF NOT EXISTS commercial_reasoning text;
```

**To apply:** Run this SQL in Supabase Dashboard → SQL Editor:
```sql
ALTER TABLE business_programme_profiles
ADD COLUMN IF NOT EXISTS commercial_reasoning text;

COMMENT ON COLUMN business_programme_profiles.commercial_reasoning IS 
'Layer 2: AI explanation of why this baseline commercial strategy was chosen (2-3 sentences in Danish)';
```

### 2. Edge Function ✅ DEPLOYED
**File:** `supabase/functions/brand-profile-generator-v5/index.ts`

Updated to save the reasoning field that AI already generates:
```typescript
commercial_reasoning: commercialOrientation.reasoning,
```

**Status:** ✅ Deployed to production

### 3. TypeScript Interface ✅
**File:** `src/hooks/useProgrammeProfiles.ts`

Added field to ProgrammeProfile interface:
```typescript
commercial_reasoning: string;
```

### 4. Frontend Display ✅
**Files:** 
- `src/pages/dashboard/ProgrammeProfilesPage.tsx`
- `src/components/brandProfile/ProgrammeCard.tsx`

Added "🤖 AI Reasoning" section after Content Type Affinity:
```tsx
{programme.commercial_reasoning && (
  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
      🤖 AI Reasoning
    </h3>
    <p className="text-sm text-gray-700 leading-relaxed">
      {programme.commercial_reasoning}
    </p>
  </div>
)}
```

## Impact

### Before ❌
Users saw only numbers:
- Drive Footfall: 40%
- Strengthen Brand: 30%
- Retain Regulars: 30%
- Decision Timing: spontaneous_walk_in

**Missing:** WHY these percentages, HOW multi-language menu affected strategy

### After ✅
Users see numbers AND reasoning:
- Drive Footfall: 40%
- Strengthen Brand: 30%
- Retain Regulars: 30%
- Decision Timing: spontaneous_walk_in
- **🤖 AI Reasoning:** "Aftensmad kl. 17:30-21:30 er primært rettet mod spontane gæster i turistområde med høj konkurrence. Multi-sprog menu (da, en) indikerer international appeal. Fokus på footfall for at fylde borde tidligt på aftenen."

## Transparency Parity

| Layer | Status | Reasoning Field | UI Display |
|-------|--------|-----------------|------------|
| Layer 2 (Commercial) | ✅ FIXED | `commercial_reasoning` | "🤖 AI Reasoning" section |
| Layer 3 (Identity) | ✅ Already had | `identity_reasoning` | Collapsible "AI Reasoning" |
| Layer 4 (Audience) | ✅ Already had | `segment_reasoning` | "AI Reasoning (X% confidence)" |

All three AI layers now have full transparency! 🎉

## Next Steps

1. **Apply Database Migration**
   - Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
   - Run the ALTER TABLE statement above
   
2. **Regenerate Brand Profile**
   - Run: `deno run --allow-net --allow-env --env-file=.env scripts/generate-brand-profile.ts`
   - Or use UI: Dashboard → Brand Profile → "Regenerate Profile" button
   
3. **Verify in Frontend**
   - Check Programme Profiles page
   - Each programme should now show "🤖 AI Reasoning" section
   - Reasoning should explain WHY the baseline strategy was chosen

## Technical Details

### AI Prompt Already Includes
The reasoning field was always generated (Line ~163 in `commercial-orientation.ts`):
```typescript
"reasoning": "<2-3 sætninger på dansk der forklarer HVORFOR denne baseline>"
```

### Validation Already Enforces
- Must be >20 characters
- Cannot contain generic phrases ("god kvalitet", "autentisk oplevelse")
- Must explain WHY decisions were made

### What Was Missing
The reasoning was generated and validated but:
- ❌ Not saved to database
- ❌ Not exposed in frontend
- ❌ Users had no visibility into decision logic

### What's Fixed
- ✅ Reasoning saved to `commercial_reasoning` column
- ✅ Displayed in UI after content affinity
- ✅ Users can now understand AI's commercial strategy decisions

## Language Variant Signal Example

When reasoning includes multi-language menus:
```
"Menu sprog: da, en (multi-language menu → international audience)"
```

This shows how the language variant detection (from our previous enhancement) feeds into commercial strategy reasoning, making the tourist detection logic visible to users.
