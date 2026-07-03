# Menu Extraction Loop - Fixed

## The Problem

Your menu extraction was stuck in an infinite loop with these symptoms:
1. **Repeated extraction jobs** being created for the same menus
2. **400/409 database errors** on `business_operations` table
3. **Duplicate operations updates** running concurrently

## Root Causes Identified

### 1. Concurrent Operations Updates
When 7 menus extract simultaneously, `updateOperationsPricing()` was called 7 times concurrently, all trying to insert/update the same `business_operations` row, causing 409 (Conflict) errors.

### 2. Race Conditions on Insert/Update
The code was checking if a record exists, then inserting or updating - but with concurrent calls, multiple threads would all see "no record exists" and try to insert simultaneously.

### 3. No Duplicate Extraction Guard
Extraction function could be called multiple times for the same card if button was clicked repeatedly or React re-rendered.

## Fixes Applied

### Fix 1: Debounced Operations Update ✅

**File**: `MenuPage.tsx` lines 425-442

```typescript
// Before: Immediate update after each extraction
await updateOperationsPricing()

// After: Debounced - waits 2 seconds after LAST completion
if (operationsUpdateTimeoutRef.current) {
  clearTimeout(operationsUpdateTimeoutRef.current)
}
operationsUpdateTimeoutRef.current = setTimeout(() => {
  updateOperationsPricing().catch(err => 
    console.error('Error updating operations pricing:', err)
  )
}, 2000)
```

**Benefit**: When 7 menus extract, operations update runs only ONCE after all complete, not 7 times.

### Fix 2: Upsert Instead of Check/Insert/Update ✅

**File**: `MenuPage.tsx` lines 596-611

```typescript
// Before: Check if exists, then insert OR update
const { data: existing } = await supabase
  .from('business_operations')
  .select('id')
  .eq('business_id', businessId)
  .maybeSingle()

if (existing) {
  await supabase.from('business_operations').update(opsData).eq('id', existing.id)
} else {
  await supabase.from('business_operations').insert({business_id: businessId, ...opsData})
}

// After: Atomic upsert with conflict resolution
const { error: upsertError } = await supabase
  .from('business_operations')
  .upsert(opsData, {
    onConflict: 'business_id',
    ignoreDuplicates: false
  })
```

**Benefit**: No race conditions - database handles conflicts atomically.

### Fix 3: Duplicate Extraction Guard ✅

**File**: `MenuPage.tsx` lines 311-318

```typescript
const handleExtractMenu = async (cardId: string, sourceUrl: string) => {
  if (!businessId) return

  // Prevent duplicate extraction calls
  if (activeExtractions.has(cardId)) {
    console.log(`⏭️ Extraction already in progress for card ${cardId}`)
    return
  }

  setActiveExtractions(prev => new Set(prev).add(cardId))
  // ... rest of extraction logic
}
```

**Benefit**: Prevents double-clicks or React strict mode from triggering duplicate extractions.

### Fix 4: Cleanup Timeout on Unmount ✅

**File**: `MenuPage.tsx` lines 57-65

```typescript
useEffect(() => {
  return () => {
    pollIntervalsRef.current.forEach(interval => clearInterval(interval))
    pollIntervalsRef.current.clear()
    if (operationsUpdateTimeoutRef.current) {
      clearTimeout(operationsUpdateTimeoutRef.current) // NEW
    }
  }
}, [])
```

**Benefit**: Prevents memory leaks and stale timeout callbacks.

## How to Verify Fixes

1. **Restart dev server**: `npm run dev` (to ensure changes are picked up)
2. **Clear browser cache**: Hard refresh (Cmd+Shift+R on Mac)
3. **Test multi-menu extraction**:
   - Go to Menu page
   - Click "Find menukort" to detect menus
   - Extract multiple menus simultaneously
   - Watch console logs

### Expected Behavior After Fix:

```
✅ Extraction job created: Object
✅ Extraction job created: Object
✅ Extraction job created: Object
... (one per menu)

[Wait 2 seconds after last completion]

✅ Auto-updated Operations from 25 food items: 135 DKK, moderate, kids menu: true
// ^ Should only appear ONCE
```

### What Should NOT Happen:

❌ Repeated "✅ Extraction job created" for same menu
❌ Multiple "✅ Auto-updated Operations" messages
❌ 400/409 errors in console
❌ "⏱️ Polling timeout" messages

## Database Requirements

Make sure your `business_operations` table has a unique constraint on `business_id`:

```sql
-- Check constraint exists
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'business_operations'::regclass;

-- If missing, add it:
ALTER TABLE business_operations 
ADD CONSTRAINT business_operations_business_id_key 
UNIQUE (business_id);
```

This is REQUIRED for upsert to work correctly.

## Still Having Issues?

If the loop persists after restart:

1. **Check React StrictMode**: In development, React runs effects twice to catch bugs. This is normal.

2. **Check polling intervals**: Look for multiple polling intervals running:
   ```typescript
   console.log('Active polling intervals:', pollIntervalsRef.current.size)
   ```

3. **Check database constraint**: Run the SQL above to verify unique constraint exists.

4. **Clear all menu sources**: If stuck, reset by deleting all menu_sources and starting fresh:
   ```sql
   DELETE FROM menu_sources WHERE business_id = 'your-business-id';
   DELETE FROM menu_results_v2 WHERE business_id = 'your-business-id';
   ```

## Performance Notes

- **Debounce delay**: Set to 2 seconds. Adjust if needed:
  ```typescript
  }, 2000) // Increase if you have MANY menus (10+)
  ```

- **Polling timeout**: 90 seconds max. Adjust for slow servers:
  ```typescript
  const maxAttempts = 90 // Increase if extraction takes longer
  ```

## Monitoring

Add these logs to track the fixes:

```typescript
// After debounce timeout fires:
console.log('🔄 Running operations update (debounced)')

// After upsert succeeds:
console.log('✅ Operations upserted successfully')

// If extraction guard blocks:
console.log(`🛑 Blocked duplicate extraction for ${cardId}`)
```

