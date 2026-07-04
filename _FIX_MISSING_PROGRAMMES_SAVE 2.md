# Fix: Missing Programmes Save in V5 Brand Profile Generation

## Problem
The V5 brand profile generator (`brand-profile-generator/index.ts`) creates 3 programmes (brunch, lunch, dinner, etc.) during generation but **never saves them** to the `business_programme_profiles` table.

## Evidence
1. **Logs show**: "V5 generation completed with 3 programmes"
2. **UI shows**: Nothing (no programmes)
3. **Database query**: `SELECT COUNT(*) FROM business_programme_profiles WHERE business_id = '...'` returns 0

## Root Cause
In `/supabase/functions/brand-profile-generator/index.ts`:

- **Line 2240**: Code READS from `business_programme_profiles`
- **Missing**: Code that WRITES/INSERTS programmes after generation
- **Line 2000-2100**: `saveBrandProfile()` is called but it only saves the brand_profile table, not programmes

## Solution Required

Add programme save logic after the brand profile is generated. The programmes should be created in memory during generation (likely in Stage PS or a dedicated stage), then saved with:

```typescript
// After saveBrandProfile() succeeds, save programmes separately
if (generatedProgrammes && generatedProgrammes.length > 0) {
  console.log(`[${requestId}] 💾 Saving ${generatedProgrammes.length} programmes...`)
  
  for (const prog of generatedProgrammes) {
    const { error: progError } = await supabaseClient
      .from('business_programme_profiles')
      .upsert({
        business_id: businessId,
        programme_type: prog.programme_type,
        programme_name: prog.programme_name,
        time_windows: prog.time_windows,
        confidence: prog.confidence,
        baseline_goal_split: prog.baseline_goal_split,
        audience_segments: prog.audience_segments,
        operating_days: prog.operating_days,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'business_id,programme_type'
      })
    
    if (progError) {
      console.error(`[${requestId}] ❌ Failed to save programme ${prog.programme_type}:`, progError)
    } else {
      console.log(`[${requestId}] ✅ Saved programme: ${prog.programme_type}`)
    }
  }
}
```

## Where to Add
1. Find where programmes are generated (search for "Stage P" or where programme data structures are created)
2. After `saveBrandProfile()` succeeds (~line 2070)
3. Before the final response is returned

## Verification
After implementing:
```sql
-- This should return 3 (or more)
SELECT COUNT(*) as programme_count
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- This should show the actual programmes
SELECT programme_type, programme_name, confidence
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
ORDER BY programme_type;
```

## Impact
**HIGH** - This is why the brand page shows no programmes even though V5 generation completes successfully. Every business that ran V5 generation has missing programmes.
