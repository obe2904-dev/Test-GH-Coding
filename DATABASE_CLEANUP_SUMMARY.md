# Database Cleanup - Executive Summary

**Date:** February 2, 2026  
**Status:** Analysis Complete - Ready for Verification

---

## 📊 Overview

We've completed a comprehensive audit of your Supabase database:

- **Total Tables:** 50
- **Actively Used:** 41 tables (82%)
- **Potentially Unused:** 9 tables (18%)
- **Estimated Space Savings:** TBD (depends on row counts)

---

## 🎯 Recommended Actions

### Immediate Actions (Safe & Recommended)

#### 1. Run Verification Script ✅
**File:** `scripts/verify-unused-tables.sql`

This checks:
- Row counts for unused tables
- Foreign key dependencies
- RLS policies
- Triggers and indexes
- Sample data

**Action:** Copy the script into Supabase SQL Editor and run it.

#### 2. Review Results 🔍
After running verification, assess each unused table:
- **If row_count = 0:** Safe to delete
- **If row_count > 0:** Review sample data before deciding
- **If has dependencies:** More careful evaluation needed

#### 3. Export Database Backup 💾
**Before any deletion:**
```bash
# Use Supabase Dashboard > Project Settings > Database > Connection String
# Then use pg_dump to create backup
```

Or use Supabase Dashboard: Database > Backups

---

## 📋 Tables Recommended for Deletion

### High Confidence (Likely Safe)

| Table | Row Count | Risk | Recommendation |
|-------|-----------|------|----------------|
| `platform_intelligence` | ? | Low | Delete if empty |
| `offerings` | ? | Low | Delete if empty (replaced by business_services) |
| `specials` | ? | Low | Delete if empty |
| `weather_cache` | ? | Very Low | Delete (cache tables can be recreated) |
| `content_types` | ? | Low | Delete if empty |
| `content_distribution_rules` | ? | Low | Delete if empty |
| `platform_assignment_rules` | ? | Low | Delete if empty |

### Medium Confidence (Verify Carefully)

| Table | Row Count | Risk | Recommendation |
|-------|-----------|------|----------------|
| `post_drafts` | ? | Medium | Check if different from current drafts |
| `business_concept_fit_multi` | ? | Medium | Check relation to business_concept_fit |

---

## 🚀 Execution Plan

### Step 1: Verification (5-10 minutes)
1. Open Supabase SQL Editor
2. Run `scripts/verify-unused-tables.sql`
3. Save the results to a file
4. Review all outputs

### Step 2: Analysis (10-15 minutes)
For each unused table, determine:
- Is it truly empty?
- Does it have any dependencies?
- Is there any important data?
- Are there any RPC references?

### Step 3: Backup (5 minutes)
- Create database backup via Supabase Dashboard
- Or export specific tables if needed

### Step 4: Cleanup (Staged Approach)

**Week 1: Delete Empty Cache Tables**
```sql
-- Start with lowest risk
DROP TABLE IF EXISTS weather_cache CASCADE;
```
✅ Test application for 2-3 days

**Week 2: Delete Other Empty Tables**
```sql
DROP TABLE IF EXISTS platform_intelligence CASCADE;
DROP TABLE IF EXISTS content_types CASCADE;
DROP TABLE IF EXISTS content_distribution_rules CASCADE;
DROP TABLE IF EXISTS platform_assignment_rules CASCADE;
```
✅ Test application for 2-3 days

**Week 3: Delete Remaining After Verification**
Only proceed if Week 1-2 went smoothly and verification confirms safety.

### Step 5: Monitor (Ongoing)
- Watch error logs for missing table references
- Monitor application performance
- Keep backup for 30 days before final deletion

---

## 📁 Files Created

1. **DATABASE_AUDIT_PLAN.md** - Complete audit documentation
2. **scripts/analyze-db-usage.mjs** - Automated code analysis script
3. **scripts/verify-unused-tables.sql** - Verification queries for Supabase
4. **scripts/cleanup-unused-tables.sql** - Safe deletion script (commented)
5. **scripts/audit-database-schema.sql** - Full schema inspection queries
6. **database-usage-report.json** - Detailed usage data

---

## ⚠️ Important Warnings

### DO NOT delete tables without:
1. ✅ Running verification script
2. ✅ Creating database backup
3. ✅ Testing on staging environment (if available)
4. ✅ Getting stakeholder approval
5. ✅ Having rollback plan ready

### Edge Cases to Consider:
- **RPC Functions:** May reference tables not found in code search
- **Triggers:** May create/update data in these tables
- **Future Features:** Tables may be prepared for upcoming features
- **Manual Operations:** Tables may be used for manual data entry

---

## 💡 Next Steps - What to Do Now

### Option A: Conservative Approach (Recommended)
1. Run verification script
2. Only delete tables with:
   - Zero rows
   - No dependencies
   - No data samples
3. Keep backup for 30 days
4. Monitor for issues

### Option B: Aggressive Approach
1. Run verification script
2. Export all unused tables to backup
3. Delete all verified unused tables
4. Monitor closely for 1 week
5. Restore if issues arise

### Option C: Do Nothing (Also Valid)
- If tables are small (< 1GB total)
- If you're uncertain about future use
- If testing/verification time outweighs benefits

---

## 📞 Decision Required

**Before proceeding, please confirm:**

1. **What's your risk tolerance?**
   - Conservative (only delete empty tables)
   - Moderate (delete verified unused tables)
   - Aggressive (delete all unused tables)

2. **Do you have a staging environment?**
   - Yes → Test there first
   - No → Proceed extra cautiously

3. **Can you afford downtime if something breaks?**
   - Yes → Can proceed faster
   - No → Use staged approach

4. **When do you want to execute?**
   - Now → I'll guide you through verification
   - Later → Review scripts and decide
   - Never → Keep audit for documentation

---

## 🎓 Learning for Future

To prevent unused tables from accumulating:

1. **Before creating tables:**
   - Document purpose in migration comments
   - Add creation date in migration filename
   - Link to feature specification

2. **Regular audits:**
   - Run `analyze-db-usage.mjs` quarterly
   - Review low-usage tables
   - Remove deprecated features

3. **Migration hygiene:**
   - Name migrations clearly
   - Include rollback instructions
   - Test before deploying

---

**Ready to proceed?** Let me know which approach you prefer, and I'll guide you through the next steps!
