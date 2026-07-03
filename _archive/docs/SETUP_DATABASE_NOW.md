# 🚨 URGENT: Set Up Your Database

Your database is empty - that's why signup isn't working! Follow these steps:

## Step 1: Go to Supabase SQL Editor

1. Open: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
2. This opens the SQL Editor

## Step 2: Run the Complete Migration

You have a complete migration file ready. Copy ALL the contents from:

**File:** `/Users/olebaek/Test P2G 1/APPLY_MIGRATIONS_IN_SUPABASE.sql`

### How to apply it:

1. Open the file `APPLY_MIGRATIONS_IN_SUPABASE.sql` in VS Code
2. Press **Cmd+A** (select all)
3. Press **Cmd+C** (copy)
4. Go to Supabase SQL Editor (link above)
5. Press **Cmd+V** (paste everything)
6. Click **Run** (or press Cmd+Enter)

This will create ALL required tables:
- ✅ `auth.users` (Supabase manages this)
- ✅ `profiles` table
- ✅ `businesses` table  
- ✅ `business_profile` table
- ✅ `business_locations` table
- ✅ `business_team_members` table
- ✅ All RLS policies
- ✅ All functions and triggers

## Step 3: Verify Tables Were Created

After running the migration, run this query in SQL Editor:

```sql
-- Check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see tables like:
- businesses
- business_locations
- business_profile
- business_team_members
- profiles
- (and others)

## Step 4: Configure Email Settings

While in Supabase Dashboard:

### A. Enable Email Confirmation (if you want confirmation emails)
1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/auth/providers
2. Click on **Email** provider
3. **Check** "Confirm email" if you want users to verify their email
4. **Uncheck** "Confirm email" if you want instant access (no email needed)
5. Save changes

### B. Configure Site URL
1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/auth/url-configuration
2. Set **Site URL** to: `http://localhost:3002`
3. Add **Redirect URLs**:
   - `http://localhost:3002/**`
   - `http://localhost:3002/login`
   - `http://localhost:3002/onboarding`
4. Save changes

## Step 5: Test Signup

1. Make sure dev server is running:
   ```bash
   npm run dev
   ```

2. Go to: http://localhost:3002/signup

3. Open Browser Console (F12 or Cmd+Opt+I)

4. Try signing up - you should see console logs:
   ```
   🔐 Signing up with: ...
   ✅ Signup response: ...
   ```

5. Check if account was created:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 5;
   ```

## Quick Checklist

- [ ] Ran `APPLY_MIGRATIONS_IN_SUPABASE.sql` in Supabase SQL Editor
- [ ] Verified tables exist with `SELECT table_name FROM information_schema.tables`
- [ ] Configured Email provider settings
- [ ] Set Site URL to `http://localhost:3002`
- [ ] Added redirect URLs
- [ ] Tested signup on http://localhost:3002/signup
- [ ] Checked browser console for logs
- [ ] Verified user in database

## If You Get Errors

### Error: "relation already exists"
This is OK - means some tables were already created. The script uses `CREATE TABLE IF NOT EXISTS`.

### Error: "permission denied"
You need to be logged in as the project owner in Supabase dashboard.

### Error: "syntax error"
Make sure you copied the ENTIRE file contents. Check for any truncation.

## After Setup Works

Once signup is working:
1. User signs up
2. Account is created in `auth.users`
3. Profile is auto-created in `profiles` table (via trigger)
4. User can complete onboarding
5. Business is created in `businesses` table

## Need Help?

If you still have issues after running migrations:
1. Share any error messages from SQL Editor
2. Share output of: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
3. Share console logs from signup attempt
