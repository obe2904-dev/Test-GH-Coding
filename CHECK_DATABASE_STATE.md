# Database Diagnostic Check

Since it worked before but now appears empty, run these queries in Supabase SQL Editor:
https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

## 1. Check if tables exist

```sql
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

**What to look for:** You should see tables like `businesses`, `profiles`, etc.

## 2. Check if there are any users in auth

```sql
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
```

**What to look for:** Any users that were created before

## 3. Check profiles table

```sql
SELECT COUNT(*) as profile_count FROM public.profiles;
SELECT * FROM public.profiles ORDER BY created_at DESC LIMIT 5;
```

## 4. Check businesses table

```sql
SELECT COUNT(*) as business_count FROM public.businesses;
SELECT * FROM public.businesses ORDER BY created_at DESC LIMIT 5;
```

## 5. Check if RLS is blocking you

```sql
-- Temporarily bypass RLS to see all data (you need to be admin)
SET role postgres;
SELECT * FROM public.profiles LIMIT 5;
SELECT * FROM public.businesses LIMIT 5;
```

## 6. Try creating a test user manually

```sql
-- This will tell us if the trigger still works
-- Run this in SQL Editor (as admin, you can bypass normal signup flow)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  crypt('testpassword123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Then check if profile was auto-created
SELECT * FROM public.profiles WHERE email = 'test@example.com';
```

---

## What to do based on results:

### If NO tables exist:
- Database was wiped/reset
- Need to run migrations again from `APPLY_MIGRATIONS_IN_SUPABASE.sql`

### If tables exist but are empty:
- Data was deleted (not just lost connection)
- Check if you have backups in Supabase: 
  - Go to Database → Backups
  - https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/database/backups
- Or need to start fresh with migrations

### If tables exist and have data but you can't see it:
- RLS policies might be too restrictive
- Query #5 above will bypass RLS to check

### If auth.users has users but profiles table is empty:
- The trigger that auto-creates profiles is broken
- Need to recreate the trigger

---

## Quick Actions

**If you need to start completely fresh:**

1. Go to Database → Schema:
   https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/database/schema

2. Delete all tables manually or run:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

3. Then run `APPLY_MIGRATIONS_IN_SUPABASE.sql` fresh

**Check for backups first!**
- Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/database/backups
- See if there's a backup from when it was working
- Restore from there

---

## Tell me:
1. What does query #1 show? (Do tables exist?)
2. What does query #2 show? (Any users in auth?)
3. When did it stop working? (Was there any action that might have caused this?)
