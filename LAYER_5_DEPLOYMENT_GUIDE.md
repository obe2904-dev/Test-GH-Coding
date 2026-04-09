# Layer 5 Deployment Guide

## ✅ Completed Components

All three Layer 5 components have been built and are ready for deployment:

### Component A: Menu Scoring Engine
- **File**: `supabase/functions/_shared/post-helpers/menu-scorer.ts`
- **Database**: `supabase/migrations/20260128000004_menu_scoring_columns.sql`
- **Status**: ✅ Complete - 7-factor scoring algorithm (seasonal, weather, location, performance, newness, recency)

### Component B: Non-Menu Opportunity Patterns
- **File**: `supabase/functions/_shared/post-helpers/compound-opportunities.ts` (enhanced)
- **Status**: ✅ Complete - Added 3 new patterns (Terrace Opening, Team Spotlight, Event Announcement)

### Component C: Weekly Planning Selector
- **File**: `supabase/functions/_shared/post-helpers/opportunity-selector.ts`
- **Status**: ✅ Complete - 6-step algorithm for optimal weekly content planning

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration

**Option A: Via Supabase Dashboard (Recommended for Cloud)**

1. Go to https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
2. Copy the entire contents of `supabase/migrations/20260128000004_menu_scoring_columns.sql`
3. Paste into the SQL Editor
4. Click "Run" button
5. Verify success message

**Option B: Via Supabase CLI (Local/Self-Hosted)**

```bash
cd /Users/olebaek/Test\ P2G\ 1
supabase db push
```

### Step 2: Verify Database Schema

Run this SQL query in Supabase Dashboard to confirm tables exist:

```sql
-- Check if tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('menu_item_metadata', 'seasonal_ingredients', 'opportunity_tracking');

-- Check seasonal ingredients populated
SELECT COUNT(*) as ingredient_count FROM seasonal_ingredients;
-- Should return ~50
```

### Step 3: Deploy Edge Functions

Upload the new/updated TypeScript files to Supabase:

```bash
# Deploy the updated functions
supabase functions deploy ai-generate --no-verify-jwt
# Or deploy all functions
supabase functions deploy --no-verify-jwt
```

**Note**: If you're using Make.com webhooks instead of direct Edge Functions, skip this step and continue using your existing webhook flow.

### Step 4: Populate Menu Item Metadata (Initial Setup)

For each business, you'll need to populate the `menu_item_metadata` table. Here's a helper script:

```sql
-- Example: Insert menu item metadata for a business
INSERT INTO menu_item_metadata (
  business_id,
  item_name,
  item_category,
  is_signature,
  is_seasonal,
  is_limited_time,
  dish_temp_category,
  item_added_date,
  seasonal_ingredients
) VALUES 
(
  'YOUR_BUSINESS_ID',
  'Grilled Salmon',
  'Main Course',
  true, -- signature dish
  true, -- seasonal
  false,
  'hot',
  NOW(),
  '["salmon", "asparagus"]'::jsonb
),
(
  'YOUR_BUSINESS_ID',
  'Caesar Salad',
  'Appetizer',
  false,
  false,
  false,
  'cold',
  NOW() - INTERVAL '90 days',
  '["lettuce", "tomatoes"]'::jsonb
);
```

**Better Approach**: Build a UI in your admin panel for staff to:
- Mark dishes as signature/seasonal/LTO
- Select temperature category (hot/cold/warm/neutral)
- Tag seasonal ingredients
- Set location tags (waterfront, quick_lunch, family_friendly, etc.)

### Step 5: Integration into Content Generation Flow

Update your content generation pipeline to use the new opportunity selector:

```typescript
import { selectWeeklyOpportunities } from './_shared/post-helpers/opportunity-selector.ts'

// In your weekly planning function
const weekStartDate = new Date()
const plan = await selectWeeklyOpportunities(businessId, weekStartDate)

// Use the plan slots to guide AI generation
for (const slot of plan.slots) {
  if (slot.selectedOpportunity) {
    // Pass to AI generation
    const prompt = buildPromptFromSlot(slot)
    // ... generate content
  }
}
```

---

## 📊 Testing the System

### Test 1: Menu Scoring

```typescript
import { scoreMenuItems } from './_shared/post-helpers/menu-scorer.ts'

const context = {
  businessId: 'YOUR_BUSINESS_ID',
  season: 'spring',
  currentMonth: 4,
  weatherForecast: {
    avgTemp: 18,
    condition: 'sunny'
  },
  locationScores: { waterfront: 85 },
  businessAvgEngagement: 0.05,
  countryCode: 'DK'
}

const scores = await scoreMenuItems(context)
console.log('Top 5 menu items:', scores.slice(0, 5))
```

### Test 2: Compound Opportunities

```typescript
import { detectCompoundOpportunities } from './_shared/post-helpers/compound-opportunities.ts'

const opportunities = await detectCompoundOpportunities(
  locationContext,
  weatherForecast,
  'spring',
  'YOUR_BUSINESS_ID',
  supabase
)

console.log('Detected opportunities:', opportunities)
```

### Test 3: Weekly Plan

```typescript
import { selectWeeklyOpportunities } from './_shared/post-helpers/opportunity-selector.ts'

const plan = await selectWeeklyOpportunities('YOUR_BUSINESS_ID', new Date())

console.log(`Plan: ${plan.summary.filledSlots}/${plan.summary.totalSlots} slots filled`)
console.log('Critical opportunities:', plan.summary.criticalOpportunities)

for (const slot of plan.slots) {
  console.log(`${slot.date.toLocaleDateString()} ${slot.hour}:00 - ${slot.contentType}`)
  console.log(`  → ${slot.selectionReason}`)
}
```

---

## 🎯 Success Metrics

Track these metrics to validate Layer 5 performance:

1. **Suggestion Acceptance Rate**: % of AI-suggested posts that users publish without edits
   - Target: 90%+

2. **Menu Item Coverage**: % of menu items posted at least once per season
   - Target: 80%+

3. **Opportunity Hit Rate**: % of detected critical opportunities that convert to posts
   - Target: 95%+

4. **Sequencing Quality**: Average days between posts of same content type
   - Target: 3+ days

5. **Performance Lift**: Avg engagement rate of Layer 5 posts vs Layer 2 baseline
   - Target: +20%

---

## ⚠️ Known Limitations & Future Enhancements

### Current Limitations

1. **Menu Data Dependency**: System requires manually populated menu_item_metadata table
   - **Fix**: Build menu item tagging UI or auto-extract from menu PDFs

2. **Weather Data**: Uses OpenWeather API which requires API key
   - **Status**: Should already be configured in Layer 3

3. **Country-Specific Seasonality**: Currently optimized for Denmark
   - **Fix**: Add seasonal_ingredients entries for other countries (US, UK, etc.)

4. **Manual Overrides**: No UI yet for users to override slot selections
   - **Fix**: Build weekly planning UI with drag-drop slot management

### Planned Enhancements

1. **Auto-Learning**: Use Layer 4 performance data to auto-adjust scoring weights
2. **Real-Time Weather Pivots**: React to sudden weather changes (e.g., unexpected heatwave)
3. **Competitive Intelligence**: Score opportunities based on local competitor posts
4. **Multi-Week Planning**: Generate 4-week plans with seasonal narrative arcs

---

## 📝 Maintenance Tasks

### Weekly
- Review unfilled slots and investigate why opportunities were insufficient
- Check critical opportunity conversion rate

### Monthly
- Update seasonal_ingredients database with trending ingredients
- Review scoring algorithm performance via Layer 4 data
- Adjust content type distribution based on performance

### Quarterly
- Add new opportunity patterns based on user feedback
- Expand seasonal_ingredients for new countries
- Review and update location tag taxonomy

---

## 🆘 Troubleshooting

### Issue: "No menu items found"
**Cause**: menu_item_metadata table is empty  
**Fix**: Populate initial menu data via SQL or build tagging UI

### Issue: "No seasonal ingredients matched"
**Cause**: Ingredient names don't match database or wrong country_code  
**Fix**: Check spelling, verify country_code in businesses table, add missing ingredients

### Issue: "Terrace opening triggered every week"
**Cause**: opportunity_tracking not recording posts  
**Fix**: Verify `track_opportunity_trigger()` function called after post publication

### Issue: "All slots have low confidence scores"
**Cause**: Insufficient performance data or recent posts blocking recency  
**Fix**: Wait 7+ days for recency to clear, ensure Layer 4 performance tracking running

### Issue: "TypeScript import errors"
**Cause**: Deno may not resolve local imports correctly  
**Fix**: Use absolute imports from Supabase Edge Functions root or adjust import maps

---

## ✅ Deployment Checklist

- [ ] Migration 20260128000004 applied successfully
- [ ] Verified 3 tables created (menu_item_metadata, seasonal_ingredients, opportunity_tracking)
- [ ] Verified ~50 seasonal ingredients populated
- [ ] Updated Edge Functions deployed (if using direct functions)
- [ ] Populated initial menu_item_metadata for at least 1 test business
- [ ] Tested menu scoring with sample data
- [ ] Tested compound opportunity detection
- [ ] Tested weekly plan generation
- [ ] Integrated into content generation pipeline
- [ ] Set up performance tracking dashboard
- [ ] Documented for team (how to tag menu items, interpret weekly plans)

---

## 🎉 Expected Results

Once deployed, you should see:

1. **Intelligent Menu Item Selection**: AI suggests seasonally appropriate menu items that match current weather and location context

2. **Timely Non-Menu Content**: System detects and suggests terrace opening announcements, team spotlights, and event promotions at optimal times

3. **Balanced Weekly Plans**: 7 posts/week with varied content types, no repetition, optimal timing per platform

4. **High Acceptance Rate**: Users publish 90%+ of suggested posts with minimal edits

5. **Performance Improvement**: +20% engagement rate vs baseline after 30 days

6. **Reduced Planning Time**: Weekly content planning reduced from 2 hours to 15 minutes

---

**Next Steps**: Apply the database migration (Step 1) and confirm tables created successfully.
