# Revenue Driver Analyzer — Implementation Guide

**Created**: 2026-06-07  
**Status**: Step 1 of 3-phase implementation  
**Purpose**: AI-powered extraction of revenue moments from business descriptions

---

## What This Does

Analyzes business `business_about` text and automatically extracts:
- **Primary revenue moment** (e.g., "weekend dinner", "morning bakery rush")
- **Secondary revenue moments** (e.g., "weekday lunch", "late-night bar")
- **Decision windows** (when customers decide to visit)
- **Posting strategies** (when to post to capture decisions)
- **Normal week strategy** (preferred days, minimum coverage)

**Handles hybrids**: Coffee & wine bars, bakery cafes, brunch+dinner restaurants automatically detected as multiple revenue moments.

---

## Implementation Steps

### 1. Apply Database Migration

```bash
# Via Supabase Dashboard SQL Editor:
# Copy contents of: supabase/migrations/20260607000002_add_revenue_drivers.sql
# Paste and run in: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
```

Expected output:
```
✅ revenue_drivers column exists
✅ GIN index created successfully
```

---

### 2. Deploy Edge Function

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Deploy function
supabase functions deploy analyze-revenue-drivers
```

Expected output:
```
Deploying analyze-revenue-drivers (script size: ~15kB)
✅ Deployed successfully
```

---

### 3. Test with Cafe Faust

#### Option A: Via HTTP Request (curl)

```bash
# Get auth token first (from Supabase Dashboard or login)
export AUTH_TOKEN="your_supabase_auth_token"

curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/analyze-revenue-drivers \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"business_id": "f4679fa9-3120-4a59-9506-d059b010c34a"}'
```

#### Option B: Via SQL Test File

```bash
# Run test queries
psql <your_connection_string> -f _test_revenue_drivers_cafe_faust.sql
```

Or via Supabase Dashboard SQL Editor:
1. Copy contents of `_test_revenue_drivers_cafe_faust.sql`
2. Paste in SQL editor
3. Run all queries
4. Check validation results (should show "PASS" with confidence >70)

---

## Expected Output (Cafe Faust Example)

### Primary Revenue Moment
```json
{
  "moment_id": "weekend_dinner_cocktails",
  "label": "Weekend aftensmad og cocktails",
  "importance": "primary",
  "service_type": "dinner_and_bar",
  "days": ["Friday", "Saturday"],
  "time_range": "17:30-02:00",
  "decision_pattern": "same_day_afternoon",
  "decision_windows": [
    {
      "description": "Thursday-Friday afternoon planning for weekend dining",
      "days": ["Thursday", "Friday"],
      "hours": "14:00-18:00",
      "conversion_strength": "high"
    }
  ],
  "post_timing_rules": [
    {
      "timing": "Thursday 14:00",
      "purpose": "Prime weekend dinner intent for Fri-Sat",
      "priority": "required"
    },
    {
      "timing": "Friday 14:00",
      "purpose": "Drive Saturday bookings + Friday same-day",
      "priority": "required"
    }
  ]
}
```

### Secondary Moments
```json
[
  {
    "moment_id": "weekday_lunch",
    "label": "Frokost i hverdagene",
    "importance": "secondary",
    "service_type": "lunch",
    "decision_pattern": "same_day_morning"
  },
  {
    "moment_id": "weekend_brunch",
    "label": "Weekend brunch ved åen",
    "importance": "secondary",
    "service_type": "brunch",
    "decision_pattern": "same_day_morning"
  }
]
```

### Normal Week Strategy
```json
{
  "minimum_coverage": {
    "weekend_driver_posts": 2,
    "weekday_presence_posts": 1,
    "brand_builder_posts": 1
  },
  "preferred_days": ["Monday", "Wednesday", "Thursday", "Saturday"],
  "rationale": "Monday brand-builder, Wednesday weekday lunch, Thursday weekend dinner driver, Saturday brunch + evening reminder"
}
```

---

## Usage in Production

### Automatic Analysis on Profile Update

Add trigger to frontend when business_about is updated:

```typescript
// After user saves business profile
const { data, error } = await supabase.functions.invoke('analyze-revenue-drivers', {
  body: { business_id: currentBusiness.id }
})

if (data.success) {
  console.log('Revenue drivers analyzed:', data.revenue_drivers)
  // Show success message to user
}
```

### Manual Refresh

```typescript
// Force re-analysis (ignores cached revenue_drivers)
const { data, error } = await supabase.functions.invoke('analyze-revenue-drivers', {
  body: { 
    business_id: currentBusiness.id,
    force_refresh: true 
  }
})
```

### Check Existing Analysis

```sql
-- Check if business already has revenue_drivers
SELECT 
  business_id,
  revenue_drivers IS NOT NULL AS has_analysis,
  revenue_drivers ->> 'analyzed_at' AS analyzed_at,
  revenue_drivers ->> 'confidence_score' AS confidence
FROM business_brand_profile
WHERE business_id = 'your-business-id';
```

---

## Confidence Score Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| **90-100** | High confidence | Use as-is, very accurate |
| **70-89** | Good confidence | Use as-is, likely accurate |
| **50-69** | Medium confidence | Review and possibly edit |
| **<50** | Low confidence | Manual input recommended |

Low confidence triggers when:
- Business description is too short (<50 chars)
- Description is vague (no specific services or hours mentioned)
- Conflicting information detected

---

## User Override Capability

Users can edit AI-generated revenue_drivers via UI:

```typescript
// Update revenue_drivers after user edits
const { error } = await supabase
  .from('business_brand_profile')
  .update({ 
    revenue_drivers: {
      ...existingDrivers,
      // User's manual edits
      primary_revenue_moment: editedPrimaryMoment,
      // Preserve AI metadata
      analyzed_at: existingDrivers.analyzed_at,
      confidence_score: existingDrivers.confidence_score,
      edited_by_user: true,
      edited_at: new Date().toISOString()
    }
  })
  .eq('business_id', businessId)
```

---

## Validation Queries

### Check All Businesses with Revenue Drivers

```sql
SELECT 
  business_id,
  revenue_drivers ->> 'confidence_score' AS confidence,
  revenue_drivers -> 'primary_revenue_moment' ->> 'moment_id' AS primary_moment,
  jsonb_array_length(revenue_drivers -> 'secondary_revenue_moments') AS secondary_count,
  revenue_drivers ->> 'analyzed_at' AS analyzed_at
FROM business_brand_profile
WHERE revenue_drivers IS NOT NULL
ORDER BY (revenue_drivers ->> 'confidence_score')::int DESC;
```

### Find Low-Confidence Analyses

```sql
SELECT 
  business_id,
  business_about,
  revenue_drivers ->> 'confidence_score' AS confidence
FROM business_brand_profile
WHERE revenue_drivers IS NOT NULL
  AND (revenue_drivers ->> 'confidence_score')::int < 70
ORDER BY (revenue_drivers ->> 'confidence_score')::int ASC;
```

### Find Businesses Missing Analysis

```sql
SELECT 
  business_id,
  business_about,
  LENGTH(business_about) AS description_length
FROM business_brand_profile
WHERE revenue_drivers IS NULL
  AND business_about IS NOT NULL
ORDER BY LENGTH(business_about) DESC;
```

---

## Next Steps

### Step 2: Build Business Rules Engine
- New layer between Phase 1 AI and Phase 2a
- Maps revenue moments → day allocation plan
- File: `supabase/functions/_shared/post-helpers/business-rules-engine.ts`

### Step 3: Refactor Phase 2a
- Remove BASE_SLOTS template
- Execute DayAllocationPlan from Business Rules Engine
- File: `supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts`

---

## Troubleshooting

### Error: "Business description too short"
**Solution**: Update business_about to at least 50 characters with specific service details.

### Error: "AI returned invalid JSON"
**Issue**: Gemini occasionally returns malformed JSON.  
**Solution**: Retry the request (function has retry logic built-in).

### Low confidence score (<50)
**Issue**: Description is too vague.  
**Solution**: Add more details: service hours, specific offerings, days open, etc.

### Missing secondary moments for hybrid
**Issue**: AI didn't detect multiple revenue streams.  
**Solution**: Make hybrid nature explicit in description:
- ✅ "Coffee shop with evening wine bar (open until 22:00)"
- ❌ "Cozy cafe" (too vague)

---

## API Reference

### POST /analyze-revenue-drivers

**Request Body**:
```json
{
  "business_id": "uuid",
  "force_refresh": false  // Optional, default false
}
```

**Response** (success):
```json
{
  "success": true,
  "revenue_drivers": { /* RevenueDrivers object */ },
  "cached": false  // true if using existing analysis
}
```

**Response** (error):
```json
{
  "success": false,
  "error": "Error message",
  "suggestion": "Optional suggestion for user"  // If applicable
}
```

**Status Codes**:
- `200`: Success
- `400`: Bad request (missing business_id or description too short)
- `401`: Unauthorized
- `404`: Business profile not found
- `500`: Server error (AI failure, database error)

---

## Design Documents

Full design and architecture:
- **Gap Analysis**: `/WEEKLY_PLAN_DAY_ALLOCATION_GAP_ANALYSIS.md`
- **Revenue Schema**: `/REVENUE_SCHEMA_DESIGN.md`
- **Memory**: `/memories/repo/weekly-plan-day-allocation.md`
