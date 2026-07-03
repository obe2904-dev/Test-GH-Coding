# HYBRID PERSONA DEPLOYMENT CHECKLIST ✅

## Status: Phase 1 Implementation COMPLETE

---

## ✅ COMPLETED

### 1. Code Implementation
- ✅ Created `city-context-ai.ts` (AI-generated city context with 90-day caching)
- ✅ Created `business-identity-persona.ts` (HYBRID persona generation)
- ✅ Updated `brand-profile-generator-v5/index.ts` (integrated HYBRID approach)
- ✅ Created migration `20260520000000_city_context_cache_hybrid_persona.sql`
- ✅ Deployed function: **364.9kB** (successful)

### 2. Database Migration
- ✅ Migration file created
- ⏳ **PENDING: Run SQL in Supabase Dashboard**

### 3. Validation Queries
- ✅ Created `VALIDATE-HYBRID-PERSONA-DATABASE.sql` (comprehensive checks)
- ✅ Created `RUN-IN-SUPABASE-DASHBOARD.sql` (table creation)
- ✅ Created `test-hybrid-persona.cjs` (API test script)

---

## 🚀 NEXT STEPS (Required)

### Step 1: Create city_context_cache Table

**Action:** Run SQL in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
2. Copy contents of `RUN-IN-SUPABASE-DASHBOARD.sql`
3. Paste and run
4. Verify: Should see "city_context_cache created, 5 seeded_cities"

**Why:** The deployed function needs this table to store AI-generated city contexts

---

### Step 2: Test with Café Faust

**Option A: API Test (Recommended)**

```bash
# Get your Supabase anon key from:
# https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/settings/api

# Then test:
curl -X POST \
  https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5 \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"business_id":"f4679fa9-3120-4a59-9506-d059b010c34a"}'
```

**Option B: Use Brand Dashboard**
1. Go to Café Faust brand profile
2. Click "Regenerate Brand Profile"
3. Wait ~30 seconds
4. Check logs

---

### Step 3: Validate Data in Database

Run `VALIDATE-HYBRID-PERSONA-DATABASE.sql` in Supabase SQL Editor:

```sql
-- Check if HYBRID persona exists and is correct
SELECT 
  layer_0_intelligence->'business_identity'->>'system_persona' as "Business Identity"
FROM brand_profile_v5
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
```
Du er Café Faust.

LOCATION:
Ved åen i Aarhus (350.000 indbyggere, Danmarks næststørste by)
...

TILBUD:
Brunch & Frokost (09:00-17:30): pariserbøf, æggekage, burger
...
```

**Quality Checks:**
- ✅ Starts with "Du er Café Faust" (NOT "Du er en professionel...")
- ✅ Does NOT contain "professionel" or "ekspertise"
- ✅ Word count: 100-150 words
- ✅ Contains specific menu items (pariserbøf, burger, etc.)
- ✅ Contains city context (Aarhus, 350k)

---

## 📊 WHAT CHANGED IN DATABASE

### brand_profile_v5.layer_0_intelligence (NEW fields)

```json
{
  "business_type": { ... },
  
  // NEW: HYBRID business identity (100-150 words)
  "business_identity": {
    "system_persona": "Du er Café Faust. Ved åen...",
    "word_count": 120,
    "signature_items_count": 5,
    "programmes_count": 3,
    "city_context_used": true,
    "generated_at": "2026-05-20T..."
  },
  
  // NEW: AI-generated city context (cached 90 days)
  "city_context_ai": {
    "city": "Aarhus",
    "population": 350000,
    "city_size": "major_city",
    "cultural_context": "Danmarks næststørste by...",
    "ai_generated": false,
    "cached_until": "2026-08-20T..."
  },
  
  // LEGACY: Old consultant persona (kept for backward compatibility)
  "professional_persona": { ... },
  
  "geographic_context": { ... },
  "voice_archetype": { ... }
}
```

---

## 🔍 VERIFICATION CHECKLIST

After running Step 2 (Test), verify:

- [ ] city_context_cache table exists
- [ ] city_context_cache has 5 rows (København, Aarhus, Odense, Aalborg, Varde)
- [ ] brand_profile_v5 has new record for Café Faust
- [ ] layer_0_intelligence.business_identity exists
- [ ] layer_0_intelligence.business_identity.system_persona starts with "Du er Café Faust"
- [ ] Persona does NOT contain "professionel" or "ekspertise"
- [ ] Word count is 100-150
- [ ] city_context_ai exists with Aarhus data
- [ ] Function logs show "Business identity persona generated" message

---

## ⚠️ TROUBLESHOOTING

### If function fails with "city_context_cache does not exist"
→ Run Step 1 (create table in Supabase Dashboard)

### If persona contains "Du er en professionel..."
→ AI generation failed validation, check function logs
→ May need to regenerate

### If persona is too short (< 100 words) or too long (> 200 words)
→ AI prompt needs tuning
→ Check businessDataForPersona has complete data (menu items, hours, etc.)

### If city_context_ai is null
→ City context generation failed
→ Check if city_context_cache table exists
→ Check OpenAI API key is valid

---

## 📈 NEXT PHASE (Not Yet Implemented)

Phase 2: Update Brand Profile layers to USE persona
- Update commercial orientation generation to include persona context
- Update identity profile generation to include persona context
- Update voice profile generation with "always speak AS business" rule

Phase 3: Content Generation Integration
- Update generate-text-from-idea to use persona
- Update get-quick-suggestions to use persona

---

## 📝 FILES CREATED

1. `supabase/functions/_shared/brand-profile/city-context-ai.ts` (239 lines)
2. `supabase/functions/_shared/brand-profile/business-identity-persona.ts` (358 lines)
3. `supabase/migrations/20260520000000_city_context_cache_hybrid_persona.sql` (154 lines)
4. `RUN-IN-SUPABASE-DASHBOARD.sql` (simplified version for dashboard)
5. `VALIDATE-HYBRID-PERSONA-DATABASE.sql` (validation queries)
6. `test-hybrid-persona.cjs` (Node.js test script)
7. `DEPLOYMENT-CHECKLIST.md` (this file)

---

## 🎯 SUCCESS CRITERIA

**Phase 1 is COMPLETE when:**
- ✅ city_context_cache table created with 5 seeded cities
- ✅ Café Faust regeneration produces HYBRID persona
- ✅ Persona stored in database (business_identity field)
- ✅ Persona passes all quality checks (no "professionel", 100-150 words, starts with "Du er Café Faust")
- ✅ City context cached for 90 days (or 365 for manual entries)

**Current Status:** Code complete, awaiting database table creation and test.
