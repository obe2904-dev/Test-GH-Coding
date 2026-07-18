# Menu Extraction Architecture Assessment

**Date:** 2026-07-18  
**Status:** Analysis & Recommendations  
**Scope:** Multi-format menu detection and extraction strategy

---

## Executive Summary

**Current State:** Menu extraction works well for simple cases (cafefaust.dk) where menus are directly embedded in HTML or linked as single PDF/HTML pages.

**Problem:** Fails for nested/complex homepage structures where menus are:
- Hidden behind subpages (homepage → /menu → actual content)
- Stored as images/JPEGs without OCR
- Split across multiple pages or formats

**Recommendation:** Implement a **Smart Discovery Layer** that detects menu structure before extraction, without over-engineering.

---

## Current Architecture Analysis

### What Works Well ✅

**1. Single-Step Detection**
- Pattern matching in `html-preprocessor.js` (MENU_URL_PATTERNS: `/menu`, `/mad`, `/carte`)
- Link classification scores menu links by URL and anchor text
- Fast edge extraction for HTML and small PDFs (<5MB)

**Example:** `cafefaust.dk`
```
Homepage → Menu content embedded inline
         → Direct PDF link
Result: ✅ Extracted successfully
```

**2. Two-Tier Extraction**
```
Edge Function (fast)     Cloud Run Worker (slow)
├─ HTML parsing         ├─ Large PDF OCR
├─ Small PDF (<5MB)     ├─ Complex document layouts
└─ Direct AI extract    └─ Multi-page processing
```

---

## What's Breaking ❌

### Case Study: soukaarhus.dk

**Structure:**
```
1. Homepage: soukaarhus.dk/da
   └─ Link: "Menu" → /da/menu

2. Menu Page: soukaarhus.dk/da/menu
   ├─ Button: "Frokost" → menu-frokost.jpeg
   └─ Button: "Menu" → menu-aften.jpeg

3. Content: JPEGs (no OCR support)
```

**Current Behavior:**
- ✅ Detects `/da/menu` link on homepage
- ❌ Never visits `/da/menu` page to discover JPEGs
- ❌ Even if found, JPEGs not extracted (no OCR)

**Root Causes:**
1. **Single-Depth Crawling** — Scraper doesn't follow menu links to discover nested content
2. **No Image Extraction** — JPEG/PNG menus rejected immediately
3. **Pattern-Only Detection** — No structural analysis of menu pages

---

## Comparison: Web Analysis vs Menu Extraction

### Web Analysis Architecture (inspiration)

**Strengths:**
- **Multi-page crawling** — Homepage + /kontakt/ + smart discovery
- **Platform detection** — WordPress, Umbraco, SPA detection
- **Quality scoring** — Decides whether to crawl more pages
- **Preprocessor layer** — Reduces HTML before AI (1-2MB → 5-20KB)

**Structure Detection:**
```javascript
// html-preprocessor.js
detectPlatform(html, homepageDoc)
→ { platform: 'wordpress', isSPA: false }
→ Adapt crawling strategy
```

**Lesson:** Detect structure BEFORE extraction, not during.

---

## Recommended Solution: Smart Discovery Layer

### Design Principles

1. **Don't Over-Engineer** — Use existing Cloud Run scraper, add discovery logic
2. **Fail Gracefully** — If discovery fails, fall back to current behavior
3. **Incremental Enhancement** — Start with common patterns, expand as needed

---

### Architecture: 3-Stage Discovery Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: INITIAL SCAN (current behavior)                    │
│ • Pattern match homepage for /menu, /mad, /carte links      │
│ • Classify links as "menu candidate"                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: SMART DISCOVERY (NEW)                              │
│ • Visit detected menu URL                                   │
│ • Scan for:                                                 │
│   - PDF links (download buttons, embedded viewers)         │
│   - Image links (JPEG, PNG menu scans)                     │
│   - Subpage links (e.g., "Lunch Menu", "Dinner Menu")     │
│ • Classify menu structure:                                 │
│   → inline_html    (menu text on page)                     │
│   → direct_pdf     (single PDF link)                       │
│   → image_gallery  (JPEG/PNG grid)                         │
│   → nested_pages   (multi-page structure)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3: ADAPTIVE EXTRACTION (enhanced)                     │
│ • inline_html     → Edge function (current)                │
│ • direct_pdf      → Edge fast-path or Cloud Run (current)  │
│ • image_gallery   → NEW: Queue for OCR extraction          │
│ • nested_pages    → NEW: Recursive discovery + extraction  │
└─────────────────────────────────────────────────────────────┘
```

---

### Implementation Plan

#### Phase 1: Discovery Logic (Cloud Run)

**New File:** `cloud-run-scraper/services/menu-discovery.js`

```javascript
/**
 * Discover menu structure from a detected menu page
 * @param {string} menuUrl - URL of suspected menu page
 * @returns {Promise<MenuDiscovery>}
 */
async function discoverMenuStructure(menuUrl) {
  const page = await browser.newPage()
  await page.goto(menuUrl)
  
  // Extract all links and assets
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      url: a.href,
      text: a.textContent.trim(),
      type: detectLinkType(a.href)
    }))
  })
  
  // Classify structure
  const pdfLinks = links.filter(l => l.type === 'pdf')
  const imageLinks = links.filter(l => l.type === 'image')
  const subpageLinks = links.filter(l => isMenuSubpage(l))
  
  if (imageLinks.length > 0) {
    return {
      structure: 'image_gallery',
      assets: imageLinks.map(l => l.url),
      extraction_method: 'ocr_required'
    }
  }
  
  if (pdfLinks.length > 0) {
    return {
      structure: 'direct_pdf',
      assets: pdfLinks.map(l => l.url),
      extraction_method: 'pdf_extract'
    }
  }
  
  if (subpageLinks.length > 0) {
    return {
      structure: 'nested_pages',
      subpages: subpageLinks,
      extraction_method: 'recursive_discovery'
    }
  }
  
  // Default: inline HTML
  return {
    structure: 'inline_html',
    content: await page.content(),
    extraction_method: 'edge_html'
  }
}
```

**Helper Functions:**
```javascript
function detectLinkType(url) {
  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image'
  if (url.match(/\.pdf$/i)) return 'pdf'
  if (url.match(/\/(lunch|dinner|brunch|frokost|aften|menu-)/i)) return 'submenu'
  return 'other'
}

function isMenuSubpage(link) {
  const menuKeywords = ['lunch', 'dinner', 'brunch', 'frokost', 'aften', 'tapas', 'bar']
  return menuKeywords.some(k => 
    link.url.toLowerCase().includes(k) || 
    link.text.toLowerCase().includes(k)
  )
}
```

---

#### Phase 2: Image OCR Support

**Options:**

1. **Google Vision API** (recommended for MVP)
   - Already using Google Cloud Platform
   - Text detection API: `vision.documents.text()`
   - Cost: ~$1.50/1000 images
   - Danish language support: ✅

2. **Tesseract.js** (self-hosted)
   - Free, open-source
   - Quality: Lower than Vision API
   - Adds ~30MB to Cloud Run container

3. **GPT-4 Vision** (premium option)
   - Already using OpenAI
   - Higher quality for complex layouts
   - Cost: ~$0.01/image
   - Can extract structure directly

**Recommended:** Start with GPT-4 Vision (already integrated), fall back to Vision API if budget constraint.

**Implementation:**
```javascript
async function extractMenuFromImage(imageUrl) {
  // Download image
  const imageResp = await fetch(imageUrl)
  const imageBuffer = await imageResp.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString('base64')
  
  // Call GPT-4 Vision
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract menu structure from this image. Return JSON with categories and items.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }],
      max_tokens: 4096
    })
  })
  
  return await response.json()
}
```

---

#### Phase 3: Recursive Discovery (for nested pages)

**When to Use:**
- Menu page has links like "Lunch Menu", "Dinner Menu", "Bar Menu"
- Each links to separate HTML/PDF/image page

**Strategy:**
```javascript
async function recursiveMenuDiscovery(menuPageUrl, depth = 0) {
  if (depth > 2) return [] // Safety: max 2 levels deep
  
  const discovery = await discoverMenuStructure(menuPageUrl)
  
  if (discovery.structure === 'nested_pages') {
    // Visit each subpage
    const results = []
    for (const subpage of discovery.subpages.slice(0, 5)) { // Limit to 5 subpages
      const subResult = await recursiveMenuDiscovery(subpage.url, depth + 1)
      results.push({
        label: subpage.text, // "Frokost", "Aften"
        content: subResult
      })
    }
    return results
  }
  
  return [discovery]
}
```

---

## Cost & Complexity Analysis

### Effort Estimation

| Component | Complexity | Time | Risk |
|-----------|-----------|------|------|
| Discovery logic | Medium | 4-6 hours | Low |
| Image OCR (GPT-4V) | Low | 2-3 hours | Low |
| Recursive discovery | Medium | 3-4 hours | Medium |
| Testing & edge cases | High | 6-8 hours | Medium |
| **Total** | **Medium** | **15-20 hours** | **Low-Medium** |

### Cost Impact

**Current Monthly Cost (estimate):**
- GPT-4o menu extraction: ~$50-100/month
- Gemini 2.5 Flash summarization: ~$10-20/month

**Additional Cost (image extraction):**
- GPT-4 Vision: ~$0.01/image × 50 images/month = $0.50/month
- Negligible increase

**ROI:**
- Unlocks 30-40% more restaurant websites (estimate)
- Better menu coverage → better content generation
- Competitive advantage (most tools don't handle nested menus)

---

## Rollout Strategy

### Phase 1: Detection Only (Week 1)
- Add discovery logic to Cloud Run scraper
- Log detected structures, don't extract yet
- Analyze patterns in production data

### Phase 2: Simple Cases (Week 2)
- Enable image extraction for direct image links
- Test on 10 known failing cases (like soukaarhus.dk)
- Monitor error rates

### Phase 3: Nested Discovery (Week 3)
- Enable recursive discovery (max depth 2)
- Add safety limits (max 5 subpages, 30s timeout)
- Monitor Cloud Run costs

### Phase 4: Polish & Optimize (Week 4)
- Add caching for discovered structures
- Improve error messages for unsupported formats
- Create admin dashboard to view discovery results

---

## Decision Matrix

### Should We Build This?

**YES if:**
- ✅ >20% of target businesses have nested menu structures
- ✅ Menu extraction is core to content quality
- ✅ Competitors don't support this (competitive edge)

**NO if:**
- ❌ <10% of businesses affected
- ❌ Manual menu entry is acceptable workaround
- ❌ Budget/time constrained

**Recommended:** **BUILD IT** — Menu quality is critical for content generation, and the solution is not over-engineered.

---

## Alternative: Simplified Approach

If recursive discovery feels too complex, start with:

### "Menu Page Crawler" (4-hour MVP)

1. When menu URL detected, visit that page
2. Extract ALL links on that page
3. Download first PDF or image found
4. If JPEG: show user-friendly error: "Menu er et billede - upload manuelt"
5. Done.

**Pros:**
- Simple, low-risk
- Handles soukaarhus.dk case
- Clear user guidance

**Cons:**
- No OCR (manual fallback)
- No multi-page support
- User friction

---

## Recommendation: Hybrid Approach

**Immediate (This Week):**
1. Add **menu page crawler** (visit /menu pages)
2. Detect images and show clear error: "Upload menu manually"
3. Log structure patterns for analysis

**Next Sprint:**
1. Add **GPT-4 Vision OCR** for detected images
2. Test on 20 real businesses
3. Measure success rate

**Future (Optional):**
1. Add recursive discovery if >30% of businesses need it
2. Add caching for repeat discoveries
3. Build admin UI to view detected structures

---

## Inspiration from Web Analysis

**What to Adopt:**
- ✅ Platform detection (WordPress, Wix, etc.)
- ✅ Quality scoring (decide whether to crawl deeper)
- ✅ Preprocessor pattern (structure detection before AI)

**What to Skip:**
- ❌ Complex .md configuration files (overkill for menus)
- ❌ Multi-agent orchestration (too heavy)

**Key Insight:** Web analysis succeeds because it **detects structure first**, then adapts. Apply same principle to menus.

---

## Next Steps

1. **Review this document** — Validate assumptions and priorities
2. **Choose approach** — MVP (menu crawler) or Full (discovery + OCR)
3. **Spike test** — Try GPT-4 Vision on 3 menu images manually
4. **Prototype** — Build menu-discovery.js (4 hours)
5. **Deploy & test** — Run on 10 failing cases
6. **Decide on OCR** — Based on image frequency in production

---

## Open Questions

1. **How common are image menus?** — Need data from failed extractions
2. **What's acceptable manual fallback rate?** — 10%? 20%?
3. **Should we cache discovered structures?** — Reduces repeat crawls
4. **Multi-language menus?** — Some sites have EN + DA on separate pages

---

## Conclusion

**The core insight:** Menu extraction fails not because AI isn't good enough, but because we don't discover the menu first.

**The solution:** Add a lightweight discovery layer that:
- Visits menu pages (not just homepage)
- Detects format (HTML, PDF, image, nested)
- Routes to appropriate extractor

**The philosophy:** Like web analysis, **detect structure → adapt strategy → extract**.

This is not over-engineering — it's thoughtful architecture that scales gracefully.

---

**Status:** ✅ Ready for decision and implementation planning
