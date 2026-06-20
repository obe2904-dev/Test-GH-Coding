# QUICK START: Database Consolidation

## ✅ What's Been Done

1. **Created migration SQL** → `supabase/migrations/20260620120000_consolidate_posts_tables.sql`
2. **Created new unified hook** → `src/hooks/usePosts.ts`
3. **Updated PublishStep component** → Now uses `posts` table
4. **Created documentation** → See `_IMPLEMENTATION_COMPLETE.md` for details

## 🚀 What You Need to Do

### Step 1: Run the Migration (5 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Copy/paste contents of `supabase/migrations/20260620120000_consolidate_posts_tables.sql`
3. Click **Run**
4. Verify success: Should see ✅ checkmarks in output

### Step 2: Test the Flow (15 minutes)

**Test "Skriv selv":**
```
1. Go to http://localhost:3000/dashboard/create?mode=write
2. Create post → Design → Udgiv → Schedule
3. Verify post appears in timeline as "Planlagt"
```

**Test "Lav opslag nu":**
```
1. Go to http://localhost:3000/dashboard/create?mode=ai
2. Pick suggestion → Design → Udgiv → Publish
3. Verify post shows as "Udgivet"
```

**Test "Ugentlig plan":**
```
1. Go to http://localhost:3000/dashboard/ai-weekly-plan
2. Pick a slot → Design → Udgiv → Schedule
3. Verify post linked to correct date
```

### Step 3: Verify Database (2 minutes)

```sql
-- Check posts table exists
SELECT COUNT(*) FROM posts;

-- Check post_drafts is gone
SELECT COUNT(*) FROM post_drafts; 
-- Should error: "relation does not exist" ✅

-- Check statuses work
SELECT status, COUNT(*) 
FROM posts 
GROUP BY status;
```

## 📋 Quick Checklist

- [ ] Migration ran successfully (no errors)
- [ ] Skriv selv flow works end-to-end
- [ ] Lav opslag nu flow works end-to-end
- [ ] Ugentlig plan flow works end-to-end
- [ ] Timeline shows all posts correctly
- [ ] Scheduling updates same row (not new row)

## ❓ Having Issues?

**Migration fails:**
- Check that tables exist: `SELECT * FROM information_schema.tables WHERE table_name IN ('posts', 'post_drafts', 'published_posts');`
- Run migration line-by-line to find error

**Timeline empty:**
- Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'posts';`
- Check browser console for errors

**Drafts not saving:**
- Check `posts` table columns: `\d posts` (in psql)
- Check business_id is set correctly

## 📚 Documentation

- **Full details:** `_IMPLEMENTATION_COMPLETE.md`
- **Original plan:** `_POSTS_TABLE_CONSOLIDATION_PLAN.md`

## 🎯 Expected Result

**Before:** 2 tables (`post_drafts` + `published_posts`), complex migrations

**After:** 1 table (`posts`), simple status updates

**Benefits:**
✅ No data migration between tables  
✅ Complete post history  
✅ Simpler queries  
✅ Atomic updates  
✅ Better for analytics  

---

**That's it! Run the migration and test. Should take ~20-30 minutes total.**
