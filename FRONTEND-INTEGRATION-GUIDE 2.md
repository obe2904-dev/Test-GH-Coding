# FRONTEND INTEGRATION GUIDE
## Menu Overview Summary + Brand Profile V5

---

## 🎯 GOAL

Update the "Regenerate" button in `/dashboard/brand` to call TWO Edge Functions in sequence:

1. **First:** `menu-overview-summary` (generates cross-menu summary)
2. **Then:** `brand-profile-generator-v5` (uses the pre-generated summary)

---

## 📍 CURRENT STATE

**File:** Likely in `app/dashboard/brand/page.tsx` or similar

**Current Button:**
```tsx
<button onClick={handleRegenerate}>
  🔄 Regenerate
</button>
```

**Current Handler (example):**
```tsx
const handleRegenerate = async () => {
  const response = await fetch(
    'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseToken}`
      },
      body: JSON.stringify({ businessId })
    }
  )
  // handle response...
}
```

---

## ✅ NEW IMPLEMENTATION

Replace the handler with sequential calls:

```tsx
const handleRegenerate = async () => {
  setIsRegenerating(true)
  setError(null)
  
  try {
    // ========================================================================
    // STEP 1: Generate Menu Overview Summary
    // ========================================================================
    console.log('🍽️  Generating menu overview summary...')
    
    const menuSummaryResponse = await fetch(
      'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/menu-overview-summary',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`
        },
        body: JSON.stringify({ businessId })
      }
    )
    
    if (!menuSummaryResponse.ok) {
      throw new Error('Failed to generate menu overview summary')
    }
    
    const menuSummaryResult = await menuSummaryResponse.json()
    console.log('✅ Menu overview summary generated:', menuSummaryResult)
    
    // ========================================================================
    // STEP 2: Generate Brand Profile V5 (reads the menu summary)
    // ========================================================================
    console.log('🎨 Generating brand profile V5...')
    
    const brandProfileResponse = await fetch(
      'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`
        },
        body: JSON.stringify({ businessId })
      }
    )
    
    if (!brandProfileResponse.ok) {
      throw new Error('Failed to generate brand profile')
    }
    
    const brandProfileResult = await brandProfileResponse.json()
    console.log('✅ Brand profile V5 generated:', brandProfileResult)
    
    // ========================================================================
    // SUCCESS: Refresh UI
    // ========================================================================
    toast.success('Brand profile regenerated successfully!')
    
    // Refresh the page or refetch data
    router.refresh()
    // OR
    // await refetchBrandProfile()
    
  } catch (error) {
    console.error('❌ Regeneration failed:', error)
    setError(error.message)
    toast.error('Failed to regenerate brand profile')
  } finally {
    setIsRegenerating(false)
  }
}
```

---

## 🎨 OPTIONAL: Progress UI

Show progress to user during the two-step process:

```tsx
const [regenerationStep, setRegenerationStep] = useState<string | null>(null)

const handleRegenerate = async () => {
  setIsRegenerating(true)
  setError(null)
  
  try {
    // Step 1: Menu Summary
    setRegenerationStep('Generating menu overview...')
    const menuSummaryResponse = await fetch(...)
    
    // Step 2: Brand Profile
    setRegenerationStep('Generating brand profile...')
    const brandProfileResponse = await fetch(...)
    
    setRegenerationStep('Complete!')
    
  } catch (error) {
    setError(error.message)
  } finally {
    setIsRegenerating(false)
    setRegenerationStep(null)
  }
}
```

**UI Display:**
```tsx
{isRegenerating && (
  <div className="flex items-center gap-2">
    <Spinner />
    <span>{regenerationStep}</span>
  </div>
)}
```

---

## 🧪 TESTING

1. Click "Regenerate" button
2. Check browser console logs:
   - "🍽️  Generating menu overview summary..."
   - "✅ Menu overview summary generated"
   - "🎨 Generating brand profile V5..."
   - "✅ Brand profile V5 generated"
3. Verify in database:
   ```sql
   SELECT menu_overview_summary 
   FROM business_brand_profile 
   WHERE business_id = 'YOUR_BUSINESS_ID';
   ```
4. Check Brand Profile UI shows new menu overview section

---

## 📊 ERROR HANDLING

**If menu-overview-summary fails:**
- Log the error
- Continue with brand-profile-generator-v5 anyway
- Brand profile will just have `menu_overview: null`

**If brand-profile-generator-v5 fails:**
- Show error to user
- Menu summary is already saved in database
- User can retry regeneration

---

## 🔍 FINDING THE FILE

Search for:
```bash
# Find the regenerate button
grep -r "Regenerate" app/
grep -r "brand-profile-generator-v5" app/

# Or search for the function URL
grep -r "kvqdkohdpvmdylqgujpn.supabase.co" app/
```

---

## 📝 CHECKLIST

- [ ] Find the Regenerate button component/page
- [ ] Add `menu-overview-summary` Edge Function call FIRST
- [ ] Keep `brand-profile-generator-v5` call SECOND
- [ ] Add error handling for both calls
- [ ] Add loading states/progress UI (optional)
- [ ] Test with business that has 2+ menus
- [ ] Verify menu_overview appears in Brand Profile UI
- [ ] Deploy to production

---

## 🚀 DEPLOYMENT

After updating frontend:

1. **Run SQL migration:**
   ```sql
   -- Run ADD_MENU_OVERVIEW_SUMMARY_COLUMN.sql
   ```

2. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy menu-overview-summary
   supabase functions deploy brand-profile-generator-v5
   ```

3. **Deploy frontend changes**

4. **Test on staging first!**

---

## 🆘 NEED HELP?

If you need me to:
- Find the exact frontend file
- Implement the changes
- Test the integration

Just ask! 🙋‍♂️
