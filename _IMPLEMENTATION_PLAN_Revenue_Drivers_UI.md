## AI Revenue Drivers - Brand Profile Integration Plan

### Overview
Integrate AI-powered revenue driver analysis into the brand profile workflow and create UI to display and manage revenue drivers.

---

## Phase 1: Backend Integration (30 min)

### Task 1.1: Add Revenue Driver Call to Brand Profile Generator
**File:** `supabase/functions/brand-profile-generator/index.ts`

**Changes:**
1. Import analyze-revenue-drivers logic
2. Call after successful brand profile generation
3. Store results in brand_profile_v5.revenue_drivers

**Code Location:** After line ~800 where brand profile is saved

```typescript
// After saving brand profile successfully
if (savedProfile.success) {
  console.log(`[${requestId}] 🎯 Triggering revenue driver analysis...`)
  
  // Call analyze-revenue-drivers function
  const revenueDriversResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-revenue-drivers`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        business_id: businessId,
        force_refresh: true
      })
    }
  )
  
  const revenueDriversData = await revenueDriversResponse.json()
  
  if (revenueDriversData.success) {
    console.log(`[${requestId}] ✅ Revenue drivers generated: ${revenueDriversData.analysis_method}`)
  } else {
    console.warn(`[${requestId}] ⚠️  Revenue drivers failed:`, revenueDriversData.error)
    // Don't fail the whole request - revenue drivers are optional
  }
}
```

---

## Phase 2: Frontend UI Components (60 min)

### Task 2.1: Create Revenue Drivers Display Component
**File:** `src/components/brand-profile/RevenueDriversCard.tsx`

**Purpose:** Display revenue drivers with visual hierarchy

**Features:**
- Show primary revenue moment
- List secondary moments
- Display decision windows
- Show post timing rules
- Regenerate button

### Task 2.2: Create Revenue Moment Detail Component  
**File:** `src/components/brand-profile/RevenueMomentDetail.tsx`

**Purpose:** Expandable detail view for each revenue moment

**Features:**
- Service type and days
- Decision pattern visualization
- Decision windows with conversion strength
- Post timing recommendations
- Content focus tags

### Task 2.3: Add to Business Profile Page
**File:** `src/pages/dashboard/index.tsx`

**Changes:**
1. Add new section after Social Media Connections
2. Fetch revenue drivers from Supabase
3. Show loading/error states
4. Add manual regenerate button

---

## Phase 3: API Integration (20 min)

### Task 3.1: Create Supabase Hook
**File:** `src/hooks/useRevenueDrivers.ts`

**Purpose:** React hook to fetch and manage revenue drivers

**Features:**
- Fetch from business_brand_profile.revenue_drivers
- Manual refresh function
- Loading and error states
- Cache management

### Task 3.2: Create Revenue Driver Service
**File:** `src/services/revenueDrivers.ts`

**Purpose:** API calls to analyze-revenue-drivers function

**Features:**
- Trigger analysis
- Force refresh
- Handle errors

---

## Phase 4: Testing & Validation (30 min)

### Task 4.1: Test Brand Profile Generation
1. Generate new brand profile for Cafe Faust
2. Verify revenue drivers are created automatically
3. Check both structured programme and AI text paths

### Task 4.2: Test UI Display
1. Verify revenue drivers display correctly
2. Test manual regenerate
3. Test loading states
4. Test error handling

### Task 4.3: Validate Weekly Plan Integration
1. Generate weekly plan
2. Verify it uses revenue drivers
3. Check logs for BusinessRulesEngine

---

## Success Criteria

✅ **Backend:**
- Brand profile generator calls analyze-revenue-drivers
- Revenue drivers stored in database
- Both programme-based and AI-based analysis work

✅ **Frontend:**
- Revenue drivers visible in Business Profile page
- Clear visualization of primary/secondary moments
- Manual regenerate button works
- Loading and error states handled

✅ **Integration:**
- Weekly Plan uses revenue drivers
- Consistent day allocation across sessions
- Revenue driver changes reflected in new plans

---

## Timeline

- **Phase 1:** 30 minutes
- **Phase 2:** 60 minutes  
- **Phase 3:** 20 minutes
- **Phase 4:** 30 minutes

**Total:** ~2.5 hours

---

## File Summary

### New Files (5):
1. `src/components/brand-profile/RevenueDriversCard.tsx`
2. `src/components/brand-profile/RevenueMomentDetail.tsx`
3. `src/hooks/useRevenueDrivers.ts`
4. `src/services/revenueDrivers.ts`
5. `_IMPLEMENTATION_PLAN_Revenue_Drivers_UI.md` (this file)

### Modified Files (2):
1. `supabase/functions/brand-profile-generator/index.ts`
2. `src/pages/dashboard/index.tsx`

---

## Next Steps

**Option A: Full Implementation**
I can implement all 4 phases now (~2.5 hours of work)

**Option B: Backend First**
Implement Phase 1 only (30 min), test, then do frontend

**Option C: Frontend First**
Build UI components with mock data, then connect backend

**Which approach would you prefer?**
