# AI Pipeline Testing Tools

## 🎯 Purpose

These scripts isolate the AI generation pipeline from the frontend, allowing you to test:

1. **Strategy → Ideas** (weekly planning)
2. **Ideas → Posts** (text + hashtags + emojis + CTA + timing)

This helps debug issues like location-based hashtags without touching React components.

---

## 📁 Scripts

### 1. `test-ai-pipeline.js` - Complete AI Generation Test

Tests the full pipeline from strategic idea to final post content.

**Usage:**
```bash
node scripts/test-ai-pipeline.js
```

**What it tests:**
- ✅ Edge function invocation
- ✅ Text generation (Facebook vs Instagram)
- ✅ Hashtag generation (including location-specific)
- ✅ Emoji suggestions
- ✅ CTA recommendations
- ✅ Post timing

**Output:**
```
🧪 AI PIPELINE TESTER
============================================================
📍 Test City: Aarhus
🏢 Business: 840347de...
💡 Idea: En ægte klassiker: Pariserbøf
============================================================

────────────────────────────────────────────────────────────
🎯 Testing FACEBOOK
────────────────────────────────────────────────────────────

📝 TEXT:
   Weekend comfort food klassikeren...

🏷️  HASHTAGS:
   ✓ #DanskMad
   ✓ #Hygge
   📍 #Aarhus        ← Should see this for Aarhus
   📍 #FoodieKbh     ← BUG: København tag!
```

**Configuration (edit the script):**
```javascript
const CONFIG = {
  // Change this to test different cities
  testCity: 'Aarhus',  // or 'København'
  
  // Your business ID
  businessId: '840347de-9ba7-4275-8aa3-4553417fc2af',
  
  // Test idea
  testIdea: {
    id: 3,
    title: 'En ægte klassiker: Pariserbøf',
    content_type: 'menu_item'
  }
}
```

---

### 2. `fix-cafe-faust-city.js` - Database City Fixer

Updates the `business_locations` table to set the correct city.

**Usage:**
```bash
node scripts/fix-cafe-faust-city.js
```

**Note:** Only works if the business exists in your local database. For production testing, use the AI pipeline tester instead.

---

## 🐛 Debugging Location Hashtags

**The Problem:**
Posts for Aarhus businesses are getting København hashtags (#FoodieKbh, #København).

**Root Cause Chain:**
1. Database: `business_locations.city` might be NULL
2. Edge Function: Passes `city: undefined` to AI
3. AI Caption Generator: Falls back to `defaultCity: 'København'`
4. Result: Wrong hashtags!

**How to Debug:**

1. **Run the AI tester:**
   ```bash
   node scripts/test-ai-pipeline.js
   ```

2. **Check the output:**
   ```
   🏷️  HASHTAGS:
      📍 #FoodieKbh     ← BUG if testCity = 'Aarhus'
      📍 #København     ← BUG if testCity = 'Aarhus'
   ```

3. **Look for the bug detection:**
   ```
   🐛 BUG DETECTED: København hashtags for Aarhus business!
   ```

4. **Test the fix:**
   - Edit `CONFIG.testCity` to `'København'`
   - Run again - should now pass
   - Then test with `'Aarhus'`

---

## 🔍 What to Check

### If hashtags are still wrong:

1. **Check edge function logs** (Supabase terminal):
   ```
   [ai-generate-from-strategy] Context built: {
     businessName: "Café Faust",
     city: undefined  ← Problem!
   }
   ```

2. **Check database** (if using local):
   ```sql
   SELECT city FROM business_locations 
   WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';
   ```

3. **Check AI Caption Generator fallback:**
   - File: `supabase/functions/_shared/ai-caption-generator/i18n-config.ts`
   - Line 76: `defaultCity: 'København'`
   - This is used when `context.city` is missing

---

## 🎯 Quick Test Workflow

```bash
# 1. Test current state (should show bug)
node scripts/test-ai-pipeline.js

# 2. Look for København hashtags in Aarhus test
#    Output: 🐛 BUG DETECTED: København hashtags for Aarhus business!

# 3. Fix the issue:
#    - Update database city, OR
#    - Fix edge function city passing, OR
#    - Update AI caption generator fallback

# 4. Test again
node scripts/test-ai-pipeline.js

# 5. Verify fix
#    Output: ✅ CORRECT: Aarhus hashtags as expected
```

---

## 📝 Notes

- **Production vs Local**: These scripts connect to `localhost:54321` by default
- **Edge Functions**: Make sure Supabase is running (`supabase start`)
- **API Keys**: Uses demo keys from local Supabase
- **Real Business**: Update `businessId` in CONFIG to use your actual test business

---

## 🚀 Next Steps

Once the AI pipeline works correctly in isolation:
1. Verify city is properly stored in database
2. Confirm edge function passes city correctly
3. Test from the frontend to ensure end-to-end flow works
4. Deploy edge function changes if needed
