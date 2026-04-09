# Layer 5 Testing Guide

Complete step-by-step testing procedure for Layer 5 (Content Opportunity Matching).

---

## Prerequisites

- Migration file selected: `supabase/migrations/20260128000004_menu_scoring_columns.sql`
- Supabase project: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn
- `.env` file with credentials (already configured)

---

## Step 1: Apply Migration (5 minutes)

### Via Supabase Dashboard (Recommended)

1. **Open SQL Editor**: 
   - https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

2. **Copy Migration**:
   - Open `supabase/migrations/20260128000004_menu_scoring_columns.sql`
   - Select all (Cmd+A) → Copy (Cmd+C)

3. **Execute**:
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for "Success" message (should take ~2 seconds)

4. **Verify**:
   - Open `test-layer5-step1-verify.sql`
   - Copy and paste into SQL Editor
   - Click "Run"
   - Expected output:
     ```
     ✅ All 3 tables created
     ✅ Seasonal ingredients populated (50+ entries)
     ✅ Both helper functions created
     ```

**If verification passes, proceed to Step 2.**

---

## Step 2: Populate Test Data (3 minutes)

1. **Get Business ID**:
   ```sql
   SELECT id, business_name FROM businesses LIMIT 5;
   ```
   Copy one `id` value.

2. **Update Test Script**:
   - Open `test-layer5-step2-populate.sql`
   - Find line 13: `v_business_id UUID := 'YOUR_BUSINESS_ID_HERE';`
   - Replace with your actual business ID
   - Save file

3. **Execute**:
   - Copy entire file
   - Paste into Supabase SQL Editor
   - Click "Run"
   - Expected output:
     ```
     NOTICE: ✅ Using business ID: ...
     NOTICE: ✅ Inserted 7 test menu items
     ```

4. **Verify Data**:
   The script automatically shows inserted items:
   - Should see 7 menu items
   - Including: Grilled Salmon, Spring Lamb, Caesar Salad, etc.
   - Various scoring attributes (signature, seasonal, LTO flags)

**If 7 items shown, proceed to Step 3.**

---

## Step 3: Test Menu Scoring (5 minutes)

1. **Update Test Script**:
   - Open `test-layer5-step3-score.ts`
   - Line 14: Replace `'YOUR_BUSINESS_ID_HERE'` with your business ID
   - Save file

2. **Run Test**:
   ```bash
   deno run --allow-env --allow-net test-layer5-step3-score.ts
   ```

3. **Expected Output**:
   ```
   🧪 LAYER 5 TEST - Menu Scoring Engine

   ✅ Testing with business: [Your Business Name]
      Country: DK
      Avg engagement: 5.0%

   📊 Scoring Context:
      Season: spring
      Month: 4 (April)
      Weather: sunny, 18°C

   ⚡ Scoring menu items...

   📋 Results: 7 menu items scored

   1. Spring Lamb with New Potatoes
      Final Score: 205 points
      Post-Worthiness: HIGH
      Reason: Strong posting candidate - timely and relevant
      
      Score Breakdown:
        Base Score: 75
        + Seasonal: 50 (lamb, new potatoes, peas)
        + Weather: 35 (warm comfort food + cool weather)
        + Newness: 45 (brand new item - 5 days)
        ...
   
   2. Grilled Salmon with Asparagus
      Final Score: 195 points
      Post-Worthiness: HIGH
      ...
   
   ⛔ Blocked Items (1):
      • Classic Burger: Posted too recently (3 days ago)
   
   📊 Summary:
      Critical opportunities: 0
      High priority: 2
      Medium priority: 3
      Low priority: 1
      Blocked: 1
   
   ✅ Menu scoring test complete!
   ```

4. **Validate Results**:
   - [ ] Spring Lamb scores HIGH (newness + seasonal bonuses)
   - [ ] Grilled Salmon scores HIGH (signature + seasonal)
   - [ ] Classic Burger BLOCKED (posted 3 days ago)
   - [ ] Ice cream scores LOW (wrong season - it's spring not summer)
   - [ ] Scores include detailed reasoning

**If scoring works correctly, proceed to Step 4.**

---

## Step 4: Test Compound Opportunities (3 minutes)

1. **Update Test Script**:
   - Open `test-layer5-step4-opportunities.ts`
   - Line 9: Replace `'YOUR_BUSINESS_ID_HERE'`
   - Save file

2. **Run Test**:
   ```bash
   deno run --allow-env --allow-net test-layer5-step4-opportunities.ts
   ```

3. **Expected Output**:
   ```
   🧪 LAYER 5 TEST - Compound Opportunities Detector

   📊 Context:
      Location: Waterfront (85), Tourist area (60), Outdoor seating ✓
      Weather: 3 days of warm weather (18-20°C, sunny)
      Season: Spring

   ⚡ Detecting opportunities...

   📋 Results: 3-6 opportunities detected

   1. Amplify outdoor terrace with harbor views
      Priority: CRITICAL
      Score: 250
      Platform: instagram
      Time-Sensitive: ⚠️ YES
      
      Triggers:
        Location: outdoor_seating, waterfront
        Weather: clear, 18°C
        Season: spring
      ...
   
   🧪 Testing Pattern 7: Terrace Opening
      ✅ DETECTED - Terrace opening opportunity found!
      Score: 250 (should be 250)
      Priority: critical (should be critical)
   
   ✅ Compound opportunities test complete!
   ```

4. **Validate Results**:
   - [ ] Multiple opportunities detected (outdoor seating, waterfront, tourist, etc.)
   - [ ] Pattern 7 (Terrace Opening) detected if not announced this year
   - [ ] Each opportunity has clear reasoning and prompt hints
   - [ ] Scores range from 50-250 based on priority

**If opportunities detected, proceed to Step 5.**

---

## Step 5: Test Weekly Planning (5 minutes)

1. **Update Test Script**:
   - Open `test-layer5-step5-weekly-plan.ts`
   - Line 9: Replace `'YOUR_BUSINESS_ID_HERE'`
   - Save file

2. **Run Test**:
   ```bash
   deno run --allow-env --allow-net test-layer5-step5-weekly-plan.ts
   ```

3. **Expected Output**:
   ```
   🧪 LAYER 5 TEST - Weekly Planning Selector

   📅 Generating weekly plan starting: 1/28/2026

   ⚡ Running 6-step algorithm...
      1. Generate all opportunities (menu + compound)
      2. Allocate slots by type (Layer 2 distribution)
      3. Fill slots with highest-scoring opportunities
      4. Apply sequencing rules (variety, spacing)
      5. Assign optimal timing (day + hour)
      6. Handle edge cases

   ✅ Weekly plan generated!

   📊 PLAN SUMMARY:
      Week: 1/28/2026 - 2/4/2026
      Total Slots: 7
      Filled Slots: 7
      Menu Items: 3
      Non-Menu: 4
      Critical Opportunities: 1

      Platform Distribution:
        Instagram: 4
        Facebook: 2
        Both: 1

   📋 WEEKLY SCHEDULE:

   1. Monday 1/28/2026 at 12:00
      Type: menu_item
      Platform: instagram
      Expected Performance: HIGH
      Confidence: 97/100
      
      Selected: Spring Lamb with New Potatoes
      Score: 205 points
      Reason: Highest-scoring menu item - brand new, seasonal match
      
      Alternatives:
        • Grilled Salmon with Asparagus (195 pts)
        • Wild Mushroom Risotto (160 pts)
   
   2. Tuesday 1/29/2026 at 18:00
      Type: atmosphere_experience
      Platform: instagram
      Expected Performance: CRITICAL
      Confidence: 100/100
      
      Selected: terrace_opening
      Score: 250 points
      Reason: Announce terrace opening for the season
      ...
   
   📈 EXPECTED OUTCOMES:
      Fill Rate: 100% (target: 100%)
      Critical Opportunities: 1 (don't miss these!)
      Average Confidence: 85/100

   ✅ Weekly planning test complete!

   🎉 All Layer 5 components validated!

   Ready for production integration.
   ```

4. **Validate Results**:
   - [ ] All 7 slots filled (100% fill rate)
   - [ ] Menu items and compound opportunities balanced
   - [ ] No consecutive identical content types
   - [ ] Each slot has clear reasoning and alternatives
   - [ ] Confidence scores reasonable (50-100)
   - [ ] Critical opportunities scheduled early in week
   - [ ] Platform distribution makes sense

---

## ✅ Testing Complete

If all 5 steps passed:

### Validation Checklist
- [x] Database migration applied successfully
- [x] 3 tables created (menu_item_metadata, seasonal_ingredients, opportunity_tracking)
- [x] 50+ seasonal ingredients populated
- [x] 7 test menu items inserted
- [x] Menu scoring algorithm works (7 factors)
- [x] Compound opportunities detected (9 patterns)
- [x] Weekly plan generated (7 slots, balanced)
- [x] Scores and reasoning accurate

### Next Steps

**Option 1: Test with Real Business (Recommended)**
1. Pick an actual business with real menu data
2. Manually populate `menu_item_metadata` for 10-15 menu items
3. Run weekly planner
4. Review results with business owner
5. Iterate based on feedback

**Option 2: Build Integration**
1. Wire `opportunity-selector.ts` into content generation pipeline
2. Build UI to display weekly plan
3. Enable user overrides
4. Add "Generate Post" button that uses selected opportunities

**Option 3: Production Deployment**
1. Build menu item tagging UI for staff
2. Enable automatic weekly plan generation (Monday mornings)
3. Set up performance monitoring
4. Track success metrics (acceptance rate, engagement lift)

---

## Troubleshooting

### "Business ID not found"
- Run: `SELECT id, business_name FROM businesses LIMIT 5;`
- Copy a valid `id` and update test scripts

### "No menu items found"
- Ensure Step 2 completed successfully
- Check: `SELECT * FROM menu_item_metadata;`
- Should show 7 items

### "Deno command not found"
- Install: `brew install deno` (macOS)
- Or use Node.js with ts-node

### "No opportunities detected"
- Normal if conditions not met
- Try different season/weather in test scripts
- Check opportunity_tracking table for existing announcements

### Import errors in TypeScript
- Ensure all paths are correct
- Check that shared helper files exist
- Use absolute paths if needed

---

## Performance Expectations

- Migration execution: ~2 seconds
- Menu scoring (7 items): <100ms
- Opportunity detection: <200ms
- Weekly plan generation: <500ms
- Total end-to-end: <1 second

---

**Status**: Ready for testing ✅  
**Time Required**: ~25 minutes total  
**Next**: Run Step 1 to apply migration
