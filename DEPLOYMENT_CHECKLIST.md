## Menu Extraction System - Deployment Checklist

**Date:** 17 December 2025
**Status:** Ready for Production
**Environment:** Supabase

---

## STEP 1: Database Migrations

### 1.1 Deploy menu_sources table migration
```bash
# Run in Supabase SQL Editor
-- Execute file: supabase/migrations/018_create_menu_sources_table.sql
-- OR copy-paste the SQL directly into the editor
```

**Expected Output:**
- Table `menu_sources` created ✓
- Indexes created ✓
- RLS policies active ✓

**Verification Query:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'menu_sources';
-- Should return: menu_sources
```

---

### 1.2 Deploy menu_extractions table migration
```bash
# Run in Supabase SQL Editor
-- Execute file: supabase/migrations/019_create_menu_extractions_table.sql
```

**Expected Output:**
- Table `menu_extractions` created ✓
- Indexes created ✓
- RLS policies active ✓

**Verification Query:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'menu_extractions';
-- Should return: menu_extractions
```

---

### 1.3 Verify RLS Policies
```sql
-- Check menu_sources policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'menu_sources';
-- Should return 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- Check menu_extractions policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'menu_extractions';
-- Should return 4 policies (SELECT, INSERT, UPDATE, DELETE)
```

---

## STEP 2: Environment Variables

### 2.1 Set Supabase Edge Functions Secrets
```bash
# In Supabase Dashboard:
# Settings → Edge Functions → Environment Variables

# Add or verify:
OPENAI_API_KEY = "sk-..."  # Your OpenAI API key
```

**How to find in Supabase Dashboard:**
1. Go to Project Settings
2. Click "Edge Functions" in left menu
3. Scroll to "Environment Variables"
4. Add: `OPENAI_API_KEY` = your key

---

### 2.2 Verify Frontend Env Variables
```bash
# Check in .env.local or .env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyxxxxx...
```

---

## STEP 3: Deploy Edge Functions

### 3.1 Deploy extract-menu-pdf
```bash
# SSH into project or use Supabase CLI
supabase functions deploy extract-menu-pdf

# Or via Supabase Dashboard:
# 1. Go to Functions
# 2. Select extract-menu-pdf
# 3. Click Deploy
```

**Verify Deployment:**
```bash
curl -i https://xxxxx.supabase.co/functions/v1/extract-menu-pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/menu.pdf"}'

# Should return: 200 (or error with valid error message)
```

---

### 3.2 Deploy parse-menu-text
```bash
# SSH into project or use Supabase CLI
supabase functions deploy parse-menu-text

# Or via Supabase Dashboard:
# 1. Go to Functions
# 2. Select parse-menu-text
# 3. Click Deploy
```

**Verify Deployment:**
```bash
curl -i https://xxxxx.supabase.co/functions/v1/parse-menu-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "extractedText": "BRUNCH\nEggs Benedict 95 kr",
    "menuName": "Brunch",
    "businessId": "test-id",
    "menuSourceId": null
  }'

# Should return: 200 with extraction data
```

---

## STEP 4: Test Database Connection

### 4.1 Create test record in menu_sources
```sql
-- Insert test menu source
INSERT INTO menu_sources (
  business_id, 
  source_url, 
  source_type, 
  menu_type, 
  source_origin, 
  status
) VALUES (
  'YOUR_BUSINESS_ID',
  'https://example.com/test.pdf',
  'pdf',
  'standard',
  'manual_added',
  'pending'
)
RETURNING id, business_id, source_url, created_at;

-- Should return successfully with created record
```

---

### 4.2 Create test record in menu_extractions
```sql
-- Insert test menu extraction
INSERT INTO menu_extractions (
  business_id,
  menu_name,
  menu_type,
  extracted_data
) VALUES (
  'YOUR_BUSINESS_ID',
  'Test Menu',
  'standard',
  '{
    "categories": [
      {
        "id": "cat-1",
        "name": "Foretter",
        "items": [
          {"id": "item-1", "name": "Bruschetta", "short_desc": "Med tomat og basilikum"}
        ]
      }
    ]
  }'::jsonb
)
RETURNING id, menu_name, created_at;

-- Should return successfully with created record
```

---

### 4.3 Verify RLS Access
```sql
-- Test SELECT as authenticated user
-- (This should only work if you're logged in as that user)
SELECT id, menu_name FROM menu_extractions 
WHERE business_id = 'YOUR_BUSINESS_ID';

-- Should return your test record if RLS is working
```

---

## STEP 5: Frontend Integration Test

### 5.1 Start dev server
```bash
cd "/Users/olebaek/Test P2G 1"
npm run dev
```

### 5.2 In browser, navigate to:
- Profile → Menu tab → Offerings section

### 5.3 Manual test:
1. **Upload/Link Menu:**
   - Paste URL: `https://jakobsenco.dk/viggo/wp-content/uploads/sites/35/2025/11/Viggo-julemenu-2025.pdf`
   - Click "Få AI til at hente"
   - Watch browser console (F12)

2. **Expected Logs:**
   ```
   🔍 Starting extraction for: https://jakobsenco.dk/viggo/...
   ✅ Got session, calling Edge Function...
   📡 Response status: 200
   ✅ Extracted text length: 2500
   🧠 Parsing extracted text with AI...
   ✅ Menu parsed successfully: 3 categories
   ```

3. **Expected Result:**
   - "🧠 AI forstået Menu" section appears
   - Shows collapsed categories (Julefrokost, etc.)
   - Click to expand shows menu items

---

## STEP 6: Validation Checklist

- [ ] Both migrations deployed successfully
- [ ] No errors in Supabase SQL editor
- [ ] `OPENAI_API_KEY` set in Edge Functions
- [ ] Both functions deployed (green status)
- [ ] Test records created in database
- [ ] RLS policies verified working
- [ ] Frontend dev server runs without errors
- [ ] Menu extraction shows in browser
- [ ] Categories expanded show menu items
- [ ] No console errors (F12)

---

## ROLLBACK STEPS (if needed)

### Delete migrations (if errors):
```sql
-- Drop menu_extractions table
DROP TABLE IF EXISTS menu_extractions CASCADE;

-- Drop menu_sources table
DROP TABLE IF EXISTS menu_sources CASCADE;
```

### Delete functions:
```bash
supabase functions delete extract-menu-pdf
supabase functions delete parse-menu-text
```

---

## Support Info

**Common Issues:**

| Issue | Solution |
|-------|----------|
| `OPENAI_API_KEY not found` | Set in Supabase Edge Functions environment |
| `Unauthorized` error | Verify user is authenticated before calling function |
| `RLS policy violation` | Verify `business_id` matches user's business |
| `Function not found` | Redeploy functions using `supabase functions deploy` |
| `Empty extraction` | Check if PDF is text-based (not image-based) |

---

**Next:** Run validation tests (Step 2 in your request)
