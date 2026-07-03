# 🎯 Quota System Architecture

## Current State (After Refactoring)

### Source of Truth: `src/config/quotas.ts`

This is the **ONLY** place where quota limits should be defined.

```typescript
export const TIER_QUOTAS: Record<UserTier, TierQuotas> = {
  free: {
    aiGenerations: { daily: 10, monthly: 100 },
    pdfUploads: { daily: 2, monthly: 10 },
    websiteAnalysis: { daily: 1, monthly: 5 },
    // ... other quotas
  },
  standardplus: { /* ... */ },
  premium: { /* ... */ }
}
```

**✅ To change a quota:** Edit this file only, changes apply everywhere.

---

## Legacy Code (Being Phased Out)

### `src/stores/tierStore.ts` - Lines 73-111

**Status:** ❌ Duplicate definitions, kept for backward compatibility

**Contains:**
```typescript
const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    aiIdeasPerDay: 10,  // DUPLICATE of quotas.ts
    captionGenerationsPerDay: 10,  // DUPLICATE
    // ...
  }
}
```

**Why it exists:**
- Old components still reference `getTierLimits()` method
- Legacy quota checking functions use this

**Migration plan:**
1. ✅ All new code uses `config/quotas.ts`
2. 🔄 Update old components to use centralized config
3. ❌ Remove `TIER_LIMITS` from tierStore.ts

---

## How Quotas Work Now

### Frontend (React)

#### Option 1: Use Centralized Config (RECOMMENDED)
```typescript
import { TIER_QUOTAS, checkQuota } from '@/config/quotas'
import { useTierStore } from '@/stores/tierStore'

const MyComponent = () => {
  const currentTier = useTierStore(state => state.currentTier)
  const dailyLimit = TIER_QUOTAS[currentTier].aiGenerations.daily
  
  // Check if user can use feature
  const canGenerate = checkQuota({
    tier: currentTier,
    quotaType: 'aiGenerations',
    period: 'daily',
    currentUsage: 5
  })
}
```

#### Option 2: Legacy Method (BEING DEPRECATED)
```typescript
import { useTierStore } from '@/stores/tierStore'

const MyComponent = () => {
  const getTierLimits = useTierStore(state => state.getTierLimits)
  const currentTier = useTierStore(state => state.currentTier)
  const limits = getTierLimits(currentTier)
  
  // Old way - works but not recommended
  const dailyLimit = limits.aiIdeasPerDay
}
```

### Backend (Edge Functions)

#### `supabase/functions/_shared/quota-utils.ts`

**Status:** ⚠️ Currently duplicates quota logic

**Contains:**
```typescript
const TIER_QUOTAS_BACKEND = {
  free: {
    aiGenerations: { daily: 10, monthly: 100 }
  }
  // ... duplicates frontend config
}
```

**Issue:** If you change quotas in `config/quotas.ts`, you must also update this file.

**Better approach:** Generate backend types from frontend config, or fetch from database.

---

## Quota Checking Flow

### 1. Frontend Check (Soft Limit)
```
User clicks "Generate AI Post"
  ↓
Frontend checks: useTierStore.canUseFeature('aiGenerations')
  ↓
If limit reached: Show upgrade prompt
  ↓
If OK: Call Edge Function
```

### 2. Backend Check (Hard Limit)
```
Edge Function receives request
  ↓
quota-utils.ts checks database usage
  ↓
If limit reached: Return 429 error
  ↓
If OK: Process request & increment counter
```

### 3. Database Tracking
```
businesses table columns:
- ai_generations_today
- ai_generations_this_month
- pdf_uploads_today
- pdf_uploads_this_month
- website_analysis_today
- website_analysis_this_month
- last_daily_reset
- last_monthly_reset
```

**Reset logic:**
- Daily counters reset at midnight (UTC)
- Monthly counters reset on 1st of month
- Handled by database functions

---

## Migration Plan: Consolidate Quotas

### Phase 1: Deprecate tierStore TIER_LIMITS (Next Sprint)

**Files to update:**
1. Find all usages of `getTierLimits()`:
   ```bash
   grep -r "getTierLimits" src/
   ```

2. Replace with `TIER_QUOTAS` import:
   ```typescript
   // OLD
   const limits = getTierLimits(currentTier)
   const limit = limits.aiIdeasPerDay
   
   // NEW
   import { TIER_QUOTAS } from '@/config/quotas'
   const limit = TIER_QUOTAS[currentTier].aiGenerations.daily
   ```

3. Remove `getTierLimits` method from tierStore.ts

4. Remove `TIER_LIMITS` constant from tierStore.ts

### Phase 2: Sync Backend Quotas (Future)

**Option A: Generate from TypeScript**
```bash
# Build script that exports quotas to JSON
npm run generate:quotas
# Creates: supabase/functions/_shared/quotas.json
```

**Option B: Store in Database**
```sql
CREATE TABLE tier_quotas (
  tier TEXT PRIMARY KEY,
  config JSONB NOT NULL
);
```

**Option C: Use Database Functions**
```sql
-- Functions like get_tier_limit('free', 'ai_generations_daily')
```

---

## Current Quota Definitions

### Free Tier
```typescript
{
  aiGenerations: { daily: 10, monthly: 100 },
  postsPerDay: 5,
  postsPerMonth: 50,
  scheduledPosts: 10,
  socialChannels: 2,
  teamMembers: 1,
  storageGB: 1,
  pdfUploads: { daily: 2, monthly: 10, maxSizeMB: 10 },
  websiteAnalysis: { daily: 1, monthly: 5 },
  photoUploadsPerPost: 5,
  photoAnalysisLevel: 'basic'
}
```

### Smart Tier (standardplus)
```typescript
{
  aiGenerations: { daily: -1, monthly: -1 }, // -1 = unlimited
  postsPerDay: 20,
  postsPerMonth: 500,
  scheduledPosts: 100,
  socialChannels: 5,
  teamMembers: 3,
  storageGB: 10,
  pdfUploads: { daily: 10, monthly: 100, maxSizeMB: 50 },
  websiteAnalysis: { daily: 5, monthly: 50 },
  photoUploadsPerPost: 20,
  photoAnalysisLevel: 'advanced'
}
```

### Pro Tier (premium)
```typescript
{
  aiGenerations: { daily: -1, monthly: -1 }, // unlimited
  postsPerDay: -1, // unlimited
  postsPerMonth: -1, // unlimited
  scheduledPosts: -1, // unlimited
  socialChannels: 10,
  teamMembers: 10,
  storageGB: 100,
  pdfUploads: { daily: -1, monthly: -1, maxSizeMB: 100 },
  websiteAnalysis: { daily: -1, monthly: -1 },
  photoUploadsPerPost: -1, // unlimited
  photoAnalysisLevel: 'premium'
}
```

**Note:** `-1` means unlimited

---

## How to Change a Quota

### Example: Increase Free Tier AI Generations

**Step 1:** Edit `src/config/quotas.ts`
```typescript
free: {
  aiGenerations: { 
    daily: 15,   // Changed from 10
    monthly: 150 // Changed from 100
  }
}
```

**Step 2:** If backend checks quotas, update `supabase/functions/_shared/quota-utils.ts`
```typescript
// Update matching value in backend
```

**Step 3:** Test
```bash
# Clear localStorage to reset cached quotas
localStorage.clear()

# Test AI generation feature
# Should allow 15 generations per day
```

---

## Testing Quotas

### Test in Development
```typescript
// Temporarily override quota for testing
localStorage.setItem('dev:override:aiGenerations', '100')
```

### Check Current Usage
```sql
-- Check user's current usage
SELECT 
  ai_generations_today,
  ai_generations_this_month,
  pdf_uploads_today,
  website_analysis_today,
  last_daily_reset
FROM businesses
WHERE owner_id = 'USER_ID';
```

### Reset Usage (Dev Only)
```sql
-- Reset a specific user's quotas
UPDATE businesses
SET 
  ai_generations_today = 0,
  ai_generations_this_month = 0,
  pdf_uploads_today = 0,
  pdf_uploads_this_month = 0,
  website_analysis_today = 0,
  website_analysis_this_month = 0,
  last_daily_reset = CURRENT_DATE,
  last_monthly_reset = DATE_TRUNC('month', CURRENT_DATE)
WHERE owner_id = 'USER_ID';
```

---

## Common Issues

### Issue: Quota check passes in frontend but fails in backend
**Cause:** Frontend and backend have different limits
**Fix:** Ensure `quota-utils.ts` matches `quotas.ts`

### Issue: User shows as over limit after reset
**Cause:** Reset function didn't run
**Fix:** Check `last_daily_reset` column in database

### Issue: Unlimited tier shows "limit reached"
**Cause:** Frontend interprets `-1` as negative number
**Fix:** Check if value is `-1` before comparing:
```typescript
if (limit === -1 || currentUsage < limit) {
  // Allow action
}
```

---

## Future Improvements

1. **Real-time Quota Sync**
   - Subscribe to database changes
   - Update UI immediately when quota used

2. **Quota Analytics**
   - Track which features hit limits most
   - Help users understand their usage

3. **Soft vs Hard Limits**
   - Soft limit: Warn at 80% usage
   - Hard limit: Block at 100%

4. **Quota Rollover**
   - Allow unused monthly quotas to roll over

---

Last Updated: December 21, 2025
