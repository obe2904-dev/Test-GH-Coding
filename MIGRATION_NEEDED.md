# Database Schema Migration Required ⚠️

**READ FIRST:** See [BRAND_PROFILE_ARCHITECTURE_ANALYSIS.md](BRAND_PROFILE_ARCHITECTURE_ANALYSIS.md) for full context.

## TL;DR

Your **drinks filter works perfectly** ✅. Your **database schema is outdated** ❌.

The error logs show:
```
✅ [Drinks Filter] Detected via menu_sources.label: "Cocktails"
✅ 🍸 Excluded drinks menu: "brunch" (label="Cocktails")  
✅ 🍸 Filtered out drinks-only programme from menu_signal: "COCKTAILS"
❌ Error: Could not find the 'tone_of_voice' column
```

**Problem:** You're running 2026 code on a 2025 database schema.

---

## STOP Coding, START Migrating

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# 1. See what will change (review before applying)
supabase db diff --linked

# 2. Apply ALL pending migrations  
supabase db push

# 3. Verify schema updated
supabase db pull --schema public
```

---

## What This Will Fix

### Tables Created
- `brand_profile_generation_locks` (prevents concurrent generation)
- `menu_extractions` (legacy support)

### Columns Added to `business_brand_profile`
- `tone_of_voice`
- `content_focus`
- `communication_goal`
- `target_audience`  
- `core_offerings`
- `image_preferences`
- `social_style`
- `voice_examples`
- ... and 20+ other columns from migrations

### Columns Added to `business_locations`
- `enrichment` (geographic context)

---

## After Migration: Test the Drinks Filter

```bash
# Regenerate Cafe Faust profile
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator' \
  -H "Authorization: Bearer <SERVICE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"businessId": "f4679fa9-3120-4a59-9506-d059b010c34a", "forceRegenerate": true}'

# Expected result:
# ✅ Only FROKOST programme (food)
# ✅ AFTEN/Cocktails excluded (drinks)
# ✅ Full profile saved (not just brand_essence)
```

---

## Known Data Issue

The "brunch" menu has **incorrect label** in your database:
```sql
-- Current (WRONG):
service_period_name: "brunch"
menu_sources.label: "Cocktails"  ← This is wrong!

-- After you fix:
service_period_name: "brunch"  
menu_sources.label: "Brunch"     ← Correct label
```

**Why this matters:** The filter correctly excludes it as drinks because the **label says "Cocktails"**.

---

## Architecture Decision Needed

You have TWO brand profile generators:

1. **brand-profile-generator** (V4) - Legacy, business-level
2. **brand-profile-generator-v5** (V5) - NEW, programme-aware

**Which one do you want to use?** See analysis document for details.

---

## Summary

1. ✅ Drinks filter code is deployed and working
2. ❌ Database schema is outdated (missing 30+ columns)  
3. ⚠️  Data quality issue (brunch labeled as "Cocktails")
4. ❓ Architecture decision: V4 or V5?

**Next step:** Run `supabase db push` to update schema.

