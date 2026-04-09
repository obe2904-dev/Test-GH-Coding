# Current Database State - Post Cleanup

**Last Updated:** February 2, 2026  
**Status:** Optimized & Clean  
**Total Tables:** 29 active tables

---

## 📊 Database Overview

After cleanup, your database is streamlined and organized:

- **Core Tables:** 29 tables (all actively used)
- **Empty Tables Removed:** 5 tables deleted
- **Storage Optimized:** VACUUM ANALYZE completed
- **Code Coverage:** All remaining tables have active code references

---

## 🗂️ Tables by Category

### 1. Core Business (3 tables)

| Table | Rows | Size | Purpose |
|-------|------|------|---------|
| **profiles** | 1 | Small | User accounts |
| **businesses** | 1 | Small | Business entities (one per user) |
| **business_team_members** | 0 | Small | Multi-user collaboration (future) |

### 2. Business Profile & Brand (4 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **business_profile** | 1 | Business descriptions, target audience |
| **business_brand_profile** | 1 | Brand voice, tone, strategy |
| **business_operations** | 1 | Operations data, amenities |
| **business_visual_identity** | 0 | Logo, colors, visual style |

### 3. Location & Intelligence (3 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **business_locations** | 1 | Physical locations |
| **business_location_intelligence** | 1 | Location analysis, nearby venues |
| **opening_hours** | 7 | Business hours by day |

### 4. Menu System (4 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **menu_sources** | 8 | Menu URLs/sources |
| **menu_extractions** | 0 | Extracted menu data |
| **menu_results_v2** | 3 | Processed menu results |
| **business_menu_metadata** | 0 | Menu metadata & scores |

### 5. Menu Intelligence (2 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **menu_item_metadata** | 59 | Individual menu items analysis |
| **seasonal_ingredients** | 64 | Seasonal ingredient tracking |

### 6. Content & Posts (2 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **post_ideas** | 0 | Generated post ideas |
| **weekly_content_plans** | 44 | Weekly content scheduling |

### 7. Supporting Data (2 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **business_documents** | 43 | Uploaded PDFs, documents |
| **website_analyses** | 1 | Website crawl/analysis data |

### 8. Analysis & Intelligence (3 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **business_concept_fit** | 1 | Concept fit analysis |
| **business_audience_profile** | 0 | Target audience profiling |
| **business_goals** | 0 | Business objectives |

### 9. Performance & Analytics (6 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **content_type_baselines** | 0 | Performance baselines |
| **content_performance_log** | 0 | Content performance tracking |
| **opportunity_tracking** | 0 | Marketing opportunities |
| **contextual_calendar** | 30 | Context-aware calendar events |
| **social_accounts** | 0 | Social media accounts |
| **media_assets** | 0 | Media/image assets |

### 10. System Configuration (3 tables)

| Table | Rows | Purpose |
|-------|------|---------|
| **business_type_defaults** | 5 | Default settings per business type |
| **content_types** | 17 | Content type definitions |
| **content_distribution_rules** | 19 | Distribution rules config |
| **platform_assignment_rules** | 17 | Platform assignment logic |

---

## 📈 Key Metrics

### Tables with Active Data
- **Top 5 by row count:**
  1. seasonal_ingredients: 64 rows
  2. menu_item_metadata: 59 rows
  3. weekly_content_plans: 44 rows
  4. business_documents: 43 rows
  5. contextual_calendar: 30 rows

### Tables Ready for Future Use
These tables exist with 0 rows but are actively referenced in code:
- menu_extractions (21 code references)
- business_menu_metadata (7 references)
- business_visual_identity (8 references)
- business_audience_profile (3 references)
- business_goals (5 references)
- content_type_baselines (8 references)
- opportunity_tracking (8 references)

### Configuration Tables
System tables with seed data:
- content_types: 17 records
- content_distribution_rules: 19 records
- platform_assignment_rules: 17 records
- business_type_defaults: 5 records

---

## 🎯 Database Health

### ✅ Strengths
1. **Clean Schema:** Only actively used tables remain
2. **Well Organized:** Clear separation by feature area
3. **Good Coverage:** All tables have code references
4. **Optimized:** Recent VACUUM ANALYZE completed
5. **Future Ready:** Empty tables prepared for features

### ⚠️ Maintenance Notes
1. **High Dead Rows (Fixed):** VACUUM ANALYZE has cleaned these up
2. **Empty Feature Tables:** Normal - features not yet populated by user
3. **Single Business:** Currently 1 business, designed to scale

---

## 🔄 Recent Changes (Feb 2, 2026)

### Deleted (No Impact)
- ❌ business_concept_fit_multi (duplicate)
- ❌ post_drafts (old system)
- ❌ specials (unused)
- ❌ offerings (replaced by business_services)
- ❌ menu_results (old version)

### Optimized
- ✅ Ran VACUUM ANALYZE
- ✅ Reclaimed disk space
- ✅ Updated query statistics

---

## 📋 Table Dependencies

### Core Hierarchy
```
profiles (users)
  └── businesses (1:1)
      ├── business_profile
      ├── business_brand_profile
      ├── business_operations
      ├── business_locations
      │   └── business_location_intelligence
      ├── opening_hours
      ├── menu_sources
      │   ├── menu_extractions
      │   └── menu_results_v2
      ├── business_menu_metadata
      ├── menu_item_metadata
      ├── seasonal_ingredients
      ├── post_ideas
      ├── weekly_content_plans
      ├── business_documents
      ├── website_analyses
      └── business_concept_fit
```

### Support Tables (No Direct FK)
- business_type_defaults
- content_types
- content_distribution_rules
- platform_assignment_rules
- contextual_calendar

---

## 🚀 Next Steps

### For Monitoring
1. Run `scripts/check-all-tables.sql` quarterly to review growth
2. Run `VACUUM ANALYZE` monthly for maintenance
3. Check dead row counts in high-traffic tables

### For Growth
As your application grows:
- Monitor table sizes: `SELECT pg_size_pretty(pg_database_size(current_database()));`
- Archive old data from high-volume tables
- Consider partitioning for seasonal_ingredients if > 10,000 rows

### For Development
When adding new features:
1. Check if existing empty tables can be used
2. Document new tables in migrations
3. Add to code usage tracking

---

## 📞 Quick Reference

**Total Storage:** Check with Supabase Dashboard or:
```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

**Re-run Analysis:**
```bash
node scripts/analyze-db-usage.mjs
```

**Check Table Details:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM scripts/check-all-tables.sql;
```

---

## ✨ Summary

Your database is **clean, organized, and ready for growth**. All tables serve a purpose, empty tables are prepared for future features, and optimization has been completed. The structure supports your AI-powered social media content generation platform efficiently.

**Database Status:** 🟢 Excellent
