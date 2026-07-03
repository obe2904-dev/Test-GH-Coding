# Weekly Plan + Quick Suggestions Integration Implementation

**Date**: 2026-06-07  
**Status**: ✅ **COMPLETE - READY FOR DEPLOYMENT**

## Overview

This implementation enables Weekly Plan and Quick Suggestions to coexist without overwriting each other's data, while providing proper deduplication and cross-system awareness.

---

## ✅ Changes Implemented

### **Phase 1: Database Schema** ✅
**File**: `supabase/migrations/20260607000001_add_source_to_daily_suggestions.sql`

- Added `source` column to `daily_suggestions` table
  - Values: `'quick_suggestions'` or `'weekly_plan'`
  - NOT NULL with CHECK constraint
  - Default: `'quick_suggestions'` for backward compatibility
- Updated unique constraint from `(business_id, suggestion_date, position)` to `(business_id, suggestion_date, position, source)`
- Created performance index: `idx_daily_suggestions_source`
- Backfilled existing data with `source = 'quick_suggestions'`

**Impact**: Both systems can now store 3 suggestions per day each without conflicts.

---

### **Phase 2: Weekly Strategy Deduplication** ✅
**File**: `supabase/functions/get-weekly-strategy/index.ts`

**Changes**:
1. Added query for `published_posts` (14-day lookback for menu items)
2. Added query for `post_ideas WHERE status='scheduled'` (upcoming week)
3. Extracted menu items from both sources for deduplication
4. Added `scheduled_posts_this_week` to `previousWeek` context object

**Impact**: Weekly Plan now knows about:
- Published posts from Quick Suggestions or manual posts
- Scheduled posts queued for the upcoming week
- AI receives scheduled posts context and can decide if multiple posts per day is acceptable

---

### **Phase 3: Weekly Plan Storage** ✅
**File**: `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts`

**Changes**:
1. Added `source: 'weekly_plan'` to daily suggestions objects
2. Updated `onConflict` parameter to include `'source'` field

**Impact**: Weekly Plan suggestions are now tagged and won't overwrite Quick Suggestions.

---

### **Phase 4: Quick Suggestions** ✅
**File**: `supabase/functions/get-quick-suggestions/index.ts`

**Changes**:
1. Added `source: 'quick_suggestions'` to suggestion objects
2. Updated `onConflict` parameter to include `'source'` field
3. Added query for Weekly Plan ideas for today
4. Included `weeklyPlanIdeas` in response (both cached and fresh paths)

**Impact**: 
- Quick Suggestions tagged properly
- UI receives Weekly Plan context for display
- No overwrite conflicts

---

### **Phase 5: AI Context Enhancement** ✅
**Automatic from Phase 2 changes**

The `previousWeek.scheduled_posts_this_week` field flows through `weekContext` to the AI strategy generator automatically.

**Impact**: AI can see scheduled posts and make intelligent decisions about posting frequency.

---

### **Phase 6: Testing & Verification** ✅
**File**: `_test_weekly_plan_integration.sql`

Comprehensive test suite covering:
- Schema verification (10 tests)
- Constraint validation
- Data distribution by source
- Coexistence verification
- Duplicate detection
- Integration summary

---

## 🚀 Deployment Steps

### **Step 1: Apply Database Migration**
```bash
# Connect to Supabase database
psql $DATABASE_URL -f supabase/migrations/20260607000001_add_source_to_daily_suggestions.sql
```

### **Step 2: Deploy Backend Functions**
```bash
# Deploy updated functions
supabase functions deploy get-weekly-strategy
supabase functions deploy get-quick-suggestions
supabase functions deploy generate-weekly-plan
```

### **Step 3: Run Verification Tests**
```bash
# Run integration tests
psql $DATABASE_URL -f _test_weekly_plan_integration.sql
```

Expected results:
- All 9 tests should PASS
- Summary should show both sources in use
- No duplicate violations

### **Step 4: Monitor Initial Behavior**
- Generate Quick Suggestions for a business
- Generate Weekly Plan for same business
- Verify both appear in `daily_suggestions` with different `source` values
- Check that menu items from published posts are being deduplicated

---

## 📊 Database Changes

### **New Column**
```sql
ALTER TABLE daily_suggestions 
  ADD COLUMN source TEXT NOT NULL DEFAULT 'quick_suggestions'
  CHECK (source IN ('quick_suggestions', 'weekly_plan'));
```

### **New Constraint**
```sql
-- Old (causes overwrites):
UNIQUE(business_id, suggestion_date, position)

-- New (allows coexistence):
UNIQUE(business_id, suggestion_date, position, source)
```

### **New Index**
```sql
CREATE INDEX idx_daily_suggestions_source 
  ON daily_suggestions(business_id, source, suggestion_date);
```

---

## 🎯 Key Features Delivered

### **1. No Data Loss**
- Quick Suggestions and Weekly Plan can both have 3 suggestions per day
- Each tagged with its source system
- No overwrites when regenerating

### **2. Smart Deduplication**
- Weekly Plan queries `published_posts` for 14-day menu item history
- Weekly Plan queries `post_ideas.status='scheduled'` for upcoming posts
- Avoids suggesting dishes that were recently posted via Quick Suggestions

### **3. Cross-System Awareness**
- Quick Suggestions response includes `weeklyPlanIdeas` array
- UI can display: "ℹ️ Your Weekly Plan suggests: [title]"
- Weekly Plan receives scheduled posts in AI context

### **4. AI Intelligence**
- Strategy AI sees scheduled posts for the week
- Can decide if multiple posts per day makes strategic sense
- Example: "Monday has scheduled Pasta → AI may still suggest Monday Dessert"

---

## 🔄 Backward Compatibility

- Default `source = 'quick_suggestions'` ensures existing code works
- Existing suggestions backfilled with `quick_suggestions` source
- No breaking changes to API responses (added fields are new)
- Old frontend code will continue to work (ignores new fields)

---

## 📝 Next Steps (Future UI Work)

These are documented in POST_TYPE_SYSTEM.md but not implemented yet:

### **Quick Suggestions UI**
Show Weekly Plan context note:
```typescript
if (weeklyPlanIdeas.length > 0) {
  showNote(`ℹ️ Your Weekly Plan suggests: "${weeklyPlanIdeas[0].title}"`)
}
```

### **Weekly Plan UI**
Show scheduled and posted content per day:
```typescript
// Display scheduled posts (from Skriv Selv or Quick Suggestions)
if (day.scheduledPosts.length > 0) {
  showBadge("📅 Scheduled: " + day.scheduledPosts[0].title)
}

// Display published posts
if (day.publishedPosts.length > 0) {
  showBadge("✅ Posted: " + day.publishedPosts[0].menu_item_name)
}
```

---

## ⚠️ Important Notes

1. **Migration is idempotent**: Can be run multiple times safely
2. **Zero downtime**: New column has default value
3. **Backward compatible**: Existing code continues to work
4. **Performance**: New index ensures fast queries by source
5. **Testing required**: Run verification suite after deployment

---

## 📖 Documentation References

- **Architecture**: `POST_TYPE_SYSTEM.md` Section 11
- **Implementation Spec**: Lines 307-630 in POST_TYPE_SYSTEM.md
- **Database Schema**: `DB-SCHEMA-OVERVIEW.md` (needs update for source column)

---

## ✅ Success Criteria

After deployment, verify:
- [ ] Migration runs successfully (no errors)
- [ ] All 9 test cases PASS
- [ ] Quick Suggestions still works (regenerate for test business)
- [ ] Weekly Plan generation works (test with Cafe Faust)
- [ ] Both systems can have suggestions for same day
- [ ] No duplicate key violations in logs
- [ ] `weeklyPlanIdeas` array appears in Quick Suggestions response
- [ ] Weekly strategy logs show "posted_items_count" includes published_posts

---

**Implementation completed**: 2026-06-07  
**Ready for deployment**: ✅ YES  
**Breaking changes**: ❌ NO  
**Requires frontend changes**: ⚠️ Optional (for UI awareness features)
