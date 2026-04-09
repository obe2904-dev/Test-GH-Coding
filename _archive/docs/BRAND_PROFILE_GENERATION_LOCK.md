# Brand Profile Generation Lock System

## Overview

Server-side single-flight lock mechanism to prevent overlapping brand profile generations for the same business. Provides global guarantee: **one generation per business at a time**.

## Architecture

### Database Table

```sql
CREATE TABLE brand_profile_generation_locks (
  business_id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL,
  request_id text NOT NULL,
  created_at timestamptz NOT NULL
);
```

### Lock Lifecycle

1. **Acquisition** (function start)
   - Check for existing lock
   - If exists and < 10 minutes old → return 409 Conflict
   - If exists and > 10 minutes old → remove stale lock, continue
   - Insert new lock row

2. **Active** (during generation)
   - Lock prevents concurrent requests
   - All concurrent attempts receive 409 response

3. **Release** (function end)
   - Successful completion → release lock
   - Error/exception → release lock (in catch block)
   - All exit paths → lock is cleaned up

## Implementation Details

### acquireGenerationLock()

```typescript
// Returns: { success: boolean, reason?: string, existingRequestId?: string }
// - Checks for existing lock
// - Removes stale locks (> 10 min)
// - Inserts new lock row
// - Handles race conditions
```

### releaseGenerationLock()

```typescript
// Deletes lock row for business_id + request_id
// Called in:
// - Normal completion path
// - Early return paths (cached profile, skip generation)
// - Error catch block
```

## Stale Lock Handling

**Problem**: Function crashes before releasing lock → permanent block

**Solution**: 10-minute timeout
- Locks older than 10 minutes are considered stale
- Automatically removed on next generation attempt
- Prevents permanent deadlock

## Response Codes

### 409 Conflict - Generation In Progress

```json
{
  "error": "Generation already in progress",
  "reason": "Generation already in progress",
  "requestId": "req_abc123",
  "existingRequestId": "req_xyz789",
  "lockAgeMinutes": 2.5,
  "details": "Another generation request is currently processing. Please wait."
}
```

**When lock > 5 minutes old:**
```json
{
  "details": "Generation has been running for over 5 minutes. It may be stuck. Contact support if this persists."
}
```

## Protection Against

✅ **User refreshes page** → 409 if first request still running

✅ **Multiple browser tabs** → 409 for second tab

✅ **Network retries** → 409 for retry attempts

✅ **Race conditions** → Database PRIMARY KEY constraint ensures atomicity

✅ **Stale locks** → 10-minute timeout prevents permanent blocks

## Monitoring

### Check active locks:

```sql
SELECT 
  business_id,
  request_id,
  started_at,
  EXTRACT(EPOCH FROM (now() - started_at))/60 AS age_minutes
FROM brand_profile_generation_locks
ORDER BY started_at DESC;
```

### Find stale locks:

```sql
SELECT * 
FROM brand_profile_generation_locks
WHERE started_at < now() - interval '10 minutes';
```

### Cleanup stale locks manually:

```sql
DELETE FROM brand_profile_generation_locks
WHERE started_at < now() - interval '10 minutes';
```

## Client-Side Integration

No changes needed to client code. The lock is transparent:

- **Success**: Normal 200 response with profile
- **Conflict**: 409 response triggers error handling
- **UI already has**: isGenerating state + disabled button

## Testing

### Test concurrent requests:

```bash
# Terminal 1
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"businessId": "test-uuid", "forceRegenerate": true}'

# Terminal 2 (immediately)
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"businessId": "test-uuid", "forceRegenerate": true}'
```

Expected: Second request gets 409 Conflict.

## Migration Required

Apply [CREATE_BRAND_PROFILE_GENERATION_LOCKS.sql](CREATE_BRAND_PROFILE_GENERATION_LOCKS.sql) to database:

```bash
# Via Supabase SQL Editor (recommended)
# Copy/paste SQL into: Dashboard → SQL Editor → New Query

# Or via CLI
supabase db push --db-url "$DATABASE_URL" < CREATE_BRAND_PROFILE_GENERATION_LOCKS.sql
```

## Status

✅ **Implemented**: Edge function v4.11.9
✅ **Deployed**: kvqdkohdpvmdylqgujpn.supabase.co
⚠️ **Pending**: Database migration (apply SQL manually)

## Next Steps

1. Apply database migration in Supabase SQL Editor
2. Test concurrent requests
3. Monitor lock table for stale entries
4. (Optional) Add scheduled cleanup job for locks > 30 minutes old
