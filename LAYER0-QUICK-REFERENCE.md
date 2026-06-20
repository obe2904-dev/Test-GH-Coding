# LAYER 0 PERSONA - QUICK REFERENCE
## Fast guide for checking persona quality

---

## 🎯 THE 5-MINUTE PERSONA TEST

### 1. Does Full System Prompt Exist?
```sql
SELECT LENGTH(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt') 
FROM business_brand_profile 
WHERE business_id = 'YOUR_BUSINESS_ID';
```
**✅ PASS:** > 500 characters  
**❌ FAIL:** NULL or < 500 characters

---

### 2. Is Business Type Confident?
```sql
SELECT brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence' 
FROM business_brand_profile 
WHERE business_id = 'YOUR_BUSINESS_ID';
```
**✅ PASS:** ≥ 0.7 (70%)  
**⚠️ REVIEW:** 0.5-0.7 (50-70%)  
**❌ FAIL:** < 0.5 (50%)

---

### 3. Are Voice Rules Specific?
```sql
SELECT jsonb_pretty(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') 
FROM business_brand_profile 
WHERE business_id = 'YOUR_BUSINESS_ID';
```
**✅ PASS:** 6-17 specific rules (not generic)  
**❌ FAIL:** < 6 rules OR generic phrases like "be authentic"

---

### 4. Is Location Context Rich?
```sql
SELECT 
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'signature_reference',
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'location_type'
FROM business_brand_profile 
WHERE business_id = 'YOUR_BUSINESS_ID';
```
**✅ PASS:** Has signature reference (e.g., "ved åen") AND location type  
**❌ FAIL:** NULL or generic

---

### 5. Does Persona Make Sense?
**Manual Review Checklist:**
- [ ] Formality matches business type (casual cafe = casual_friend ✅)
- [ ] Voice rules are actionable ("Use X" not "Be Y")
- [ ] Geographic tone matches city (Aarhus ≠ Copenhagen tone)
- [ ] Business type matches actual offering (menu analysis)

---

## 🔍 CAFE FAUST EXAMPLE (Expected Results)

### Business Type
```
Type: casual_dining
Confidence: 0.7
Reasoning: "Frokost/middag program uden morgenmad"
```
**✅ CORRECT** - Has lunch/dinner, no breakfast = casual dining

---

### Voice Archetype
```
ID: restaurant_approachable
Rules: [
  "Menu-highlights og chef-anbefalinger",
  "Seasonal ingredients og skiftende menu",
  "Dining experience storytelling",
  ...6 total
]
```
**✅ CORRECT** - Specific, actionable, restaurant-focused

---

### Geographic Context
```
Location: ved åen (waterfront_leisure)
City: Aarhus (medium_city)
Tone: "Casual og tilgængelig. Balance mellem urban cool og approachable."
```
**✅ CORRECT** - Specific location, appropriate tone for Aarhus

---

### Professional Persona
```
Formality: casual_friend
Style: conversational
Emoji: moderate
```
**✅ CORRECT** - Matches casual dining + Aarhus student demographic

---

## ⚠️ RED FLAGS (Fix Before Integration)

### ❌ Generic Voice Rules
**Bad Example:**
- "Be authentic"
- "Engage customers"
- "Show personality"

**Good Example:**
- "Reference seasonal menu changes weekly"
- "Include 1-2 Danish food terms per post"
- "End with location reference when relevant"

---

### ❌ Mismatched Formality
**Bad:**
- Fine dining restaurant → `casual_friend` ❌
- Student bar → `formal_professional` ❌

**Good:**
- Fine dining → `professional` or `formal_professional` ✅
- Student bar → `casual_friend` ✅

---

### ❌ Low Confidence Business Type
**If confidence < 0.7:**
1. Check if menu data exists
2. Verify establishment_type is set
3. Review programme detection results
4. Consider manual business type override

---

### ❌ Missing System Prompt
**If system_prompt is NULL:**
1. Check if generation completed
2. Look for errors in function logs
3. Verify professional-persona.ts is generating full prompt
4. May need to regenerate brand profile

---

## 📋 QUICK VALIDATION WORKFLOW

### Step 1: Run Master Query
```sql
-- Run query #11 from VALIDATE-LAYER0-QUALITY.sql
-- This gives complete scorecard
```

### Step 2: Check Results
- **All ✅?** → READY FOR INTEGRATION
- **Any ❌?** → Review specific component
- **Unsure?** → Do manual review below

### Step 3: Manual Review
1. Read system_prompt - does it sound like good instructions?
2. Read voice rules - are they specific to this business?
3. Check business type - does it match what you see in menu/operations?
4. Verify location context - is it accurate?

### Step 4: Test in Practice
1. Copy system_prompt
2. Paste into ChatGPT/Claude
3. Ask it to generate a social media post
4. Does the output match expected voice?

**✅ If yes → Layer 0 is ready**  
**❌ If no → Identify what's wrong and regenerate**

---

## 🎨 VOICE ARCHETYPE REFERENCE

### Common Archetypes
- `restaurant_approachable` - Casual dining, everyday restaurants
- `bar_social` - Bars, nightlife venues
- `cafe_cozy` - Coffee shops, breakfast cafes
- `fine_dining_refined` - Upscale restaurants
- `bistro_local` - Neighborhood bistros

### How to Verify Correct Archetype
1. Check business_type detection
2. Review programme types (brunch/lunch/dinner/drinks)
3. Look at price tier if available
4. Consider location context (waterfront casual ≠ downtown formal)

---

## 🚨 SHOW-STOPPERS (Must Fix)

**These prevent integration - fix immediately:**

1. **No System Prompt**
   - Can't use persona in AI calls
   - FIX: Update generation code to save full prompt

2. **Confidence < 0.5**
   - Business type likely wrong
   - FIX: Improve detection or add manual override

3. **< 5 Voice Rules**
   - Too generic to be useful
   - FIX: Expand voice archetype definitions

4. **NULL Location Type**
   - Missing key context
   - FIX: Verify postal code → city mapping

---

## ✅ INTEGRATION READY CRITERIA

**All must be TRUE:**
- [x] Full system_prompt exists (>500 chars)
- [x] Business type confidence ≥ 0.7
- [x] 6-17 specific voice rules
- [x] Signature location reference exists
- [x] Formality/style/emoji defined
- [x] Manual review confirms accuracy
- [x] Test prompt generates good output

**When all checked → SAFE TO INTEGRATE**

---

## 📞 TESTING COMMAND

**One-line test:**
```bash
psql -d YOUR_DB -c "
SELECT 
  CASE WHEN COUNT(*) FILTER (WHERE system_prompt_len > 500) = 1 
    AND COUNT(*) FILTER (WHERE confidence >= 0.7) = 1
    AND COUNT(*) FILTER (WHERE rule_count BETWEEN 6 AND 17) = 1
  THEN '✅ READY' ELSE '❌ NOT READY' END as status
FROM (
  SELECT 
    LENGTH(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt') as system_prompt_len,
    (brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence')::float as confidence,
    jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') as rule_count
  FROM business_brand_profile 
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
) t;
"
```

---

## 📚 RELATED FILES

- **Full Plan:** [LAYER0-PERSONA-INTEGRATION-PLAN.md](LAYER0-PERSONA-INTEGRATION-PLAN.md)
- **Validation Queries:** [VALIDATE-LAYER0-QUALITY.sql](VALIDATE-LAYER0-QUALITY.sql)
- **Data Flow:** [PERSONA-DATA-FLOW.md](PERSONA-DATA-FLOW.md)
- **Cafe Faust Check:** [CHECK-PERSONA.sql](CHECK-PERSONA.sql)
