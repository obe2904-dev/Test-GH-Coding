# Email Confirmation Troubleshooting Guide

## Issue
Users are not receiving confirmation emails after signing up.

## Fix Applied
✅ Updated `authStore.ts` to include `emailRedirectTo` option in the `signUp` function.

## Required Supabase Configuration Checks

### 1. Check Email Provider Settings
Go to your Supabase Dashboard → **Authentication** → **Providers**

**Check these settings:**
- [ ] Email provider is **enabled**
- [ ] "Confirm email" is **enabled** (this is usually ON by default)
- [ ] "Secure email change" is configured

### 2. Verify Site URL Configuration
Go to **Authentication** → **URL Configuration**

**Set these URLs:**
- **Site URL**: `http://localhost:5173` (for development) or your production URL
- **Redirect URLs**: Add these allowed redirect URLs:
  ```
  http://localhost:5173/**
  http://localhost:5173/login
  http://localhost:5173/onboarding
  https://yourdomain.com/**
  https://yourdomain.com/login
  https://yourdomain.com/onboarding
  ```

### 3. Check Email Rate Limiting (Free Tier)
Supabase Free tier has email rate limits:
- **3 emails per hour** for free projects
- Check if you've hit the limit

**To check:**
1. Go to **Authentication** → **Rate Limits**
2. Look for email rate limit warnings

**Workaround during development:**
- Wait an hour between tests
- Or temporarily disable email confirmation (see section 5)

### 4. Check Email Templates
Go to **Authentication** → **Email Templates**

**Verify the "Confirm signup" template:**
```html
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

**Important:** Make sure the template has `{{ .ConfirmationURL }}` or similar variables.

### 5. Disable Email Confirmation (Development Only)
If you want to skip email confirmation during development:

1. Go to **Authentication** → **Providers** → **Email**
2. **Uncheck** "Confirm email"
3. **Warning:** Users can sign up without verifying their email. Re-enable this in production!

### 6. Check Email Service (Supabase Default vs Custom SMTP)

#### Option A: Use Supabase Default Email (Development)
- Supabase sends emails from `noreply@mail.app.supabase.io`
- These emails often go to **spam folders**
- Check your spam/junk folder!

#### Option B: Configure Custom SMTP (Production)
For production, set up custom SMTP:

1. Go to **Settings** → **Authentication**
2. Scroll to **SMTP Settings**
3. Configure your email provider:
   - **Provider**: Choose (SendGrid, AWS SES, Resend, etc.)
   - **SMTP Host**
   - **SMTP Port**
   - **Username**
   - **Password**
   - **Sender email**
   - **Sender name**

**Recommended providers:**
- **Resend** (developer-friendly, generous free tier)
- **SendGrid** (reliable)
- **AWS SES** (cheap for high volume)

### 7. Test Email Sending

After configuration, test by:

1. Creating a new account with a real email address
2. **Check spam folder** immediately
3. Check Supabase logs: **Logs** → **Auth Logs**
4. Look for email sending events

### 8. Verify Code Changes

The code fix adds the redirect URL:

```typescript
signUp: async (email: string, password: string, metadata?: Record<string, unknown>) => {
  const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      ...(metadata ? { data: metadata } : {}),
      emailRedirectTo,  // ← This tells Supabase where to redirect after confirmation
    },
  })
  if (error) throw error
},
```

## Quick Test Checklist

1. [ ] Code updated with `emailRedirectTo`
2. [ ] Site URL configured in Supabase
3. [ ] Email provider enabled
4. [ ] Redirect URLs added to allowlist
5. [ ] Checked spam folder
6. [ ] Verified email rate limit not exceeded
7. [ ] Checked Auth Logs in Supabase for errors

## Common Issues & Solutions

### Issue: Emails go to spam
**Solution:** 
- For development: Check spam folder
- For production: Set up custom SMTP with your domain

### Issue: Rate limit exceeded
**Solution:** 
- Wait 1 hour
- Upgrade to paid plan (removes limits)
- Temporarily disable email confirmation for dev

### Issue: "Email link is invalid or has expired"
**Solution:**
- Check Site URL matches your domain
- Ensure redirect URLs are allowlisted
- Links expire after 24 hours

### Issue: No email at all
**Solution:**
1. Check Supabase Auth Logs for errors
2. Verify email provider is enabled
3. Check SMTP configuration (if using custom)
4. Verify rate limits

## After Making Changes

After updating Supabase settings:
1. Rebuild your app: `npm run build`
2. Restart dev server: `npm run dev`
3. Clear browser cache
4. Try signing up with a fresh email address
5. Check spam folder

## Need More Help?

If issues persist:
1. Check Supabase Auth Logs: Dashboard → Logs → Auth Logs
2. Look for specific error messages
3. Check browser console for JavaScript errors
4. Verify network requests in browser DevTools

## Production Checklist

Before going to production:
- [ ] Custom SMTP configured
- [ ] Email confirmation **enabled**
- [ ] Site URL set to production domain
- [ ] All redirect URLs allowlisted
- [ ] Email templates customized with your branding
- [ ] Test email delivery thoroughly
- [ ] Monitor email delivery rates
