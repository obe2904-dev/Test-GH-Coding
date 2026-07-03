# Feasibility Validation Testing Guide

## Overview

The new feasibility validation system runs **between Layer 0 and Layer 6** to catch impossible suggestions before wasting processing time.

## What Gets Validated

### 1. Platform Validation ✅
- ❌ **BLOCKS**: All platforms disconnected
- ⚠️ **WARNS**: Some platforms disconnected

### 2. Format/Media Validation ✅
- ❌ **BLOCKS**: Format not supported (e.g., video on free tier)
- ⚠️ **WARNS**: Format possible but equipment missing

### 3. Capacity Validation ✅
- ❌ **BLOCKS**: Exceeds tier limits (e.g., 5 posts requested on free tier with 3-post limit)
- ⚠️ **WARNS**: Approaching limits (80%+ capacity)

### 4. Consistency Validation ✅
- ⚠️ **WARNS**: All posts same format (lack of variety)
- ⚠️ **WARNS**: Quality concerns (missing photographer, equipment)

---

## Test Scenarios

### Test 1: Blocking Error - Platform Disconnected

**Setup:**
```sql
-- Disconnect all platforms
UPDATE business_social_accounts 
SET is_active = false 
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';
```

**Expected Result:**
```json
{
  "error": "Strategy not feasible for this business",
  "validation": {
    "feasible": false,
    "errors": [
      {
        "severity": "blocking",
        "category": "platform",
        "message": "Idea has NO connected platforms",
        "suggestedFix": "Connect at least one platform before generating posts"
      }
    ]
  }
}
```

**Status Code:** `400 Bad Request`

---

### Test 2: Blocking Error - Exceeds Post Limit

**Setup:**
```sql
-- Set subscription to free tier (3 posts max)
UPDATE subscriptions 
SET tier = 'free' 
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Then select 5+ ideas from Layer 0 strategy
```

**API Call:**
```bash
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "840347de-9ba7-4275-8aa3-4553417fc2af",
    "strategy_id": "uuid-here",
    "selected_idea_ids": [1, 2, 3, 4, 5],
    "weekStart": "2026-02-17"
  }'
```

**Expected Result:**
```json
{
  "error": "Strategy not feasible for this business",
  "validation": {
    "feasible": false,
    "errors": [
      {
        "severity": "blocking",
        "category": "capacity",
        "message": "Strategy exceeds post limit: 5 posts requested, only 3 allowed on free tier",
        "suggestedFix": "Reduce selection to 3 ideas or upgrade subscription"
      }
    ]
  }
}
```

**Status Code:** `400 Bad Request`

---

### Test 3: Warning - Missing Equipment

**Setup:**
```sql
-- Update business profile to lack video equipment
UPDATE business_profile 
SET has_video_equipment = false, has_photographer = false
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Generate strategy that suggests video/reel format
```

**Expected Result:**
```json
{
  "success": true,
  "plan": { ...posts... }
}
```

**Logs (Backend):**
```
[FeasibilityCheck] ⚠️  Warnings detected:
  - [HIGH] reel format suggested but no video equipment on file
  - [MEDIUM] reel format suggested but no photographer assigned
[FeasibilityCheck] ✅ Validation passed, proceeding to Layer 6
```

**Status Code:** `200 OK` (continues with warnings)

---

### Test 4: Success - All Validated

**Setup:**
```sql
-- Connect platforms
UPDATE business_social_accounts 
SET is_active = true 
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af' 
AND platform_name IN ('facebook', 'instagram');

-- Set pro tier (14 posts max)
UPDATE subscriptions 
SET tier = 'pro' 
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Select 3 photo/carousel ideas (safe formats)
```

**Expected Result:**
```json
{
  "success": true,
  "plan": {
    "posts": [ ...3 posts... ],
    "summary": { "totalPosts": 3 }
  }
}
```

**Logs:**
```
[FeasibilityCheck] Running validation for PATH A (strategy-driven)
[FeasibilityCheck] Capabilities: { platforms: ['facebook', 'instagram'], tier: 'pro', maxPosts: 14 }
[FeasibilityCheck] Validation complete: { feasible: true, criticalErrors: 0, warnings: 0 }
[FeasibilityCheck] ✅ Validation passed, proceeding to Layer 6
```

**Status Code:** `200 OK`

---

## Quick Test Commands

### Full Integration Test (Production)

```bash
# 1. Generate Layer 0 strategy
STRATEGY_RESPONSE=$(curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "840347de-9ba7-4275-8aa3-4553417fc2af",
    "week_start": "2026-02-17",
    "regenerate": true
  }')

STRATEGY_ID=$(echo $STRATEGY_RESPONSE | jq -r '.strategy_id')
echo "Strategy ID: $STRATEGY_ID"

# 2. Select 3 ideas and generate posts (should pass validation)
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"business_id\": \"840347de-9ba7-4275-8aa3-4553417fc2af\",
    \"strategy_id\": \"$STRATEGY_ID\",
    \"selected_idea_ids\": [1, 2, 3],
    \"weekStart\": \"2026-02-17\"
  }" | jq '.success'
```

**Expected:** `true` (or validation errors with specific messages)

---

## Error Message Examples

### Platform Error
```
Cannot post to instagram - platform not connected
→ Fix: Connect instagram account or regenerate strategy with only connected platforms
```

### Format Error
```
Cannot produce reel format - business lacks capability
→ Fix: Upgrade equipment or switch to photo format
```

### Capacity Error
```
Too many reels: 3 suggested, only 2 allowed per week
→ Fix: Reduce reel ideas or upgrade tier for more capacity
```

---

## Integration Points

### 1. In `generate-weekly-plan/index.ts`
```typescript
// After assembling input object, before generateWeeklyPlan():
if (strategy && strategy.post_ideas && strategy.post_ideas.length > 0) {
  const validation = validateStrategyFeasibility(selectedIdeas, capabilities)
  
  if (!validation.feasible) {
    return new Response(JSON.stringify({
      error: 'Strategy not feasible',
      validation: { ...validation }
    }), { status: 400 })
  }
}

const plan = await generateWeeklyPlan(input, supabaseClient)
```

### 2. Frontend Integration (Future)

```typescript
// In WeeklyStrategyPage.tsx - before triggering PATH A
const validateBeforeGeneration = async () => {
  const response = await fetch('/functions/v1/validate-strategy', {
    method: 'POST',
    body: JSON.stringify({ strategy_id, selected_idea_ids })
  })
  
  const { validation } = await response.json()
  
  if (!validation.feasible) {
    // Show errors to user BEFORE generation
    setErrors(validation.errors)
    return false
  }
  
  return true
}
```

---

## Benefits

✅ **Prevents wasted AI calls** - Catches issues before Layer 8 caption generation  
✅ **Clear error messages** - Users know exactly what's wrong and how to fix it  
✅ **Respects business constraints** - Won't suggest impossible formats/platforms  
✅ **Tier enforcement** - Validates post limits before generation  
✅ **Quality warnings** - Alerts to equipment/staff limitations without blocking  

---

## Next Steps

1. **Test in production** with real business data
2. **Add frontend validation** before clicking "Lav X opslag"
3. **Create admin override** for testing (bypass validation)
4. **Add metrics** to track validation failures
5. **Extend validation** to check business hours, banned words, etc.
