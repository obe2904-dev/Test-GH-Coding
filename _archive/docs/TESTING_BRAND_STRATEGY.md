# Brand Strategy System - Testing Guide

## 🎯 Implementation Complete!

The new brand strategy generation system is now fully implemented and ready to test.

## 📋 What Was Built

### 1. Strategy Generation System (5 files)
- **types.ts** - Complete type definitions with extensive WHY documentation
- **offeringsDetector.ts** - Deterministic weight-based offerings detection
- **audienceDeduction.ts** - Target audience scoring with location validation
- **goalDeduction.ts** - Communication goal selection (exactly 1 from pool)
- **generator.ts** - Main orchestrator tying everything together

### 2. Database Schema
- **Migration file**: `supabase/migrations/20260117000000_brand_strategy_model.sql`
- **New columns**: 15 new fields in business_brand_profile
- **Constraints**: Enforces max 3 offerings, max 2 audiences, valid pools
- **Locale support**: Added businesses.locale (default da-DK)

### 3. User Interface
- **BrandStrategyDisplay.tsx** - Danish UI with expandable reasoning
- **BrandProfilePageNew.tsx** - Complete page with generation flow
- **Route**: `/dashboard/brand-new`

## 🚀 Quick Start Testing

### Step 1: Apply Database Migration

1. Go to your Supabase dashboard
2. Open **SQL Editor**
3. Copy contents of `/supabase/migrations/20260117000000_brand_strategy_model.sql`
4. Paste and click **Run**
5. Verify success (should see "Success. No rows returned")

### Step 2: Navigate to New Page

```
http://localhost:3002/dashboard/brand-new
```

### Step 3: Generate Strategy

1. You should see empty state with "Generer brandprofil" button
2. Click the button
3. Wait 5-10 seconds (watch console for progress logs)
4. Review the 3 layers:
   - **Kernetilbud** (Core Offerings) - max 3
   - **Målgrupper** (Target Audiences) - max 2 primary
   - **Kommunikationsmål** (Communication Goal) - exactly 1

### Step 4: Verify Reasoning

1. Click "Hvorfor disse?" under each layer
2. Verify reasoning makes sense based on your data
3. Check confidence badges (høj/mellem/lav sikkerhed)

### Step 5: Approve and Save

1. Click "Godkend og gem" button
2. Strategy should be saved to database
3. Page should show approved state

## 🔍 What to Check

### Console Logs
During generation, you should see these logs:
```
🎯 Starting brand strategy generation...
📊 Collecting strategy inputs...
🍽️ Core offerings detected: [...]
👥 Target audience deduced: [...]
🎯 Communication goal selected: [...]
✅ Brand strategy generated successfully
```

### Database Verification

After generation, check `business_brand_profile` table:

```sql
SELECT 
  core_offerings,
  offerings_confidence,
  target_audience_primary,
  communication_goal,
  strategy_version,
  generated_at,
  approved_by_user
FROM business_brand_profile
WHERE business_id = 'your-business-id';
```

Should see:
- core_offerings array with 1-3 items
- target_audience_primary with 1-2 items
- communication_goal with exactly 1 value
- strategy_version = '1.0.0'
- approved_by_user = false (until you click approve)

### Constraint Validation

Try manually violating constraints in SQL Editor to verify they work:

```sql
-- Should FAIL - too many offerings
UPDATE business_brand_profile 
SET core_offerings = ARRAY['a', 'b', 'c', 'd']
WHERE business_id = 'your-id';
-- Error: violates check constraint "check_core_offerings_max_3"

-- Should FAIL - too many primary audiences
UPDATE business_brand_profile 
SET target_audience_primary = ARRAY['locals', 'families', 'tourists']
WHERE business_id = 'your-id';
-- Error: violates check constraint "check_primary_audiences_max_2"

-- Should FAIL - invalid audience
UPDATE business_brand_profile 
SET target_audience_primary = ARRAY['invalid_audience']
WHERE business_id = 'your-id';
-- Error: violates check constraint "check_primary_audiences_valid"
```

## 🧪 Test Scenarios

### Scenario 1: Coffee Shop with Specialty Coffee
**Expected:**
- Offerings: specialty_coffee, breakfast, possibly brunch
- Audience: locals, office_workers (if office location)
- Goal: drive_visits
- Confidence: High (if has specialty coffee signal + breakfast hours)

### Scenario 2: Restaurant with Natural Wine
**Expected:**
- Offerings: natural_wine, dinner, possibly lunch
- Audience: social_groups, locals
- Goal: increase_bookings
- Confidence: High (if has wine list + dinner hours)

### Scenario 3: Waterfront Location in Summer
**Expected:**
- Primary audience: locals + social_groups
- Seasonal modifier: "Tilføjer 'Turister' om sommeren pga. attraktiv havnebeliggenhed"
- Orange box showing seasonal addition

### Scenario 4: Missing Data
**Expected:**
- If no menu items: Error message "Sørg for at have udfyldt menu..."
- If no opening hours: Lower confidence, fewer offerings detected
- If no location intelligence: No location boost in audience scoring

## 📊 Weight Calculation Verification

Check console logs to see how weights are calculated:

```typescript
// Example for specialty coffee:
specialty_coffee weight: 55
  + 30 (menu category "kaffe")
  + 20 (has_specialty_coffee = true)
  + 10 (hasBreakfast = true)
  + 15 (mentioned in food_philosophy)
  = 75 points → HIGH CONFIDENCE
```

## 🐛 Common Issues

### Issue 1: "Kunne ikke generere brandprofil"
**Cause**: Missing required data (menu, hours, or location)
**Fix**: Ensure business has:
- At least 3 menu items
- Opening hours configured
- Location intelligence generated

### Issue 2: Low confidence for all layers
**Cause**: Sparse data or unclear patterns
**Fix**: 
- Add more menu items with clear categories
- Set specialty signals (hasSpecialtyCoffee, hasWineList)
- Add food_philosophy text
- Complete location intelligence

### Issue 3: No seasonal modifiers showing
**Cause**: Location category scores too low or not summer/winter
**Fix**: 
- Check location_intelligence category_scores
- Waterfront/tourist score should be > 60 for summer tourists
- Residential score should be > 60 for winter locals

### Issue 4: Wrong offerings detected
**Cause**: Menu categories don't match offering patterns
**Fix**: 
- Check OFFERING_PATTERNS keywords in offeringsDetector.ts
- Ensure menu categories use standard names (kaffe, brunch, vin, etc.)
- Add food_philosophy to boost relevant offerings

## 🔄 Regeneration Testing

1. Generate strategy once
2. Change menu items (add/remove categories)
3. Click "Generer igen" button
4. Verify new strategy reflects changes
5. Old strategy should be overwritten (but not approved)

## ✅ Success Criteria

✅ Generation completes in 5-10 seconds  
✅ Console logs show all deduction steps  
✅ 3 layers displayed with correct data  
✅ Reasoning makes sense for your business  
✅ Confidence badges match data quality  
✅ Approve saves to database correctly  
✅ Constraints prevent invalid data  
✅ Danish translations correct  
✅ Seasonal modifiers show when appropriate  
✅ Regeneration updates strategy correctly  

## 📝 Next Steps After Testing

1. **If working well**: Replace old brand profile page route
   ```typescript
   // In App.tsx, change:
   <Route path="brand" element={<BrandProfilePageNew />} />
   ```

2. **Add to onboarding flow**: Include strategy generation after location step

3. **Consider deprecating**: Old manual brandVoice/targetAudience fields

4. **Monitor**: Check generation logs for patterns and edge cases

5. **Iterate**: Adjust weights and rules based on real-world results

## 🎉 You're Ready!

The complete brand strategy system is implemented:
- ✅ Locked four-layer model
- ✅ Deterministic offerings detection
- ✅ Location-validated audience deduction
- ✅ Single goal selection
- ✅ Database constraints enforcing rules
- ✅ Danish UI with explainability
- ✅ Seasonal audience modifiers

Navigate to `/dashboard/brand-new` and start testing! 🚀
