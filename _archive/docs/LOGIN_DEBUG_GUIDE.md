# Login Debugging Guide

## Current Status
✅ Auth trigger created successfully
✅ offerings_full column added
❌ Login not working - "nothing happens"

## Next Steps

### 1. Check Database State
Run [CHECK_DATABASE_STATE.sql](CHECK_DATABASE_STATE.sql) in Supabase SQL Editor to verify:
- ✓ `profiles` table exists
- ✓ `businesses` table exists (CRITICAL - if missing, login won't work)
- ✓ Auth trigger is active
- ✓ You have users in the database

**CRITICAL**: The app expects a `businesses` table. If the db reset wiped it, you'll need to recreate it.

### 2. Check Browser Console
1. Open your app: http://localhost:3004
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Try to login
5. Look for these debug messages:
   - `📝 Form submitted`
   - `🔄 Starting login process...`
   - `📤 Calling signIn...`
   - `🔐 Attempting sign in for: <email>`
   - `✅ Sign in successful` OR `❌ Sign in error`

### 3. Common Issues & Fixes

#### Issue: "Invalid login credentials"
**Fix**: Double-check email/password or create a new account

#### Issue: "Email not confirmed"
**Fix**: Check your email for confirmation link

#### Issue: Console shows error about "businesses" table
**Fix**: The database needs the businesses table. Run the full migrations or manually create it:

```sql
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL,
  website_url TEXT,
  primary_language TEXT DEFAULT 'da',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id)
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business"
  ON public.businesses FOR SELECT
  USING (owner_id = auth.uid());
```

#### Issue: Nothing in console, button doesn't respond
**Fix**: Check if JavaScript is running - look for ANY console output when page loads

### 4. Test Login Flow
After checking the above:
1. Refresh the page (Cmd+R / Ctrl+R)
2. Open Console (F12)
3. Try login again
4. Share the console output with me

## Files Modified (with debug logging)
- ✅ [src/stores/authStore.ts](src/stores/authStore.ts) - Added sign-in logging
- ✅ [src/hooks/useAuthForm.ts](src/hooks/useAuthForm.ts) - Added error logging
- ✅ [src/pages/LoginPage.tsx](src/pages/LoginPage.tsx) - Added submit logging
