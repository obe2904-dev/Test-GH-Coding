# Draft System Setup Guide

## ✅ Completed Implementation

The Word/Google Docs-style draft system for Free plan users has been fully implemented with these features:

### Features Implemented

1. **Manual Save Button** ("Gem kladde")
   - Fixed bottom-right floating button with status indicator
   - Shows three states:
     - "Ikke gemt" (gray) - Changes not saved
     - "Gemmer..." (blue) - Currently saving
     - "Gemt" (green) - Successfully saved

2. **Local Recovery** (Auto-save to localStorage)
   - Saves draft every 10 seconds to localStorage
   - On page reload, shows modal: "Jeg fandt en tidligere kladde — vil du fortsætte med den?"
   - Two options: "Nej, start forfra" or "Ja, gendan kladde"
   - Only recovers drafts less than 24 hours old

3. **Exit Warning**
   - Browser confirmation dialog if user has unsaved changes
   - Message: "Du har ændringer, der ikke er gemt"
   - Prevents accidental data loss

### Files Created

- ✅ `src/hooks/useDraftAutoRecover.ts` - LocalStorage recovery hook
- ✅ `src/hooks/useDraftSave.ts` - Manual save to database hook
- ✅ `src/components/ui/SaveStatus.tsx` - Status indicator component
- ✅ `src/components/ui/DraftRecoveryModal.tsx` - Recovery prompt modal
- ✅ `supabase/migrations/006_post_drafts.sql` - Database table migration

### Files Modified

- ✅ `src/pages/dashboard/CreatePostPage.tsx` - Added draft hooks and UI
- ✅ `src/components/post-creation/GenerateStep.tsx` - Added markAsChanged callback
- ✅ `src/components/post-creation/CreateStep.tsx` - Added markAsChanged callback

### Change Tracking

The system automatically marks the draft as changed when:
- User types in the text area (GenerateStep)
- User uploads a photo (CreateStep)

## 🚀 Next Steps

### 1. Run Database Migration (REQUIRED)

You need to create the `post_drafts` table in Supabase:

1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the contents of `supabase/migrations/006_post_drafts.sql`
5. Paste into the query editor
6. Click "Run" to execute

**Verify it worked:**
```sql
SELECT * FROM post_drafts LIMIT 1;
```

### 2. Test the Draft System

**Test Manual Save:**
1. Go to Create Post page
2. Type some text in GenerateStep
3. Notice "Ikke gemt" appears in bottom-right
4. Click "Gem kladde" button
5. Status should change to "Gemmer..." then "Gemt"
6. Check Supabase dashboard: `SELECT * FROM post_drafts;`

**Test Local Recovery:**
1. Type some text (don't click save)
2. Wait 10+ seconds (auto-save to localStorage)
3. Close the browser tab
4. Return to Create Post page
5. Modal should appear: "Jeg fandt en tidligere kladde"
6. Click "Ja, gendan kladde"
7. Your text should be restored

**Test Exit Warning:**
1. Type some text
2. Try to close the tab or navigate away
3. Browser should show: "Du har ændringer, der ikke er gemt"
4. Can choose to stay or leave

### 3. UI Adjustments (Optional)

The save button is currently in a fixed bottom-right position. You mentioned:
> "The save button should not disturb the layout, but there - please proceed as you see best, and then we can adjust afterwards"

If you'd like to change the position, edit `CreatePostPage.tsx` around line 100:

```tsx
{/* Save Draft Button - Fixed bottom-right */}
<div className="fixed bottom-6 right-6 flex items-center gap-3 bg-white rounded-lg shadow-lg px-4 py-3 border border-slate-200 z-50">
```

Alternative positions:
- **Top-right header:** Change to `top-6 right-6`
- **Sticky header:** Remove `fixed`, add `sticky top-0`
- **Inline with steps:** Move inside the `<div className="max-w-6xl mx-auto">` container

### 4. Known Limitations

**Current behavior:**
- Draft saves to database only when user clicks "Gem kladde"
- LocalStorage saves automatically every 10 seconds (not shown to user)
- Only saves text content, platforms, photos, and photo ideas
- No draft list view (shows only latest draft)
- No draft naming or organization

**Future enhancements (if needed):**
- Auto-load saved draft from database on mount
- Draft history/list view
- Draft naming feature
- Auto-delete draft after successful publish
- Sync localStorage and database drafts

## 📝 System Architecture

### Data Flow

```
User types text
    ↓
markAsChanged() called
    ↓
hasUnsavedChanges = true
    ↓
"Ikke gemt" appears
    ↓
User clicks "Gem kladde"
    ↓
saveDraft() called
    ↓
Data saved to post_drafts table
    ↓
lastSaved updated
    ↓
"Gemt" appears
```

### Storage Locations

1. **Database (post_drafts table):**
   - Manual saves via "Gem kladde" button
   - Persists across devices
   - Requires authentication
   - Can be queried/listed

2. **LocalStorage (post2grow_draft_recovery):**
   - Auto-saves every 10 seconds
   - Local to this browser only
   - Works offline
   - Expires after 24 hours
   - Used for crash recovery

### Hook Responsibilities

**useDraftSave:**
- Manual save to database
- Track isSaving, lastSaved, hasUnsavedChanges
- Exit warning (beforeunload)
- Load draft from database

**useDraftAutoRecover:**
- Auto-save to localStorage every 10 seconds
- Check for recoverable draft on mount
- Show recovery modal
- Restore draft to store

## 🔍 Debugging

If something doesn't work:

**Check browser console:**
```javascript
// Check localStorage
localStorage.getItem('post2grow_draft_recovery')

// Clear localStorage
localStorage.removeItem('post2grow_draft_recovery')
```

**Check Supabase:**
```sql
-- View all drafts
SELECT * FROM post_drafts;

-- View drafts for specific user
SELECT * FROM post_drafts WHERE user_id = 'YOUR_USER_ID';

-- Delete all drafts (testing only)
DELETE FROM post_drafts;
```

**Check RLS policies:**
```sql
-- Should show 4 policies (SELECT, INSERT, UPDATE, DELETE)
SELECT * FROM pg_policies WHERE tablename = 'post_drafts';
```

## ✨ Success Criteria

The draft system is working correctly when:

1. ✅ "Ikke gemt" appears when typing
2. ✅ "Gem kladde" button saves successfully
3. ✅ "Gemt" status appears after save
4. ✅ Browser warns on exit with unsaved changes
5. ✅ Recovery modal appears after closing and reopening
6. ✅ Draft data is restored correctly
7. ✅ Data persists in Supabase database

---

**Ready to test!** The system is fully implemented and ready for use once you run the migration.
