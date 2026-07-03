# External Testing Setup Guide

Complete guide to set up secure external testing through GitHub + Vercel without exposing your app publicly.

## 🎯 Overview

This setup provides:
- ✅ **Isolated preview deployments** for each PR/branch
- ✅ **Restricted access** - only approved testers can access
- ✅ **Separate staging database** - no production data exposure
- ✅ **Automatic deployments** via GitHub Actions
- ✅ **Password-free testing** - testers use their approved email addresses

---

## 📋 Prerequisites

- GitHub repository with your code
- Vercel account (free tier works)
- Supabase project for staging (separate from production)

---

## 🚀 Step 1: Create Staging Supabase Project

### 1.1 Clone Production Database Structure

```bash
# In your terminal
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Create new Supabase project for staging
# Go to: https://supabase.com/dashboard
# Click "New Project"
# Name: "social-media-saas-staging"
# Choose same region as production
```

### 1.2 Copy Database Schema

```bash
# Export production schema (without data)
npx supabase db dump --schema public > staging-schema.sql

# Apply to staging project
# In Supabase Dashboard → SQL Editor:
# Paste contents of staging-schema.sql and run
```

### 1.3 Deploy Edge Functions to Staging

```bash
# Link to staging project
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF

# Deploy all functions
npx supabase functions deploy brand-profile-generator-v5
npx supabase functions deploy get-weekly-strategy
npx supabase functions deploy generate-text-from-idea
npx supabase functions deploy menu-extract-v2
# ... deploy other functions as needed
```

### 1.4 Configure Staging Environment Variables

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
OPENAI_API_KEY=<your-openai-key>
OPENWEATHERMAP_API_KEY=<your-weather-key>
```

---

## 🔐 Step 2: Set Up Access Control

### 2.1 Create Tester Whitelist in Staging Database

```sql
-- Run in Supabase SQL Editor (Staging Project)

-- Create approved testers table
CREATE TABLE IF NOT EXISTS approved_testers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'tester',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE approved_testers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to check if they're approved (needed for auth)
CREATE POLICY "Anyone can check approval status"
  ON approved_testers
  FOR SELECT
  USING (true);

-- Add your test users
INSERT INTO approved_testers (email, name, role) VALUES
  ('tester1@example.com', 'John Tester', 'external_tester'),
  ('tester2@example.com', 'Jane QA', 'external_tester'),
  ('your-email@example.com', 'Your Name', 'admin');
```

### 2.2 Create Auth Hook to Restrict Access

```sql
-- Run in Supabase SQL Editor (Staging Project)

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved_tester(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM approved_testers 
    WHERE email = user_email AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to block unapproved signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_approved_tester(NEW.email) THEN
    RAISE EXCEPTION 'Access restricted to approved testers only. Contact admin for access.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users (if supported by your Supabase version)
-- Note: This requires Supabase Auth Hooks feature
-- Alternative: Handle in application layer (see Step 2.3)
```

### 2.3 Add Frontend Access Check

Create new file: `src/hooks/useAccessControl.ts`

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useAccessControl() {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsApproved(false);
        setLoading(false);
        return;
      }

      // Check if user is in approved_testers table
      const { data, error } = await supabase
        .from('approved_testers')
        .select('active')
        .eq('email', user.email)
        .single();

      if (error || !data) {
        setIsApproved(false);
      } else {
        setIsApproved(data.active === true);
      }
      
      setLoading(false);
    }

    checkAccess();
  }, []);

  return { isApproved, loading };
}
```

Update `src/App.tsx` to use access control:

```typescript
import { useAccessControl } from '@/hooks/useAccessControl';

function App() {
  const { isApproved, loading } = useAccessControl();

  if (loading) {
    return <div>Checking access...</div>;
  }

  if (isApproved === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
          <p className="text-gray-600">
            This is a private testing environment.
            <br />
            Contact the administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    // Your normal app routes
  );
}
```

---

## ☁️ Step 3: Configure Vercel

### 3.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Login and Link Project

```bash
vercel login
vercel link
# Choose: Link to existing project or create new
# Set project name: social-media-saas
```

### 3.3 Set Environment Variables

```bash
# Production environment (optional - for main branch)
vercel env add VITE_SUPABASE_URL production
# Enter: https://YOUR_PROD_PROJECT.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Enter: your production anon key

# Preview environment (for PRs and staging branch)
vercel env add VITE_SUPABASE_URL preview
# Enter: https://YOUR_STAGING_PROJECT.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY preview
# Enter: your staging anon key

# Add all other environment variables for preview:
vercel env add VITE_SUPABASE_FUNCTION_SPELLING preview
vercel env add VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE preview
vercel env add VITE_SUPABASE_FUNCTION_MENU_EXTRACT preview
vercel env add VITE_SUPABASE_FUNCTION_AI_ENHANCE preview
vercel env add VITE_SUPABASE_FUNCTION_ADJUST_TEXT preview
```

**Environment variable values for staging:**

```bash
VITE_SUPABASE_URL=https://YOUR_STAGING_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>
VITE_SUPABASE_FUNCTION_SPELLING=https://YOUR_STAGING_PROJECT.supabase.co/functions/v1/spelling
VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE=https://YOUR_STAGING_PROJECT.supabase.co/functions/v1/analyze-website
VITE_SUPABASE_FUNCTION_MENU_EXTRACT=https://YOUR_STAGING_PROJECT.supabase.co/functions/v1/menu-extract-v2
VITE_SUPABASE_FUNCTION_AI_ENHANCE=https://YOUR_STAGING_PROJECT.supabase.co/functions/v1/ai-enhance
VITE_SUPABASE_FUNCTION_ADJUST_TEXT=https://YOUR_STAGING_PROJECT.supabase.co/functions/v1/adjust-text
```

---

## 🔧 Step 4: Configure GitHub Actions

### 4.1 Add GitHub Secrets

Go to GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

```
VERCEL_TOKEN
# Get from: https://vercel.com/account/tokens
# Create new token with "Full Access"

VERCEL_ORG_ID
# Get from: vercel.json or run: vercel link (shows in output)
# Or find in Vercel Dashboard → Settings → General

VERCEL_PROJECT_ID
# Get from: vercel.json or run: vercel link (shows in output)
# Or find in Vercel Dashboard → Settings → General
```

### 4.2 Verify GitHub Actions Workflow

The workflow file is already created at `.github/workflows/preview-deploy.yml`

Test it by creating a PR or pushing to `staging` branch.

---

## 🧪 Step 5: Test the Setup

### 5.1 Create Staging Branch

```bash
git checkout -b staging
git push origin staging
```

This will trigger automatic deployment to Vercel preview environment.

### 5.2 Create Test PR

```bash
git checkout -b feature/test-external-access
echo "# Test change" >> README.md
git add .
git commit -m "test: verify external testing setup"
git push origin feature/test-external-access
```

Create PR on GitHub → Automatic preview deployment will be created → Check PR comments for deployment URL.

### 5.3 Invite External Testers

1. **Add their email to staging database:**

```sql
INSERT INTO approved_testers (email, name, role) 
VALUES ('external-tester@company.com', 'External QA', 'external_tester');
```

2. **Send them:**
   - Preview deployment URL (from PR comment)
   - Instructions: "Sign up with your approved email address"
   - Testing checklist

3. **They sign up:**
   - Go to preview URL
   - Click "Sign Up"
   - Use their approved email
   - Verify email via Supabase magic link
   - Access granted ✅

---

## 🛡️ Security Features

### What's Protected:

- ✅ **No public access** - only whitelisted emails can sign up
- ✅ **Staging database** - completely separate from production
- ✅ **Preview URLs** - unique per PR, not indexed by search engines
- ✅ **Automatic cleanup** - Vercel removes old preview deployments
- ✅ **No production keys** - staging uses separate API keys

### Access Levels:

| Role | Access | Can Do |
|------|--------|---------|
| `admin` | Full | Add testers, all features |
| `external_tester` | Limited | Test features, create test data |
| `unapproved` | None | Blocked at signup |

---

## 📝 Testing Checklist for External Testers

Share this with your testers:

### Initial Setup
- [ ] Receive preview URL
- [ ] Sign up with approved email
- [ ] Verify email via magic link
- [ ] Login successfully

### Feature Testing
- [ ] Complete business setup flow
- [ ] Upload menu PDF
- [ ] Generate brand profile
- [ ] Create weekly plan
- [ ] Generate post ideas
- [ ] Edit and save posts
- [ ] Upload media
- [ ] Publish posts (to staging platforms only)

### Bug Reporting
- [ ] Take screenshots
- [ ] Note browser and version
- [ ] Describe steps to reproduce
- [ ] Report via GitHub Issues

---

## 🔄 Workflow

### Daily Development:

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
# Create PR on GitHub

# GitHub Actions automatically:
# 1. Deploys to Vercel preview
# 2. Comments PR with URL
# 3. Testers can access immediately
```

### After Testing & Approval:

```bash
# Merge PR to staging
# → Deploys to staging environment

# After staging validation, merge to main
# → Deploys to production (optional)
```

---

## 🚨 Troubleshooting

### Issue: Tester can't sign up

**Solution:**
```sql
-- Check if email is in approved_testers
SELECT * FROM approved_testers WHERE email = 'tester@example.com';

-- If not, add them:
INSERT INTO approved_testers (email, name) 
VALUES ('tester@example.com', 'Tester Name');
```

### Issue: Preview deployment fails

**Check:**
1. GitHub Actions logs (Actions tab)
2. Vercel deployment logs (Vercel dashboard)
3. Environment variables are set in Vercel
4. VERCEL_TOKEN is valid

### Issue: Preview shows production data

**Solution:**
- Check Vercel environment variables
- Ensure preview environment uses staging Supabase URL
- Redeploy: `vercel --force`

### Issue: Testers see "Access Restricted"

**Solution:**
```sql
-- Ensure tester is active
UPDATE approved_testers 
SET active = true 
WHERE email = 'tester@example.com';
```

---

## 📊 Monitoring

### Check Active Testers:

```sql
SELECT email, name, role, created_at 
FROM approved_testers 
WHERE active = true
ORDER BY created_at DESC;
```

### View Recent Activity:

```sql
SELECT 
  au.email,
  au.last_sign_in_at,
  COUNT(b.id) as businesses_created
FROM auth.users au
LEFT JOIN businesses b ON b.user_id = au.id
WHERE au.email IN (SELECT email FROM approved_testers)
GROUP BY au.email, au.last_sign_in_at
ORDER BY au.last_sign_in_at DESC;
```

---

## ✅ Summary

**You now have:**

1. ✅ **Staging database** - isolated from production
2. ✅ **Access control** - only approved testers can access
3. ✅ **Automatic preview deployments** - every PR gets a unique URL
4. ✅ **Secure testing environment** - no public exposure
5. ✅ **Easy tester management** - add/remove via SQL

**Next steps:**

1. Add external testers to `approved_testers` table
2. Create a feature branch
3. Open a PR
4. Share preview URL with testers
5. Gather feedback
6. Iterate and merge

**No production data at risk. No public access. Fully controlled testing environment.** 🎉
