# Delete Account Feature - Deployment Guide

## Overview
This feature allows users to permanently delete their account and all associated data from the Indstillinger (Settings) page.

## What Gets Deleted
When a user deletes their account, the following data is permanently removed:
- User authentication account (from `auth.users`)
- User profile (from `public.profiles`)
- Any data with foreign key relationships to the user (via CASCADE)

## Database Migration

### Step 1: Deploy the Migration
Run the SQL migration to create the `delete_user_account()` function:

```bash
# Navigate to your project directory
cd /Users/olebaek/Test\ GH\ Coding

# Apply the migration using Supabase CLI
supabase db push

# Or manually run the SQL in Supabase SQL Editor
```

### Step 2: Manual SQL Execution (Alternative)
If you prefer to run manually in the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/002_delete_user_function.sql`
4. Paste and execute the SQL

## Frontend Implementation

### Files Modified
1. **`src/stores/authStore.ts`** - Added `deleteAccount()` method
2. **`src/pages/dashboard/SettingsPage.tsx`** - Added delete account UI with safety modal
3. **`src/lib/locales/da.json`** - Added Danish translations
4. **`src/lib/locales/en.json`** - Added English translations

### Safety Features
✅ **Confirmation Modal** - User must explicitly confirm deletion
✅ **Text Confirmation** - User must type "SLET" (Danish) or "DELETE" (English)
✅ **Warning Messages** - Clear explanation of what will be deleted
✅ **Language-Aware** - Works correctly in both Danish and English
✅ **Loading State** - Button disabled during deletion
✅ **Error Handling** - Shows error messages if deletion fails

## User Flow
1. User navigates to **Indstillinger** (Settings) via Sidebar
2. Scrolls to "Slet min profil" (Delete My Profile) section
3. Clicks red "Slet min profil" button
4. Modal appears with:
   - Warning icon and "Er du sikker?" (Are you sure?)
   - List of what will be deleted
   - Text input requiring "SLET" or "DELETE"
5. User types confirmation text
6. "Slet permanent" button becomes enabled
7. User clicks to confirm
8. Account deleted → Redirected to login page

## Testing

### Test in Development
1. Start dev server: `npm run dev`
2. Log in with a test account
3. Navigate to Settings
4. Test the delete flow:
   - Try canceling (should close modal)
   - Try submitting without typing confirmation (should show error)
   - Try with wrong text (should show error)
   - Try with correct text (should delete account)

### Test Language Switching
1. Switch to Danish → Confirmation text should be "SLET"
2. Switch to English → Confirmation text should be "DELETE"
3. Placeholders and button text should update accordingly

## Security Considerations

### Database Function
- Uses `SECURITY DEFINER` to execute with elevated privileges
- Only deletes data for authenticated user (`auth.uid()`)
- Checks authentication before proceeding
- Grants execute permission only to `authenticated` role

### Frontend
- Uses RPC call through Supabase client (secure)
- No direct database access from frontend
- User must be authenticated to call function
- Proper error handling prevents data leaks

## Rollback
If you need to remove this feature:

```sql
-- Remove the function
DROP FUNCTION IF EXISTS public.delete_user_account();
```

Then revert the frontend changes:
```bash
git revert <commit-hash>
```

## Future Enhancements
- [ ] Send confirmation email before deletion
- [ ] Add grace period (30 days to recover account)
- [ ] Export user data before deletion (GDPR compliance)
- [ ] Admin dashboard to view deletion requests
- [ ] Analytics on why users delete accounts

## Support
If users encounter issues deleting their account:
1. Check Supabase logs for RPC errors
2. Verify migration was applied correctly
3. Ensure user is authenticated
4. Check for foreign key constraints blocking deletion
