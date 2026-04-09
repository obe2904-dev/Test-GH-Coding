# Debug Signup Email Issue

## Quick Diagnostics

Please provide the following information:

### 1. What happens when you try to sign up?
- [ ] Does the signup complete (says "Account created!")?
- [ ] Do you get an error message? If yes, what does it say?
- [ ] Do you see the success message but no email arrives?
- [ ] Does it redirect you somewhere?

### 2. Check Browser Console
Open browser DevTools (F12 or Cmd+Opt+I) and:
1. Go to Console tab
2. Try signing up
3. Look for any errors or warnings
4. **Share any red error messages you see**

### 3. Check Network Tab
1. Open DevTools → Network tab
2. Filter by "auth" or "signup"
3. Try signing up
4. Look for the signup request
5. Click on it and check:
   - Request payload (what was sent)
   - Response (what Supabase returned)
   - **Share the response JSON**

### 4. Check Supabase Dashboard

#### Email Configuration
Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/auth/providers

Check:
- [ ] Is "Email" provider enabled?
- [ ] Is "Confirm email" checked or unchecked?
- [ ] What does it say for "Confirm email" setting?

**IMPORTANT:** If "Confirm email" is UNCHECKED, emails won't be sent (users are auto-confirmed).

#### URL Configuration
Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/auth/url-configuration

Check:
- [ ] What is the "Site URL"? (should be `http://localhost:3002` for dev)
- [ ] What redirect URLs are listed?

#### Auth Logs
Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/logs/auth-logs

After trying to sign up:
- [ ] Do you see a signup event?
- [ ] Is there an email_sent event?
- [ ] Any errors in the logs?
- **Share what you see**

### 5. Test with Updated Code

The code has been updated. Make sure you're testing on the latest version:

```bash
# Server should be running on http://localhost:3002
# Go to: http://localhost:3002/signup
# Try creating an account
```

### 6. Common Issues Checklist

Check these common problems:

#### Issue A: Auto-Confirm Enabled (No emails sent by design)
If Supabase is set to auto-confirm users, it won't send confirmation emails.

**To check:**
- Go to Auth → Providers → Email
- Look for "Confirm email" toggle
- **If UNCHECKED** → Users are auto-confirmed (no email sent)
- **If CHECKED** → Confirmation emails should be sent

#### Issue B: Email Rate Limiting
Free tier: 3 emails per hour

**To check:**
- Have you tried signing up more than 3 times in the last hour?
- Wait 1 hour and try again

#### Issue C: Wrong Email Address
**To check:**
- Are you using a valid email address?
- Try with a Gmail or similar mainstream provider
- Check spam folder

#### Issue D: SMTP Not Configured
**To check:**
- Go to Settings → Authentication → SMTP Settings
- Is custom SMTP configured?
- If not, Supabase uses default (can be unreliable)

## Expected Behavior

### With Email Confirmation ENABLED:
1. User submits signup form
2. Account is created but NOT confirmed
3. Confirmation email is sent
4. User must click link in email
5. After clicking link, account is confirmed
6. User can then log in

### With Email Confirmation DISABLED (Auto-Confirm):
1. User submits signup form
2. Account is created AND automatically confirmed
3. NO email is sent
4. User can immediately log in
5. Shows success message

## What to Share

Please provide:
1. Screenshot of Auth → Providers → Email settings
2. Screenshot or text of any console errors
3. The response from the signup API call (Network tab)
4. Current "Confirm email" setting status
5. What you see in Auth Logs after signup attempt

This will help me identify the exact issue!
