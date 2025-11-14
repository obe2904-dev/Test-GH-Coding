# 🔧 Fix CORS Error - Supabase Edge Function

## Problem
CORS error when calling the Supabase Edge Function from localhost.

## Solution: Redeploy the Edge Function

### Option 1: Using Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions
   ```

2. **Click on `ai-generate` function**

3. **Click "Deploy New Version"**

4. **Copy the updated code** from:
   ```
   supabase/functions/ai-generate/index.ts
   ```

5. **Paste and Deploy**

---

### Option 2: Using CLI (Faster)

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link your project
supabase link --project-ref kvqdkohdpvmdylqgujpn

# 4. Deploy the function
supabase functions deploy ai-generate

# 5. Set the OpenAI API key secret (if not set)
supabase secrets set OPENAI_API_KEY=<your-openai-api-key>
```

---

### Option 3: Use the Deploy Script

```bash
./deploy-function.sh
```

---

## What Changed?

The updated Edge Function now properly handles CORS preflight requests:

**Before:**
```typescript
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}
```

**After:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',  // ✅ Added
}

if (req.method === 'OPTIONS') {
  return new Response(null, {  // ✅ Changed to null
    status: 204,               // ✅ Added status 204
    headers: corsHeaders 
  })
}
```

---

## Testing After Deploy

1. **Restart your dev server:**
   ```bash
   npm run dev
   ```

2. **Go to the Custom tab** in Generate step

3. **Enter a topic** and click "Generate with AI"

4. **Check the console** - you should see:
   ```
   ✅ Direct OpenAI success! Cost: ~$0.001 (was $0.0645)
   ```

---

## Troubleshooting

### Still getting CORS error?

1. **Check deployment:**
   ```bash
   supabase functions list
   ```
   Should show `ai-generate` with recent deploy time

2. **Check secrets:**
   ```bash
   supabase secrets list
   ```
   Should show `OPENAI_API_KEY`

3. **Check function logs:**
   ```bash
   supabase functions logs ai-generate
   ```

4. **Test with curl:**
   ```bash
   curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/ai-generate \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"topic":"test","businessType":"cafe","platforms":["facebook"]}'
   ```

---

## Need Help?

If you're still stuck:
1. Check Supabase function logs in the dashboard
2. Verify OPENAI_API_KEY is set correctly
3. Make sure you're using the correct project ref

---

**Estimated time to fix: 2-5 minutes** ⏱️
