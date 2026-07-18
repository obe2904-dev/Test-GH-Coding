# Landing Page Detection & Exclusion Fix

**Date:** 2026-07-18  
**Function:** `detect-menus`  
**Issue:** Landing page URLs were being included in final results, causing "No menu content found" errors

---

## Problem Identified

### Issue 1: Fallback Logic Bug
When `detect-menus` detected a landing page but couldn't extract child URLs, it would **fall back to including the landing page URL itself** in the final results.

**Impact:** URLs like `https://soukaarhus.dk/menu` would be passed to `menu-extract-v2`, which would fail with "No menu content found" because it's just a navigation page, not actual menu content.

### Issue 2: Weak Landing Page Detection
The `isLandingPage()` function only checked content length and keyword patterns. It didn't recognize common URL patterns like `/menu`, `/da/menu`, `/en/menu` that are typically navigation pages.

**Impact:** Some landing pages weren't being detected at all, especially when they had enough text content to pass the 500-character threshold.

---

## Solution Implemented

### Fix 1: Remove Fallback to Landing Page
**File:** `supabase/functions/detect-menus/index.ts`  
**Lines:** ~395-402

**BEFORE:**
```typescript
if (childUrls.length > 0) {
  console.log(`  ✅ Expanded to ${childUrls.length} menu URL(s)`)
  expandedUrls.push(...childUrls)
  expandedLandingPages.add(normalizeUrlForDedup(menuUrl))
} else {
  console.log('  ⚠️ No child URLs found - keeping original')
  expandedUrls.push({  // ❌ BUG: Adds landing page to results
    url: menuUrl,
    confidence: item.confidence || 0.9,
    evidence: item.evidence || 'Menu',
    detection_method: item.detection_method || 'keyword',
  })
}
```

**AFTER:**
```typescript
if (childUrls.length > 0) {
  console.log(`  ✅ Expanded to ${childUrls.length} menu URL(s)`)
  expandedUrls.push(...childUrls)
  expandedLandingPages.add(normalizeUrlForDedup(menuUrl))
} else {
  console.log('  ⚠️ Landing page with no extractable children - SKIPPING entirely')
  // Do NOT add landing page to results if we can't find children
  // It's better to skip it than to include a URL that will fail extraction
}
```

### Fix 2: URL Pattern Detection
**File:** `supabase/functions/detect-menus/index.ts`  
**Lines:** ~48-65

**BEFORE:**
```typescript
function isLandingPage(html: string, text: string): boolean {
  // Very short content suggests navigation page
  if (text.length < 500) {
    console.log(`  → Landing page: text only ${text.length} chars`)
    return true
  }
  
  // Has menu navigation keywords but no actual menu items
  const hasMenuNav = /menu|frokost|aften|lunch|dinner|brunch/i.test(text)
  const hasMenuItems = /kr\.|,-|\d+\s*kr|price|pris/i.test(text)
  
  if (hasMenuNav && !hasMenuItems && text.length < 2000) {
    console.log('  → Landing page: has navigation but no menu items')
    return true
  }
  
  return false
}
```

**AFTER:**
```typescript
function isLandingPage(html: string, text: string, url?: string): boolean {
  // Check URL pattern - paths like /menu, /da/menu, /en/menu are typically navigation pages
  if (url) {
    const path = new URL(url).pathname.toLowerCase()
    if (/^\/(da|en|de|se|no)?\/?menu\/?$/i.test(path)) {
      console.log(`  → Landing page: URL path matches navigation pattern: ${path}`)
      return true
    }
  }
  
  // Very short content suggests navigation page
  if (text.length < 500) {
    console.log(`  → Landing page: text only ${text.length} chars`)
    return true
  }
  
  // Has menu navigation keywords but no actual menu items
  const hasMenuNav = /menu|frokost|aften|lunch|dinner|brunch/i.test(text)
  const hasMenuItems = /kr\.|,-|\d+\s*kr|price|pris/i.test(text)
  
  if (hasMenuNav && !hasMenuItems && text.length < 2000) {
    console.log('  → Landing page: has navigation but no menu items')
    return true
  }
  
  return false
}
```

### Fix 3: Updated Function Call
**File:** `supabase/functions/detect-menus/index.ts`  
**Line:** ~390

**BEFORE:**
```typescript
if (isLandingPage(html, text)) {
```

**AFTER:**
```typescript
if (isLandingPage(html, text, menuUrl)) {
```

---

## How It Works Now

### Detection Flow

1. **Cloud Run Scraper** returns initial menu URLs (e.g., `https://soukaarhus.dk/menu`)
2. **detect-menus** fetches each URL to check if it's HTML
3. **URL Pattern Check**: If path matches `/menu`, `/da/menu`, etc. → automatically marked as landing page
4. **Content Check**: If still uncertain, analyzes text length and keyword patterns
5. **Expansion**: If landing page detected → extract child URLs from HTML (PDFs, images, links)
6. **Exclusion**: Landing page URL itself is **NEVER included** in final results

### Landing Page Detection Triggers

A URL is considered a landing page if **any** of these conditions match:

1. **URL Pattern**: Path matches `/(lang)?/menu/` (e.g., `/menu`, `/da/menu`, `/en/menu`)
2. **Short Content**: Less than 500 characters of text
3. **Navigation Page**: Has menu keywords but no prices/items + less than 2000 characters

### Result Rules

- ✅ **Include**: Direct links to PDFs, images, or pages with actual menu content
- ❌ **Exclude**: Landing pages, navigation pages, pages with no extractable children
- 🔄 **Expand**: Landing pages are expanded to their child URLs (if found)

---

## Testing Instructions

### Test Case: soukaarhus.dk

1. **Clear old data** (to avoid merging with previous detections)
2. In Menu UI, enter: `https://soukaarhus.dk/da`
3. Click **"Find menusider"**

**Expected Results:**
- ✅ 2 menu URLs detected (both PDFs)
- ❌ NO `/menu` landing page URL
- Console log: `"Landing page: URL path matches navigation pattern: /menu"`

### Verify Extraction Works

4. Select both checkboxes
5. Click **"Hent valgte"**

**Expected Results:**
- ✅ Both PDFs extract successfully via OCR
- ✅ Menu items parsed and stored
- ❌ NO "No menu content found" errors

---

## Deployment

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"
npx supabase functions deploy detect-menus --project-ref oadwluspjlsnxhgakral
```

**Deployed:** 2026-07-18  
**Function Size:** 141 kB  
**Status:** ✅ Deployed successfully

---

## Impact

### Before Fix
- Landing page URLs passed to extraction
- "No menu content found" errors
- User confusion about why extraction fails
- Wasted OCR API calls on non-menu pages

### After Fix
- Only actual menu files (PDFs, images) passed to extraction
- Clean error-free extraction flow
- Better user experience
- Reduced API costs (no wasted OCR calls)

---

## Related Functions

### Not Modified
- ✅ `menu-extract-v2` - Handles actual extraction (PDF, OCR, HTML)
- ✅ `analyze-website` - Separate business profile analysis (untouched)
- ✅ Cloud Run Scraper - Initial menu URL detection (working perfectly)

### Modified
- 🔧 `detect-menus` - Landing page detection and exclusion logic

---

## Technical Notes

### URL Normalization
The `normalizeUrlForDedup()` function strips query parameters (except `page`) to avoid duplicates:
- `https://example.com/menu.pdf?w=3200` → `https://example.com/menu.pdf`
- `https://example.com/menu.pdf?page=1` → `https://example.com/menu.pdf?page=1`

### False Positive Filtering
URLs containing these terms are automatically excluded:
- `privacy`, `privatlivs`, `cookie`, `kontakt`, `contact`
- `om-os`, `about`, `terms`, `betingelser`, `gdpr`

### Srcset Parsing
Modern Umbraco CMS uses `<source srcset>` for responsive images. The function extracts URLs from:
- `<source srcset="...">`
- `<img src="...">`
- `<a href="...">` (with menu keywords in link text)
