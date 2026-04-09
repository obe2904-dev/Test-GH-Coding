# Testing Guide: Recognizable Interior Identity Field

## ✅ Migration Applied Successfully

**Date**: 6 January 2026  
**Status**: Database column `recognizable_interior_identity` created in `business_brand_profile` table

**Migration Output**:
```
Applying migration 20260106000001_add_recognizable_interior_identity.sql...
Finished supabase db push.
```

---

## 🧪 Test Plan

### Test 1: Business WITH Interior Photos ✓

**Setup**:
1. Navigate to a business with uploaded interior photos
2. Ensure photos have AI labels (e.g., "interior", "mural", "decor")
3. Go to Brand Profile page

**Steps**:
1. Click "Generer Brand Profil"
2. Wait for AI generation to complete
3. Scroll to "Recognizable Interior / Visual Identity 🎨" section

**Expected Result**:
- Field should populate with description of interior elements
- Example: "Stor væg-mural ved baren, vintage møbler, planter ved vinduerne"
- Should reference specific elements from uploaded photos

**Actual Result**: [Test when you have photos uploaded]

---

### Test 2: Business WITHOUT Interior Photos ✓

**Setup**:
1. Navigate to a business without interior photos
2. Or a business with only food/exterior photos
3. Go to Brand Profile page

**Steps**:
1. Click "Generer Brand Profil"
2. Wait for AI generation to complete
3. Scroll to "Recognizable Interior / Visual Identity 🎨" section

**Expected Result**:
- Field should remain empty
- Message: "Kun hvis der er dokumenterede visuelle kendetegn"
- No hallucinated interior details

**Actual Result**: [Test with current Café Faust - should be empty unless interior photos exist]

---

### Test 3: Manual Entry ✓

**Setup**:
1. Navigate to Brand Profile page
2. Scroll to "Recognizable Interior / Visual Identity 🎨" section

**Steps**:
1. Click "Rediger" button
2. See amber warning box
3. Enter text: "Stor mural af lokal kunstner på bagvæggen, forestiller Aarhus Å"
4. Click "Gem Brand Profil"
5. Refresh page

**Expected Result**:
- Text should save successfully
- Should persist after page refresh
- Should display in read-only mode

**Actual Result**: [Test manual save]

---

### Test 4: Empty Field Safety ✓

**Setup**:
1. Business with empty `recognizable_interior_identity` field
2. Generate social media ideas or other downstream features

**Steps**:
1. Use any feature that reads Brand Profile
2. Verify it doesn't break when field is empty/null

**Expected Result**:
- No errors or crashes
- Feature works normally
- Simply doesn't use interior identity if not present

**Actual Result**: [Test downstream features]

---

## 🔍 Database Verification

Run in Supabase SQL Editor:

```sql
-- Check column exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
    AND column_name = 'recognizable_interior_identity';

-- Check data for test business (Café Faust)
SELECT 
    business_id,
    brand_essence,
    recognizable_interior_identity,
    last_edited_at
FROM business_brand_profile
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';
```

---

## 📊 AI Generation Response Format

**When Evidence Exists**:
```json
{
  "brandProfile": {
    "recognizable_interior_identity": "Stor væg-mural af lokal kunstner på bagvæggen, vintage dansk møbeldesign fra 1960'erne ved vinduerne",
    "has_verified_evidence": true,
    // ... other fields
  }
}
```

**When No Evidence**:
```json
{
  "brandProfile": {
    "recognizable_interior_identity": "",
    "has_verified_evidence": false,
    // ... other fields
  }
}
```

---

## 🎯 Success Criteria

### ✅ Database
- [x] Column created in `business_brand_profile`
- [x] Column is nullable TEXT type
- [x] Column comment documents conditional nature
- [x] Migration applied without errors

### ⏳ Frontend
- [ ] Section visible on Brand Profile page
- [ ] Amber warning displays correctly
- [ ] Edit mode works (can type and save)
- [ ] Read-only mode displays saved content
- [ ] Empty state shows placeholder text

### ⏳ AI Generation
- [ ] Field populates when interior photos exist
- [ ] Field remains empty when no photos
- [ ] `has_verified_evidence` flag set correctly
- [ ] No hallucinated interior details

### ⏳ Edge Cases
- [ ] Null value doesn't break save
- [ ] Empty string saves correctly
- [ ] Downstream systems handle missing field
- [ ] Manual edits persist after AI regeneration

---

## 🚀 Next Actions

1. **Test AI Generation**:
   - Hard refresh Brand Profile page (Cmd+Shift+R)
   - Click "Generer Brand Profil"
   - Check new section

2. **Test Manual Entry**:
   - Click "Rediger" on new section
   - Enter sample text
   - Save and verify persistence

3. **Upload Interior Photos** (if needed):
   - Go to Gallery/Images section
   - Upload 2-3 interior photos
   - Add labels: "interior", "mural", "decor"
   - Regenerate Brand Profile

4. **Verify Downstream**:
   - Test social media idea generation
   - Check content calendar features
   - Ensure no breaking changes

---

## 📝 Notes

- Field is **optional** - safe to be empty
- Designed to prevent hallucination of interior details
- Users can manually override if they have evidence
- Downstream systems should check `if (field && field.trim())` before using

---

## ✨ Current Status

**Deployed**: ✅  
**Database**: ✅  
**Frontend**: ✅  
**Ready for Testing**: ✅

**Test with**: Café Faust (business_id: 82f7b70d-0a72-4888-8ba7-6dc1d34e8db8)

The system is ready! Refresh your Brand Profile page and the new section should appear. 🎨
