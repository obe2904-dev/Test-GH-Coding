# Brand Profile Testing Guide

## Quick Test Checklist

### Prerequisites
1. Navigate to: `http://localhost:5173/dashboard/brand-profile`
2. Ensure you're logged in with a business account
3. Ensure Business Profile has been completed (for auto-detection to work)

---

## Test 1: WHO Tab ✅

**Goal:** Verify target audience selection and persistence

### Steps:
1. **Load Page**
   - Page should load on WHO tab by default
   - Auto-detected audiences should be pre-checked
   - Blue info box should show detected signals

2. **Check Auto-Detection**
   - Look for "Auto-detekteret" badges on suggested audiences
   - Read explanations (should match business profile)
   - Example: "Professionals - Åbner tidligt (morgenmad/morgenkaffe)"

3. **Modify Selection**
   - Toggle some checkboxes on/off
   - Verify count updates: "X målgrupper valgt"
   - Verify "Gem ændringer" button becomes gradient (enabled)

4. **Save**
   - Click "Gem ændringer"
   - Button should show "Gemmer..." then "Gemt"
   - Console should log: `✅ Brand profile WHO saved`

5. **Verify Persistence**
   - Refresh the page
   - Selections should persist
   - Try "Nulstil til auto-detekteret" - should reset to original state

**Expected Result:** ✅ All selections save and load correctly from database

---

## Test 2: WHEN Tab ⚠️

**Goal:** Verify posting preferences UI (no persistence yet)

### Steps:
1. **Switch to WHEN Tab**
   - Click "WHEN" button in tab navigation
   - Tab should highlight in indigo
   - WHO section should disappear, WHEN section should appear

2. **Select Posting Frequency**
   - Try each radio button option:
     - 1-2 times per week
     - 3-4 times per week ✓ (default)
     - 5-7 times per week
     - Multiple times daily
   - Only one should be selected at a time
   - "Gem ændringer" button should enable

3. **Select Best Posting Times**
   - Check multiple time slots:
     - Morgenmad (6-9)
     - Formiddag (9-12)
     - Frokost (12-15)
     - Eftermiddag (15-18)
     - Aften (18-21)
     - Sen aften (21-24)
   - Multiple selections allowed
   - Cards should highlight when selected

4. **Save**
   - Click "Gem ændringer"
   - Console should log: `✅ Brand profile WHEN saved`

5. **Verify State (No Persistence)**
   - Refresh page
   - WHEN data will reset to defaults (frequency: "3-4 times per week", times: empty)
   - This is expected - database fields not added yet

**Expected Result:** ⚠️ UI works, but data doesn't persist (needs schema update)

---

## Test 3: WHY Tab ✅

**Goal:** Verify brand voice configuration and persistence

### Steps:
1. **Switch to WHY Tab**
   - Click "WHY" button in tab navigation
   - Tab should highlight in indigo
   - WHY section should appear with 5 input fields

2. **Fill in Brand Voice**
   - **Brand stemme/tone:** "venlig og autentisk"
   - Should enable "Gem ændringer" button

3. **Fill in Tone Keywords**
   - **Tone nøgleord:** "lokal, kvalitet, passion"
   - Comma-separated input
   - Should split on save

4. **Fill in Brand Values**
   - **Brand værdier:** "bæredygtighed, fællesskab, kvalitet"
   - Comma-separated input

5. **Fill in Certifications (Optional)**
   - **Certificeringer:** "økologisk certificeret"
   - Can be left empty

6. **Fill in Do Not Say (Optional)**
   - **Ord at undgå:** "billig, hurtig, discount"
   - Can be left empty

7. **Save**
   - Click "Gem ændringer"
   - Console should log: `✅ Brand profile WHY saved`

8. **Verify Persistence**
   - Refresh page
   - Click WHY tab
   - All filled fields should persist
   - Comma-separated values should display correctly

**Expected Result:** ✅ All WHY data saves and loads correctly from database

---

## Test 4: Tab Switching

**Goal:** Verify smooth navigation between tabs

### Steps:
1. **Make Changes in WHO**
   - Toggle some audiences
   - DON'T save
   - Note: "Gem ændringer" should be enabled

2. **Switch to WHEN**
   - Click WHEN tab
   - WHO changes indicator still present (no warning - expected behavior)

3. **Switch to WHY**
   - Click WHY tab
   - Previous unsaved changes won't be lost unless you save a different tab

4. **Return to WHO**
   - Click WHO tab
   - Unsaved changes should still be there

5. **Save WHO**
   - Click "Gem ændringer"
   - Should only save WHO data, not WHEN or WHY

**Expected Result:** ✅ Tab switching works, each tab saves independently

---

## Test 5: Unsaved Changes Indicator

**Goal:** Verify save button state management

### Steps:
1. **No Changes State**
   - Load page
   - Save button should be gray and disabled
   - Text: "Gemt"

2. **Make Changes**
   - Toggle any checkbox or fill any field
   - Button should become gradient (indigo→purple)
   - Text: "Gem ændringer"

3. **Save Changes**
   - Click save button
   - Button should show "Gemmer..."
   - Then return to gray "Gemt" state

4. **Make More Changes**
   - Modify any field again
   - Button should re-enable with gradient

**Expected Result:** ✅ Save button state accurately reflects unsaved changes

---

## Database Verification

### Check WHO Data:
```sql
SELECT
  business_id,
  target_audiences,
  updated_at
FROM business_brand_profile
WHERE business_id = 'YOUR_BUSINESS_ID';
```

Expected:
```
target_audiences: ["Locals", "Professionals", "Foodies", ...]
```

### Check WHY Data:
```sql
SELECT
  business_id,
  voice_style,
  tone_keywords,
  values,
  certifications,
  updated_at
FROM business_brand_profile
WHERE business_id = 'YOUR_BUSINESS_ID';
```

Expected:
```
voice_style: "venlig og autentisk"
tone_keywords: ["lokal", "kvalitet", "passion"]
values: ["bæredygtighed", "fællesskab", "kvalitet"]
certifications: ["økologisk certificeret"]
```

---

## Known Issues & Limitations

### ⚠️ WHEN Data Not Persisting
**Issue:** Best posting times and frequency reset on page reload

**Reason:** Database fields `best_posting_times` and `posting_frequency` don't exist yet

**Fix:** Run this migration:
```sql
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS best_posting_times TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS posting_frequency TEXT DEFAULT '3-4 times per week';
```

Then uncomment lines 125-126 (load) and 170-171 (save) in BrandProfilePage.tsx

### ⚠️ do_not_say JSONB Parsing
**Issue:** "Do not say" words don't persist

**Reason:** Field is JSONB but code treats it as string array

**Fix:** Update lines 133 and 177 in BrandProfilePage.tsx:
```typescript
// Line 133 (load)
const doNotSayData = profileData.do_not_say as { words?: string[] } | null
setDoNotSay(doNotSayData?.words || [])

// Line 177 (save)
updateData.do_not_say = { words: doNotSay }
```

### ℹ️ No Tab Switch Warning
**Behavior:** Switching tabs with unsaved changes doesn't warn user

**Impact:** Low - each tab saves independently, no data loss

**Optional Enhancement:** Add confirmation dialog on tab switch if hasUnsavedChanges

---

## Success Criteria

- ✅ All three tabs render correctly
- ✅ WHO data persists to database
- ✅ WHY data persists to database (except do_not_say JSONB)
- ⚠️ WHEN data UI works but doesn't persist (needs schema)
- ✅ Tab switching works smoothly
- ✅ Save button state reflects unsaved changes
- ✅ No TypeScript errors
- ✅ No console errors
- ✅ Auto-detection works for WHO

---

## Quick Smoke Test (2 minutes)

1. Load page → WHO tab shows ✅
2. Toggle 2 audiences → Save → Refresh → Still selected ✅
3. Switch to WHEN → Select frequency → Times → Save ✅ (UI only)
4. Switch to WHY → Fill voice + keywords → Save → Refresh → Still there ✅
5. Check console → No errors ✅

**If all ✅, implementation is ready for use!**
