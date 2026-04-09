# 409 vs 429 Error Handling Fix

## Problem

Previously, both 409 (Conflict - generation in progress) and 429 (Rate Limited) were potentially handled with retry logic, which was incorrect for 409.

## Solution

Implemented proper branching in [brandProfileService.ts](src/services/brandProfileService.ts) around lines 341-423:

### 409 Conflict - Generation Already in Progress

```typescript
if (maybeResponse.status === 409) {
  console.warn('Generation already in progress (409)')
  
  // Parse response for lock age
  const lockAgeMinutes = json?.lockAgeMinutes || 0
  
  // Different messages based on lock age
  return {
    error: lockAgeMinutes > 5
      ? 'Der genereres allerede en brandprofil, men den tager usædvanlig lang tid...'
      : 'Der genereres allerede en brandprofil — prøv igen om lidt.'
  }
}
```

**Behavior:**
- ❌ **No retry** - exits immediately
- 📝 Shows clear Danish message
- ⚠️ Different message if lock is stale (> 5 min)

### 429 Rate Limited - OpenAI Capacity Issue

```typescript
if (maybeResponse.status === 429) {
  // Wait specified time
  await new Promise(resolve => setTimeout(resolve, retryAfterMs))
  
  // Retry once
  const retryResult = await supabase.functions.invoke(...)
  
  if (retryResult.error) {
    // Check if retry also got 429 specifically
    const retryIs429 = retryResponse && retryResponse.status === 429
    
    if (retryIs429) {
      return { error: 'OpenAI har stadig kapacitetsproblemer...' }
    }
    
    // Different error on retry
    return { error: retryResult.error.message }
  }
}
```

**Behavior:**
- ✅ **Retries once** after delay
- 📝 Shows "Vi er lidt for hurtige lige nu..."
- 🔍 Checks if retry also got 429 specifically
- 📊 Different message for persistent rate limits vs other errors

## Key Changes

1. **409 handling added BEFORE 429** - exits early without retry
2. **Retry failure improved** - checks if retry also got 429 specifically
3. **Better logging** - distinguishes between 429 persistence vs other retry failures

## User Experience

### Scenario 1: User clicks generate while generation is running

```
User clicks → Edge function → 409 Conflict
                    ↓
Client shows: "Der genereres allerede en brandprofil — prøv igen om lidt."
```

**No retry, no waiting** - instant feedback.

### Scenario 2: OpenAI rate limits

```
User clicks → Edge function → 429 Rate Limited
                    ↓
Client shows: "Vi er lidt for hurtige lige nu — prøver igen om X sek."
                    ↓
         Waits X seconds → Retries
                    ↓
         Success OR "OpenAI har stadig kapacitetsproblemer..."
```

**Automatic retry with clear feedback.**

## Testing

### Test 409 (no retry):

1. Start brand profile generation
2. Immediately click generate again
3. Should see: "Der genereres allerede en brandprofil — prøv igen om lidt."
4. No automatic retry, no waiting

### Test 429 (with retry):

1. Trigger multiple generations rapidly to hit OpenAI rate limit
2. Should see: "Vi er lidt for hurtige lige nu — prøver igen om X sek."
3. Automatic wait and retry
4. Either succeeds or shows persistent rate limit message

## Status

✅ **Fixed**: brandProfileService.ts lines 341-423
✅ **Tested**: Type checking passes
✅ **No breaking changes**: Existing 429 behavior preserved

## Related

- [BRAND_PROFILE_GENERATION_LOCK.md](BRAND_PROFILE_GENERATION_LOCK.md) - Server-side lock implementation
- [CREATE_BRAND_PROFILE_GENERATION_LOCKS.sql](CREATE_BRAND_PROFILE_GENERATION_LOCKS.sql) - Database migration
