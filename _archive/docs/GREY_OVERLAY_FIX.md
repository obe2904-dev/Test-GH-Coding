# Grey Overlay Fix

## Problem
After clearing localStorage, a grey transparent overlay blocks all UI interaction after login.

## Root Cause
The `onboarding:navigating` flag in localStorage may be stuck as `'true'`, causing the ProtectedRoute component to be in an inconsistent state.

## Immediate Fix - Option 1: Clear Specific Keys

In the browser console (F12 → Console tab), run:

```javascript
// Clear onboarding navigation flags
localStorage.removeItem('onboarding:navigating')

// Then reload the page
location.reload()
```

## Option 2: Inspect the Overlay

1. Open DevTools (F12)
2. Go to Elements tab
3. Press Ctrl+F (Cmd+F on Mac)
4. Search for: `fixed inset-0`
5. This will show which component is creating the overlay
6. Screenshot and share the result

## Option 3: Complete Fresh Start

In the browser console, run:

```javascript
// Clear all app-related keys
Object.keys(localStorage).forEach(key => {
  if (key.includes('onboarding') || key.includes('i18next')) {
    localStorage.removeItem(key)
  }
})

// Reload
location.reload()
```

## Code Fix Needed

If the issue persists, we need to add a cleanup on app initialization in App.tsx:

```typescript
useEffect(() => {
  // Clear navigation flag on app start
  if (typeof window !== 'undefined') {
    localStorage.removeItem('onboarding:navigating')
  }
  initialize()
}, [initialize])
```

## What to Check

1. **Console Logs**: Look for ProtectedRoute logs showing:
   - "Navigation in progress, skipping check"
   - "Showing loading spinner"
   - Any error messages

2. **DOM Inspection**: Find which z-50 element is rendered:
   - BusinessInfoPromptModal
   - LanguageSwitcher backdrop
   - Loading spinner overlay

3. **localStorage State**: Check what keys exist:
   ```javascript
   console.log(Object.keys(localStorage))
   ```
