# External Testing Quick Start

**Goal:** Set up secure external testing in ~30 minutes

---

## 🏗️ Architecture Overview

You will have **TWO completely separate Supabase projects**:

```
┌─────────────────────────────────────────────────────────────┐
│                     PRODUCTION                              │
│  Project Ref: kvqdkohdpvmdylqgujpn                         │
│  Used by: Real customers, your main app                    │
│  Data: Real customer data, real businesses                 │
│  Access: Public (anyone can sign up)                       │
│  Testers: ❌ NO external testers here!                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   STAGING (NEW!)                            │
│  Project Ref: [YOUR_NEW_REF] ← You'll create this         │
│  Used by: External testers, preview deployments            │
│  Data: Test data only, can be wiped anytime                │
│  Access: Restricted (whitelist only)                       │
│  Testers: ✅ Safe for external testers                     │
└─────────────────────────────────────────────────────────────┘
```

**Why two projects?**
- ✅ Testers can't see or break production
- ✅ Testing bugs don't affect real customers  
- ✅ Different API keys = zero production exposure
- ✅ Can reset staging anytime without fear

---

## ☑️ Prerequisites Checklist

- [ ] GitHub repository created
- [ ] Vercel account created (free tier: https://vercel.com/signup)
- [ ] Access to Supabase dashboard

---

## 🚀 Setup Steps

### 1️⃣ Create NEW Staging Supabase Project (5 min)

**⚠️ CRITICAL: Create a BRAND NEW Supabase project - DO NOT use your existing production project!**

**Why separate projects:**
- ✅ Testers can't access/modify production data
- ✅ Testing bugs won't affect real customers
- ✅ Different API keys = no production exposure
- ✅ Can reset/wipe staging data anytime

**Steps:**

1. Go to https://supabase.com/dashboard
2. Click "**New Project**" (top right)
3. Organization: Same as your production project
4. Name: `social-media-saas-staging` 
5. Database Password: **Set a NEW password** (save it!)
6. Region: Choose same as production (e.g., `Frankfurt (eu-central-1)`)
7. Pricing Plan: Free tier is fine for testing
8. Click "Create new project"
9. ⏱️ Wait 2-3 minutes for project to initialize

**Save these credentials (you'll need them later):**

```bash
# From Project Settings → API
STAGING_URL=https://YOUR_NEW_STAGING_REF.supabase.co
STAGING_ANON_KEY=eyJhbGc...  # Different from production!

# From Project Settings → General  
STAGING_PROJECT_REF=xxxxxxxxxx  # e.g., abcd1234wxyz
```

**✅ Verify you have 2 separate projects:**
- Production: `kvqdkohdpvmdylqgujpn` (your existing one)
- Staging: `YOUR_NEW_STAGING_REF` (just created)

### 2️⃣ Copy Database Schema (5 min)

**Goal:** Copy database structure FROM production TO new staging project (no data copied)

**Option A: Export from Production (Recommended)**

```bash
# In terminal
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Make sure you're linked to PRODUCTION project
npx supabase status
# Should show: kvqdkohdpvmdylqgujpn (your production project)

# Export schema only (no data)
npx supabase db dump --schema public > staging-schema.sql

# You now have: staging-schema.sql (structure only, no customer data)
```

**Apply to NEW Staging Project:**

1. Go to Supabase Dashboard → **Switch to staging project** (dropdown top-left)
2. Verify you're in staging: URL shows `YOUR_NEW_STAGING_REF`
3. Go to SQL Editor
4. Click "New query"
5. Open `staging-schema.sql` in text editor
6. Copy entire contents
7. Paste into SQL Editor
8. Click "Run" (⌘/Ctrl + Enter)
9. Wait for completion (~30 seconds)

**✅ Verify schema copied:**

```sql
-- Run in Staging SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should see: businesses, business_profile, menu_items_normalized, etc.
```

**Option B: Use Supabase Migration (If you have migrations folder)**

```bash
# Link to NEW staging project
npx supabase link --project-ref YOUR_NEW_STAGING_REF

# Push all migrations
npx supabase db push

# Unlink staging (so you don't accidentally deploy there)
npx supabase unlink
```

### 3️⃣ Create Tester Whitelist (3 min)

**⚠️ Run this in STAGING project ONLY (not production!)**

**Verify you're in staging:**
1. Go to Supabase Dashboard
2. Check top-left dropdown: Should show `social-media-saas-staging`
3. URL should be: `...supabase.co/project/YOUR_NEW_STAGING_REF/...`

**Run in Supabase Staging → SQL Editor:**

```sql
-- Create approved testers table
-- This table should ONLY exist in staging, NEVER in production!
CREATE TABLE approved_testers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'tester',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

ALTER TABLE approved_testers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can check approval"
  ON approved_testers FOR SELECT USING (true);

-- Add your testers (EDIT THESE EMAILS!)
INSERT INTO approved_testers (email, name, role) VALUES
  ('your-email@gmail.com', 'Your Name', 'admin'),
  ('tester1@example.com', 'External Tester 1', 'tester');
```

**✅ Verify whitelist created:**

```sql
-- Should return your testers
SELECT email, name, role FROM approved_testers;
```

**🚨 CRITICAL: Do NOT create this table in production!**
- Production should NOT have `approved_testers` table
- This table only exists in staging
- Keeps production access unrestricted for real customers

### 4️⃣ Set Up Vercel (10 min)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login
# Follow browser authentication

# Link project
vercel link
# Choose: Create new project
# Name: social-media-saas

# Add environment variables for PREVIEW environment
# ⚠️ Use STAGING Supabase credentials (not production!)

vercel env add VITE_SUPABASE_URL preview
# Paste: https://YOUR_NEW_STAGING_REF.supabase.co
# NOT production URL!

vercel env add VITE_SUPABASE_ANON_KEY preview
# Paste: your NEW staging anon key (from step 1)
# NOT production anon key!

# Add staging function URLs
vercel env add VITE_SUPABASE_FUNCTION_MENU_EXTRACT preview
# Paste: https://YOUR_NEW_STAGING_REF.supabase.co/functions/v1/menu-extract-v2

vercel env add VITE_SUPABASE_FUNCTION_AI_ENHANCE preview
# Paste: https://YOUR_NEW_STAGING_REF.supabase.co/functions/v1/ai-enhance

vercel env add VITE_SUPABASE_FUNCTION_ADJUST_TEXT preview
# Paste: https://YOUR_NEW_STAGING_REF.supabase.co/functions/v1/adjust-text

vercel env add VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE preview
# Paste: https://YOUR_NEW_STAGING_REF.supabase.co/functions/v1/analyze-website

vercel env add VITE_SUPABASE_FUNCTION_SPELLING preview
# Paste: https://YOUR_NEW_STAGING_REF.supabase.co/functions/v1/spelling
```

**✅ Verify Vercel environment variables:**

```bash
# List preview environment variables
vercel env ls

# Should see:
# VITE_SUPABASE_URL (preview) = https://YOUR_NEW_STAGING_REF.supabase.co
# NOT the production URL (kvqdkohdpvmdylqgujpn)
```

### 5️⃣ Configure GitHub Actions (5 min)

**Get Vercel credentials:**

```bash
# Generate token
# Go to: https://vercel.com/account/tokens
# Create new token → Copy it

# Get project IDs
vercel link
# Shows: Org ID and Project ID in output
```

**Add GitHub secrets:**

1. Go to GitHub repo → Settings → Secrets → Actions
2. Add these secrets:
   - `VERCEL_TOKEN` = (token from above)
   - `VERCEL_ORG_ID` = (from vercel link output)
   - `VERCEL_PROJECT_ID` = (from vercel link output)

### 6️⃣ Deploy Edge Functions to Staging (5 min)

**⚠️ IMPORTANT: Deploy to NEW staging project, not production!**

npx supabase functions deploy brand-profile-generator-v5
```

**Set the safe-rollout menu extraction secrets in staging only:**

```bash
# Enable broader routing only for one test business at first
npx supabase secrets set MENU_EXTRACT_BROADENED_ROUTING_ENABLED=true
npx supabase secrets set MENU_EXTRACT_BROADENED_ROUTING_TEST_ONLY=true
npx supabase secrets set MENU_EXTRACT_BROADENED_ROUTING_BUSINESS_IDS=YOUR_TEST_BUSINESS_ID
```

Keep `MENU_EXTRACT_BROADENED_ROUTING_TEST_ONLY=true` until you have confirmed the broader crawler does not regress existing working menus.
```bash
# Link to NEW staging Supabase project
npx supabase link --project-ref YOUR_NEW_STAGING_REF

# Verify you're linked to staging (not production!)
npx supabase status
# Should show: YOUR_NEW_STAGING_REF

# Deploy critical functions to staging
npx supabase functions deploy generate-text-from-idea --no-verify-jwt
npx supabase functions deploy get-weekly-strategy --no-verify-jwt
npx supabase functions deploy brand-profile-generator-v5
npx supabase functions deploy menu-extract-v2

# Deploy other functions as needed:
npx supabase functions deploy analyze-website
npx supabase functions deploy spelling
npx supabase functions deploy ai-enhance
npx supabase functions deploy adjust-text
npx supabase functions deploy populate-location-intelligence

# Unlink from staging (safety - prevents accidental deployments)
npx supabase unlink

# Re-link to production for normal development
npx supabase link --project-ref kvqdkohdpvmdylqgujpn
```

**Set Edge Function Secrets (Staging Project Only):**

1. Go to Supabase Dashboard → **Switch to staging project**
2. Project Settings → Edge Functions → Manage secrets
3. Add these secrets:

```bash
OPENAI_API_KEY=sk-...  # Your OpenAI key (same as prod is fine)
OPENWEATHERMAP_API_KEY=...  # Your weather key (same as prod is fine)
```

**✅ Verify deployment:**

Test a function:
```bash
curl -i --location --request POST \
  'https://YOUR_NEW_STAGING_REF.supabase.co/functions/v1/spelling' \
  --header 'Content-Type: application/json' \
  --data '{"text":"Helo wrold"}'

# Should return: {"corrected":"Hello world",...}
```

---

## ✅ Test It

### ⚠️ Pre-Flight Check

**Verify you have TWO separate Supabase projects:**

| Project | Project Ref | URL | Purpose |
|---------|-------------|-----|---------|
| **Production** | `kvqdkohdpvmdylqgujpn` | `https://kvqdkohdpvmdylqgujpn.supabase.co` | Real customers, real data |
| **Staging** | `YOUR_NEW_REF` | `https://YOUR_NEW_REF.supabase.co` | Testing only |

**✅ Checklist:**
- [ ] Staging project has different project ref
- [ ] Staging project has different anon key  
- [ ] Vercel preview environment uses staging credentials
- [ ] Edge functions deployed to staging project
- [ ] `approved_testers` table exists in staging (not production)

### Create Test PR

```bash
# Create staging branch
git checkout -b staging
git push origin staging

# Create test branch
git checkout -b test/external-setup
echo "# Test" >> README.md
git add .
git commit -m "test: verify external testing"
git push origin test/external-setup
```

**On GitHub:**
1. Create PR: `test/external-setup` → `staging`
2. Wait 2-3 minutes
3. Check PR comments for deployment URL
4. Click URL → Try signing up with approved email ✅

---

## 🎯 What Happens Now

**Every time you create a PR:**
1. GitHub Actions automatically deploys to Vercel
2. PR gets commented with preview URL
3. External testers can access it
4. They sign up with their approved email
5. Access granted ✅

**Security:**
- ❌ Unapproved emails cannot sign up
- ❌ No access to production database
- ❌ Preview URLs not indexed by Google
- ✅ Only whitelisted testers get in

---

## 📝 Add More Testers

```sql
-- Run in Supabase Staging → SQL Editor
INSERT INTO approved_testers (email, name, role) 
VALUES ('new-tester@example.com', 'New Tester', 'tester');
```

---

## 🚨 Quick Troubleshooting

**"Deployment failed"**
→ Check GitHub Actions logs (Actions tab)

**"Access restricted"**
→ Check tester's email is in `approved_testers` table

**"Environment variable not found"**
→ Re-run: `vercel env add VITE_SUPABASE_URL preview`

**"Function not found"**
→ Deploy to staging: `npx supabase functions deploy <function-name>`

**"Which Supabase project am I in?"**
→ Check top-left dropdown in Supabase Dashboard
→ Or run: `npx supabase status` in terminal

---

## 🔒 Safety Verification

**Before giving access to external testers, verify:**

### Production is Protected ✅

```bash
# In terminal, check which project you're linked to
npx supabase status

# Should show: kvqdkohdpvmdylqgujpn (production)
# If it shows staging ref, run: npx supabase link --project-ref kvqdkohdpvmdylqgujpn
```

### Staging is Isolated ✅

```bash
# Check Vercel preview environment
vercel env ls

# VITE_SUPABASE_URL should be staging URL (not kvqdkohdpvmdylqgujpn)
```

### Tester Whitelist is Staging-Only ✅

```sql
-- Run in PRODUCTION Supabase SQL Editor
SELECT * FROM approved_testers;
-- Should return: ERROR: relation "approved_testers" does not exist
-- ✅ Good! This table should NOT exist in production

-- Run in STAGING Supabase SQL Editor  
SELECT * FROM approved_testers;
-- Should return: List of approved testers
-- ✅ Good! Table exists in staging only
```

### Two Separate Databases ✅

| Check | Production | Staging |
|-------|-----------|---------|
| Has `approved_testers` table | ❌ No | ✅ Yes |
| Has real customer data | ✅ Yes | ❌ No |
| Vercel preview uses this | ❌ No | ✅ Yes |
| Testers can access | ❌ No | ✅ Yes |

---

## ✨ Done!

You now have:
- ✅ Secure staging environment
- ✅ Automatic preview deployments
- ✅ Restricted access (whitelist only)
- ✅ No production data exposure

**Next:** Create a PR and share the preview URL with your testers!
