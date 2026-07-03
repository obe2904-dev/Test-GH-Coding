# 🚀 CACHING QUICK REFERENCE
## Developer Cheat Sheet

---

## 📋 COMMON OPERATIONS

### Check if Cache is Working
```sql
-- Should return column_count = 6
SELECT COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name IN (
    'generated_text', 'generated_hashtags', 'generated_platform_content',
    'generated_at', 'platforms_generated', 'text_generation_version'
  );
```

### View Recent Cache Activity
```sql
SELECT 
  id, title,
  LENGTH(generated_text) AS text_len,
  platforms_generated AS platforms,
  text_generation_version AS ver,
  generated_at AS cached_at
FROM daily_suggestions
WHERE generated_at >= NOW() - INTERVAL '1 hour'
ORDER BY generated_at DESC;
```

### Find Suggestion's Cache Status
```sql
-- Replace with your suggestion ID
SELECT 
  title,
  CASE 
    WHEN generated_text IS NULL THEN '❌ No cache'
    WHEN text_generation_version < 8 THEN '⚠️ Old version'
    ELSE '✅ Valid cache'
  END AS status,
  platforms_generated,
  text_generation_version,
  generated_at
FROM daily_suggestions
WHERE id = 'YOUR_SUGGESTION_ID';
```

### Cache Hit Rate (Last 7 Days)
```sql
SELECT 
  COUNT(*) AS total,
  COUNT(generated_text) AS cached,
  ROUND(100.0 * COUNT(generated_text) / COUNT(*), 1) AS hit_rate_pct
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days';
```

---

## 🔧 TESTING COMMANDS

### Force Regeneration (Invalidate Cache)
```sql
UPDATE daily_suggestions
SET text_generation_version = 0
WHERE id = 'YOUR_SUGGESTION_ID';
```

### Clear Today's Cache (for Testing)
```sql
UPDATE daily_suggestions
SET 
  generated_text = NULL,
  generated_hashtags = NULL,
  generated_platform_content = NULL,
  generated_at = NULL,
  platforms_generated = NULL,
  text_generation_version = NULL
WHERE date = CURRENT_DATE;
```

### Verify Cache Write Worked
```sql
-- Run immediately after clicking "Næste" in AI Ideas
SELECT 
  title,
  LENGTH(generated_text) AS chars,
  jsonb_array_length(generated_hashtags) AS tags,
  EXTRACT(EPOCH FROM (NOW() - generated_at)) AS seconds_ago
FROM daily_suggestions
WHERE generated_at >= NOW() - INTERVAL '30 seconds'
ORDER BY generated_at DESC
LIMIT 1;
```

---

## 🐛 DEBUGGING

### Check for Corrupt Cache
```sql
SELECT id, title, 'Invalid hashtags' AS issue
FROM daily_suggestions
WHERE generated_hashtags IS NOT NULL 
  AND jsonb_typeof(generated_hashtags) != 'array'
UNION ALL
SELECT id, title, 'Missing platform content keys' AS issue
FROM daily_suggestions
WHERE generated_platform_content IS NOT NULL
  AND NOT (generated_platform_content ? 'facebook' OR generated_platform_content ? 'instagram');
```

### Find Incomplete Cache Entries
```sql
SELECT 
  id, title,
  generated_text IS NOT NULL AS has_text,
  generated_at IS NOT NULL AS has_time,
  platforms_generated IS NOT NULL AS has_platforms,
  text_generation_version IS NOT NULL AS has_version
FROM daily_suggestions
WHERE generated_text IS NOT NULL
  AND (
    generated_at IS NULL OR
    platforms_generated IS NULL OR
    text_generation_version IS NULL
  );
```

---

## 📊 CONSOLE LOG PATTERNS

### Cache Hit (Success)
```
✅ Loading cached content from database (generated at: 2026-06-04...)
```

### Cache Miss - Platform Change
```
🔎 Cache decision: { willUseCache: false, reason: 'platform mismatch' }
```

### Cache Miss - Old Version
```
🔎 Cache decision: { willUseCache: false, reason: 'old version' }
```

### Cache Write Success
```
✅ Successfully cached generated content { suggestionId: ..., textLength: 487 }
```

### Cache Write Failure
```
❌ Failed to cache generated content: { code: '42P01', ... }
```

---

## ⚙️ CONFIGURATION

### Current Version
```typescript
// CreatePostPage.tsx line ~27
const CURRENT_TEXT_VERSION = 8
```

### Bump Version (Forces Regeneration)
```typescript
const CURRENT_TEXT_VERSION = 9  // Increment when prompts change
```

---

## 🎯 QUICK TESTS

### 1-Minute Smoke Test
1. Open AI Ideas → Select suggestion → Click "Næste"
2. Console shows `💾 Saving generated content`
3. Click "Tilbage" → Same suggestion → "Næste"
4. Console shows `✅ Loading cached content` (300ms load)
5. ✅ **Cache Working!**

### Platform Change Test
1. Load suggestion with cache (above test)
2. Click "Tilbage"
3. Change platforms (add/remove Instagram)
4. Click "Næste"
5. Console shows `reason: 'platform mismatch'`
6. ✅ **Invalidation Working!**

---

## 📈 HEALTH METRICS

**Good Cache System:**
- Hit rate: >50% after 1 week
- Write success: >95%
- Average text length: 300-600 chars
- Hashtag count: 3-8 per post

**Warning Signs:**
- Hit rate: <30% (check invalidation logic)
- Write failures: >5% (check database permissions)
- Empty text: >1% (check generation logic)
- Missing platforms: >0% (check validation)

---

## 🔗 RELATED FILES

**SQL Files:**
- `_apply_missing_daily_suggestions_columns.sql` - Schema migration
- `_test_caching_sanity_check.sql` - System health tests
- `_test_caching_functionality.sql` - Scenario tests
- `_test_caching_debug_queries.sql` - Developer utilities

**TypeScript Files:**
- `src/pages/dashboard/CreatePostPage.tsx` - Cache logic (lines 470-660)

**Documentation:**
- `CACHING_SYSTEM.md` - Full documentation
- `POST_TYPE_SYSTEM.md` - Content type system (cache context)

---

## 💡 TIPS

✅ **DO:**
- Run sanity check after schema changes
- Monitor cache hit rate weekly
- Test both cache hit and miss flows
- Log cache decisions clearly
- Validate data before caching

❌ **DON'T:**
- Skip validation checks
- Ignore cache write failures
- Cache empty or invalid data
- Assume cache is always valid
- Bump version unnecessarily

---

**Updated**: 2026-06-04  
**Quick Help**: See `CACHING_SYSTEM.md` for full documentation
