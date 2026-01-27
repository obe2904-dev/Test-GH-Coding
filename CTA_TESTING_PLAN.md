# CTA Separation Testing Plan

## Overview
Comprehensive testing plan for the new CTA separation architecture in ai-generate-v2.

## Pre-Testing Setup

### 1. Apply Database Migration
```sql
-- Run in Supabase SQL Editor
-- Copy contents of ADD_CTA_CONFIG_COLUMN.sql
ALTER TABLE business_profile 
ADD COLUMN IF NOT EXISTS cta_config JSONB DEFAULT NULL;

COMMENT ON COLUMN business_profile.cta_config IS 'CTA configuration...';

CREATE INDEX IF NOT EXISTS idx_business_profile_cta_config 
ON business_profile USING GIN (cta_config);
```

### 2. Verify Deployment
- Check Supabase dashboard: Function `ai-generate-v2` shows recent deployment
- Check function logs for any startup errors

## Test Scenarios

### Scenario 1: Default Behavior (No CTA Config)

**Setup:**
```sql
-- Ensure Viggo has no cta_config
UPDATE business_profile 
SET cta_config = NULL 
WHERE business_name = 'Viggo';
```

**Test Steps:**
1. Go to Create Post page
2. Click "Generate 3 AI Ideas"
3. Wait for ideas to load

**Expected Results:**
- ✅ 3 ideas generated successfully
- ✅ Each idea shows clean text (hook + caption only)
- ✅ CTA badge appears below text
- ✅ CTA text in Danish: "📅 Book bord nu" or "🚶 Kom forbi"
- ✅ Booking CTA shows indigo badge with external link icon
- ✅ Soft CTA shows gray badge without icon

**Verification:**
```javascript
// Check in browser console
const idea = document.querySelector('[data-idea]')
console.log('Text:', idea.querySelector('.text-content').textContent)
console.log('CTA:', idea.querySelector('.cta-badge').textContent)
// Should NOT see CTA embedded in text
```

---

### Scenario 2: Custom Soft CTAs

**Setup:**
```sql
-- Configure Viggo with soft CTAs
UPDATE business_profile 
SET cta_config = jsonb_build_object(
  'default_style', 'soft',
  'custom_ctas', jsonb_build_object(
    'book', 'Besøg os i dag',
    'visit', 'Kom og smag',
    'menu', 'Se vores spændende menu',
    'engage', 'Fortæl os din mening'
  ),
  'use_emojis', false
)
WHERE business_name = 'Viggo';
```

**Test Steps:**
1. Generate new AI ideas (refresh page if needed)
2. Examine CTA text in each idea

**Expected Results:**
- ✅ CTAs use custom text: "Besøg os i dag", "Kom og smag"
- ✅ No emojis in CTAs (use_emojis=false)
- ✅ Gray badge (soft style, even for booking intent)
- ✅ No external link icon (no URL)

**API Response Check:**
```javascript
// In Network tab, check ai-generate-v2 response
{
  "ideas": [...],
  "formatted": {
    "facebook": [{
      "text": "...",
      "cta": {
        "text": "Besøg os i dag",  // Custom, no emoji
        "type": "custom",
        "url": undefined  // No URL (soft style)
      }
    }],
    "instagram": [...]
  }
}
```

---

### Scenario 3: Direct Booking CTAs with URL

**Setup:**
```sql
-- Configure Viggo with direct booking CTAs
UPDATE business_profile 
SET cta_config = jsonb_build_object(
  'default_style', 'booking',
  'custom_ctas', jsonb_build_object(
    'book', 'Book dit bord hos Viggo'
  ),
  'use_emojis', true
)
WHERE business_name = 'Viggo';

-- Ensure booking_url exists
UPDATE business_profile 
SET booking_url = 'https://booking.viggo.dk'
WHERE business_name = 'Viggo';
```

**Test Steps:**
1. Generate AI ideas
2. Select idea with booking intent
3. Check CTA appearance

**Expected Results:**
- ✅ CTA text: "📅 Book dit bord hos Viggo" (emoji added)
- ✅ Indigo badge (booking style)
- ✅ External link icon visible
- ✅ Facebook post includes URL, Instagram doesn't

**API Response Check:**
```javascript
{
  "formatted": {
    "facebook": [{
      "cta": {
        "text": "📅 Book dit bord hos Viggo",
        "type": "custom",
        "url": "https://booking.viggo.dk"  // URL present
      }
    }],
    "instagram": [{
      "cta": {
        "text": "📅 Book dit bord hos Viggo",
        "type": "custom",
        "url": undefined  // No URL on Instagram
      }
    }]
  }
}
```

---

### Scenario 4: Mixed Intent Types

**Setup:**
Same as Scenario 3 (booking style with custom CTAs)

**Test Steps:**
1. Generate 3 AI ideas
2. Should get mix of menu, vibe, moment ideas
3. Observe different CTA intents: book, visit, engage

**Expected Results:**

**Idea 1 (Menu item with booking intent):**
- CTA: "📅 Book dit bord hos Viggo"
- Type: custom
- URL: Present (Facebook only)

**Idea 2 (Vibe with visit intent):**
- CTA: "🚶 Kom forbi" (fallback, no custom_ctas.visit)
- Type: booking (matches default_style)
- URL: Present (Facebook only)

**Idea 3 (Moment with engage intent):**
- CTA: "💬 Fortæl os" (fallback)
- Type: soft
- URL: None (engage intent never has URL)

---

### Scenario 5: Platform Differences

**Setup:**
Use any configuration from above

**Test Steps:**
1. Generate AI ideas
2. Open browser DevTools → Network tab
3. Find `ai-generate-v2` request
4. Compare Facebook vs Instagram responses

**Expected Results:**

**Facebook Response:**
```json
{
  "text": "Smag sæsonens bedste retter 🍂\n\nVores efterårsmenu er her.",
  "cta": {
    "text": "📅 Book dit bord",
    "type": "booking",
    "url": "https://booking.viggo.dk"  // URL included
  },
  "hashtags": ["#Viggo", "#København", "#madoplevelser", "#restaurantliv"]
}
```

**Instagram Response:**
```json
{
  "text": "Smag sæsonens bedste retter 🍂\n\nVores efterårsmenu er her.",
  "cta": {
    "text": "🚶 Kom forbi",
    "type": "soft",
    "url": undefined  // Never on Instagram
  },
  "hashtags": [...12 hashtags...]
}
```

---

### Scenario 6: Locale Testing (Swedish)

**Setup:**
```sql
-- Create test Swedish business
UPDATE business_profile 
SET 
  primary_language = 'Swedish',
  country = 'Sweden',
  cta_config = NULL  -- Test default behavior
WHERE business_name = 'Viggo';
```

**Test Steps:**
1. Generate AI ideas

**Expected Results:**
- ✅ CTA in Swedish: "📅 Boka bord" or "🚶 Kom förbi"
- ✅ Hashtags in Swedish: #matupplevelser, #fika
- ✅ All other behavior same as Danish

---

### Scenario 7: Error Handling

**Test Steps:**
1. Remove booking_url: `UPDATE business_profile SET booking_url = NULL`
2. Generate ideas with booking intent

**Expected Results:**
- ✅ No errors thrown
- ✅ CTA still appears (but no URL)
- ✅ Frontend doesn't show external link icon

---

## Frontend Visual Inspection

### IdeaCard Rendering

**Check these elements:**

1. **Text Section:**
   - Clean content (hook + caption)
   - No CTA embedded
   - No URLs embedded
   - No "Link i bio" text

2. **CTA Badge:**
   - Appears between text and metadata
   - Rounded corners
   - Proper padding (px-3 py-1.5)
   - Font size: text-sm
   - Font weight: font-medium

3. **Booking CTA:**
   - Background: bg-indigo-100
   - Text color: text-indigo-700
   - Border: border-indigo-200
   - External link icon (if URL present)
   - Icon size: w-3 h-3

4. **Soft CTA:**
   - Background: bg-slate-100
   - Text color: text-slate-700
   - Border: border-slate-200
   - No external link icon

5. **Metadata Section:**
   - Best time and impact below CTA
   - Photo suggestion at bottom
   - All existing metadata preserved

---

## Backend Testing

### Test API Directly

```bash
# Test with curl
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/ai-generate-v2' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "viggo-user-id",
    "context": {
      "time_of_day": "lunch"
    }
  }'
```

**Check response:**
```json
{
  "ideas": [
    {
      "idea_type": "menu",
      "menu_item": {"name": "Ribeye", "category": "AFTEN"},
      "hook": "...",
      "caption_base": "...",  // No CTA, no hashtags
      "cta_intent": "book"
    }
  ],
  "formatted": {
    "facebook": [{
      "text": "...",  // Clean text only
      "cta": {
        "text": "📅 Book bord",
        "type": "booking",
        "url": "https://..."
      },
      "hashtags": ["#Viggo", "#København"]
    }],
    "instagram": [...]
  }
}
```

---

## Regression Testing

### Ensure Existing Features Work

1. **Hashtag Generation:**
   - ✅ Still generates 4 hashtags for Facebook
   - ✅ Still generates 12 hashtags for Instagram
   - ✅ Hashtags remain in separate array

2. **Menu Item Validation:**
   - ✅ Only suggests lunch items during lunch time
   - ✅ Menu catalog daypart filtering works

3. **Locale Compliance:**
   - ✅ Danish cultural norms (hygge, formality)
   - ✅ Swedish lagom mentality
   - ✅ Meal times respected (Denmark 11-15, Sweden 11-14)

4. **Content Structure:**
   - ✅ Hook appears at top
   - ✅ Caption base is main content
   - ✅ Photo suggestion generated

---

## Performance Testing

1. **Response Time:**
   - Target: < 10 seconds for 3 ideas
   - Measure: Network tab timing

2. **Bundle Size:**
   - Previous: 164kB
   - Current: Should be ~165-170kB (minor increase)

3. **Memory Usage:**
   - No memory leaks from new CTA objects
   - Frontend rendering stable

---

## Acceptance Criteria

### Must Pass
- [ ] All 7 test scenarios pass
- [ ] CTA never embedded in text
- [ ] URLs only appear on Facebook (for booking/visit intents)
- [ ] Instagram never shows URLs
- [ ] Custom CTAs override defaults
- [ ] Fallbacks work without cta_config
- [ ] No TypeScript errors in frontend
- [ ] No runtime errors in backend

### Nice to Have
- [ ] CTA badge looks visually distinct from text
- [ ] Hover effects on CTA badge
- [ ] External link icon clearly visible
- [ ] Mobile responsive

---

## Bug Reporting Template

```markdown
**Scenario:** [Which test scenario]
**Setup:** [Configuration used]
**Expected:** [What should happen]
**Actual:** [What actually happened]
**Screenshots:** [If applicable]
**Console Errors:** [Browser console output]
**API Response:** [Network tab response JSON]
```

---

## Rollback Plan

If critical bugs found:

1. **Backend Rollback:**
   ```bash
   # Redeploy previous version
   git checkout <previous-commit>
   npx supabase functions deploy ai-generate-v2
   ```

2. **Frontend Rollback:**
   ```bash
   # Remove CTA rendering
   git revert <cta-commit-hash>
   ```

3. **Database Rollback:**
   ```sql
   -- Remove column (optional, won't break anything if left)
   ALTER TABLE business_profile DROP COLUMN IF EXISTS cta_config;
   ```

---

## Post-Testing Actions

After all tests pass:

1. **Document any issues found**
2. **Update CTA_SEPARATION_IMPLEMENTATION.md with test results**
3. **Create business configuration UI (Phase 2)**
4. **Monitor production for 1 week:**
   - Check function logs for errors
   - Monitor user feedback
   - Track CTA engagement metrics

---

## Test Log Template

```markdown
## Test Run: [Date]
**Tester:** [Name]
**Environment:** [Production/Staging]

### Scenario 1: Default Behavior
- Status: ✅ Pass / ❌ Fail
- Notes: [Any observations]

### Scenario 2: Custom Soft CTAs
- Status: ✅ Pass / ❌ Fail
- Notes: [Any observations]

... [Continue for all scenarios]

### Summary
- Scenarios Passed: X/7
- Critical Issues: [List]
- Minor Issues: [List]
- Recommendation: [Deploy / Fix / Rollback]
```
