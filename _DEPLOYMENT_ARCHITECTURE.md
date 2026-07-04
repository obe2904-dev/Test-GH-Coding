# Deployment Architecture

## Overview
This project uses a dual-environment setup to separate stable development (localhost) from external testing (Vercel).

## Environment Structure

### 1. Local Development Environment
- **URL**: http://localhost:3000
- **Supabase Project**: `kvqdkohdpvmdylqgujpn`
- **Supabase Dashboard**: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn
- **Git Branch**: `main`
- **Purpose**: Stable development environment with working features
- **Users**: Internal development and testing

### 2. Vercel Test Environment
- **URL**: https://social-media-saas-lvwj700yp-ole-s-projects-763bcc8d.vercel.app
- **Supabase Project**: `oadwluspjlsnxhgakral`
- **Supabase Dashboard**: https://supabase.com/dashboard/project/oadwluspjlsnxhgakral
- **Git Branch**: `vercel-test`
- **Purpose**: External user testing environment
- **Users**: External testers (e.g., obe2904@gmail.com on Free tier)

## Git Branch Strategy

### `main` Branch
- Clean, stable code for localhost development
- All features must work before merging here
- Localhost:3000 runs from this branch
- Protected from experimental changes

### `vercel-test` Branch
- Testing and debugging branch for Vercel deployment
- May contain debug logging and experimental fixes
- Vercel auto-deploys from this branch
- Changes here do NOT affect localhost

## Deployment Flow

### Local Development
```bash
# 1. Work on main branch
git checkout main

# 2. Make changes and test on localhost:3000
npm run dev

# 3. Commit stable changes
git add .
git commit -m "feat: description"
git push origin main
```

### Vercel Testing
```bash
# 1. Switch to vercel-test branch
git checkout vercel-test

# 2. Merge or cherry-pick changes from main
git merge main
# OR apply specific fixes

# 3. Push to trigger Vercel deployment
git push origin vercel-test
```

## Supabase Configuration

### Localhost Supabase (kvqdkohdpvmdylqgujpn)
**Environment Variables (.env.local)**:
```
VITE_SUPABASE_URL=https://kvqdkohdpvmdylqgujpn.supabase.co
VITE_SUPABASE_ANON_KEY=[key]
VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE=[endpoint]
```

### Vercel Supabase (oadwluspjlsnxhgakral)
**Vercel Environment Variables**:
```
VITE_SUPABASE_URL=https://oadwluspjlsnxhgakral.supabase.co
VITE_SUPABASE_ANON_KEY=[key]
VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE=[endpoint]
```

**Edge Functions**:
- `generate-text-from-idea` (v6, 199 kB)
- `get-quick-suggestions`
- Secrets: `OPENAI_API_KEY`, `GEMINI_API_KEY`

## Key Differences

### Data Isolation
- **Completely separate databases**: Changes in Vercel test environment do NOT affect localhost data
- **Separate user accounts**: Users created in one environment are independent from the other
- **Independent Edge Functions**: Each Supabase project has its own deployed Edge Functions

### Code Separation
- **Separate Git branches**: Frontend code can differ between environments
- **Independent deployments**: Vercel deploys from `vercel-test`, localhost runs from `main`
- **No cross-contamination**: Debug changes in Vercel don't break localhost

## User Accounts

### Localhost (kvqdkohdpvmdylqgujpn)
- Development users
- Full feature access
- Test data

### Vercel (oadwluspjlsnxhgakral)
- External testers
- Example: obe2904@gmail.com (Free tier)
- Business ID: 904e23aa-8548-47d8-b2da-1f75bfccd2fa (Cafe Faust)
- Limited to Free tier features

## Vercel Configuration

### Project Settings
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Production Branch**: `vercel-test` (NOT `main`)

### Auto-Deploy
- Push to `vercel-test` → Triggers automatic deployment
- Deployment URL remains constant
- Build logs available at: https://vercel.com/dashboard

## Troubleshooting

### Issue: Changes not reflected in localhost
**Solution**: 
1. Verify you're on `main` branch: `git branch`
2. Pull latest: `git pull origin main`
3. Restart dev server: Stop (Ctrl+C) and `npm run dev`

### Issue: Changes not reflected in Vercel
**Solution**:
1. Verify you pushed to `vercel-test`: `git push origin vercel-test`
2. Check Vercel deployment status: https://vercel.com/dashboard
3. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Issue: Wrong Supabase project being used
**Solution**:
1. Check environment variables in Vercel dashboard
2. Check `.env.local` for localhost
3. Verify URL in browser matches expected environment

## Important Notes

1. **Never commit `.env.local`** - Contains sensitive keys
2. **Test in localhost FIRST** - Only push working features to `main`
3. **Vercel is for testing** - Not production deployment
4. **Database migrations** - Must be applied to BOTH Supabase projects separately
5. **Edge Functions** - Deploy separately to each Supabase project using `npx supabase functions deploy --project-ref [PROJECT_ID]`

## Current Status

- ✅ Localhost: Working on `main` branch
- ✅ Vercel: Deploying from `vercel-test` branch  
- ✅ Branches separated and pushed
- ⚠️ Vercel production branch needs to be changed from `main` to `vercel-test` in settings
