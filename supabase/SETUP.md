# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - Project name: `social-media-saas`
   - Database password: (save this securely)
   - Region: Choose closest to your users
4. Wait ~2 minutes for project to initialize

## 2. Get Your API Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## 3. Configure Environment Variables

1. Create a `.env` file in the project root (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and paste your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## 4. Run the Initial Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the query editor
5. Click **Run** (or press Cmd/Ctrl + Enter)

This will:
- Create the `profiles` table
- Set up Row Level Security (RLS) policies
- Create a trigger to auto-create profiles when users sign up
- Add an `updated_at` auto-update trigger

## 5. Configure Email Authentication

1. Go to **Authentication** → **Providers**
2. Ensure **Email** provider is enabled
3. (Optional) Configure email templates in **Authentication** → **Email Templates**

## 6. Test Database Connection

After running migrations, you can test in the SQL Editor:

```sql
-- Should return your profiles table structure
SELECT * FROM public.profiles;
```

## Next Steps

Once setup is complete:
1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Test signup at `http://localhost:3000/signup`

## Future Migrations

As we add features, create new migration files:
- `002_add_posts_table.sql` - When building post scheduler
- `003_add_connected_accounts.sql` - When adding platform OAuth
- etc.

Run each migration in order in the Supabase SQL Editor.
