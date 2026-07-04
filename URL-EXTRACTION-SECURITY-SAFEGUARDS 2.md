# URL Extraction Security Safeguards

**Date:** 19. maj 2026  
**Protected Functions:**
- menu-extract-v2 (version 88, 168.3kB) ✅ Deployed
- analyze-website (version updated, 1.521MB) ✅ Deployed

**Shared Security Module:** `supabase/functions/_shared/url-security.ts`

## 🛡️ Protection Features Implemented

### 1. **Private Network Blocking (SSRF Prevention)**

Blocks access to internal networks and private IP addresses to prevent Server-Side Request Forgery attacks.

**Blocked patterns:**
- ❌ Localhost: `localhost`, `127.0.0.1`, `::1`
- ❌ Private IPv4: `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`
- ❌ Link-local: `169.254.x.x`, `fe80:`
- ❌ Local domains: `*.local`
- ❌ Internal domains: `internal.*`, `admin.*`, `staging.*`, `dev.*`
- ❌ Non-HTTP protocols: `file://`, `ftp://`, etc.

**Error message:** `"Cannot fetch from localhost"`, `"Cannot fetch from private IP addresses"`, etc.

---

### 2. **HTTP Status Validation**

Validates HTTP responses before processing to avoid extracting error pages or auth-protected content.

**Blocked statuses:**
- ❌ **401 Unauthorized** → `"Menu URL requires authentication - cannot access"`
- ❌ **403 Forbidden** → `"Menu URL requires authentication - cannot access"`
- ❌ **404 Not Found** → `"Menu URL not found (404)"`
- ❌ **Other errors** → `"Failed to fetch menu: HTTP {status}"`

**Applies to:** Both probe fetch AND full HTML fetch (menu-extract-v2)

---

### 3. **Login Page Detection**

Prevents accidentally extracting password forms, admin panels, or authentication pages.

**Detection criteria:**
- Password input fields: `<input type="password">`
- Login + password keywords: `login` + `password`, `log ind` + `adgangskode`
- URL path indicators: `/admin`, `/login`, `/wp-admin`, `/wp-login`, `/auth`

**Error message:** `"URL appears to be a login or admin page - not a public menu"`

---

## 🎯 What This Protects

### ✅ **Restaurants' Internal Systems**
- Blocks accidental access to admin panels (`/wp-admin`, `/admin`)
- Prevents fetching from staging/dev environments (`staging.restaurant.dk`)
- Stops login page extraction (password forms detected)

### ✅ **Platform Security**
- Prevents SSRF attacks (cannot scan internal networks)
- Blocks localhost access (cannot fetch `http://localhost:3000`)
- Validates public URLs only (http/https required)

### ✅ **Cost Protection**
- Saves OpenAI credits by rejecting 404s before processing
- Avoids wasting extraction quota on broken links
- Prevents processing non-menu pages (login forms, privacy pages)

---

## 📊 Error Handling

### menu-extract-v2
All validation failures are stored in `menu_results_v2`:
- **Status:** `error`
- **Error message:** Descriptive reason (e.g., "Cannot fetch from private IP addresses")
- **Completed at:** Timestamp
- **HTTP response:** 400 Bad Request (validation errors) or original status (fetch errors)

### analyze-website
Validation failures return HTTP 400 with JSON error:
```json
{
  "error": "URL blocked: Cannot fetch from private IP addresses"
}
```

---

## 🚀 Production Readiness

**Current status:** ✅ Deployed to production

**Functions protected:**
1. **menu-extract-v2** - Menu extraction from URLs/PDFs
   - Validates menu URLs before fetching
   - Checks HTTP status after probe fetch
   - Detects login pages in HTML content
   
2. **analyze-website** - Business profile/brand profile analysis
   - Validates homepage URL before crawling
   - Detects login pages on homepage
   - Validates all priority page URLs (menu, booking, contact, about)
   - Skips unsafe URLs in sub-page crawling

**Pre-deployment validation:**
- ✅ No compilation errors
- ✅ Backward compatible (existing functionality unchanged)
- ✅ Error messages user-friendly
- ✅ All validation failures logged properly
- ✅ Shared security module for consistency

**Vercel deployment considerations:**
- Security features apply to Edge Functions (Supabase-hosted)
- Frontend validation in MenuPage.tsx and BusinessProfilePage should also warn users before submitting suspect URLs
- Consider adding client-side URL validation for immediate feedback

---

## 🧪 Testing Checklist

**Test cases to validate:**

### For menu-extract-v2 (http://localhost:3000/dashboard/menu):
1. ✅ Normal menu URL → should work (e.g., `https://cafefaust.dk/menukort/brunch/`)
2. ⚠️ Localhost URL → should reject (e.g., `http://localhost:3000`)
3. ⚠️ Private IP → should reject (e.g., `http://192.168.1.1`)
4. ⚠️ Admin panel → should reject (e.g., `https://restaurant.dk/wp-admin`)
5. ⚠️ Login page → should reject (password field detected)
6. ⚠️ 404 page → should reject (not found error)
7. ⚠️ Auth-required → should reject (401/403 error)

### For analyze-website (http://localhost:3000/dashboard/profile):
1. ✅ Normal business website → should work (e.g., `https://cafefaust.dk`)
2. ⚠️ Localhost URL → should reject (e.g., `http://localhost:3000`)
3. ⚠️ Private IP → should reject (e.g., `http://192.168.1.100`)
4. ⚠️ Admin panel → should reject (e.g., `https://restaurant.dk/wp-admin`)
5. ⚠️ Login page → should reject (password field detected)
6. ⚠️ Internal domain → should reject (e.g., `http://staging.restaurant.com`)

---

## 📝 Code Changes

**Files created:**
- `supabase/functions/_shared/url-security.ts` - Shared security validation module

**Files modified:**
- `supabase/functions/menu-extract-v2/index.ts` - Refactored to use shared module
- `supabase/functions/analyze-website/index.ts` - Added security validation

**Functions exported from url-security.ts:**
1. `validatePublicUrl(url: string): void` - URL safety validation
2. `looksLikeLoginPage(html: string, url: string): boolean` - Login detection
3. `validateHttpStatus(response: Response, url: string): void` - HTTP status validation (available but not yet used)

**Integration points:**

**menu-extract-v2:**
- Line ~6: Import shared security module
- Line ~1030: URL validation before probe fetch
- Line ~1070: HTTP status check after probe fetch
- Line ~1310: HTTP status check after HTML fetch
- Line ~1320: Login page detection after HTML decode

**analyze-website:**
- Line ~15: Import shared security module
- Line ~80: URL validation before crawling starts
- Line ~220: Login page detection after homepage fetch
- Line ~535: URL validation for each priority page before fetching

---

## 💡 Future Enhancements (Optional)

- Rate limiting per business (max extractions per hour)
- Content-Type strict validation (reject non-HTML/PDF)
- Domain reputation checking (block known malicious domains)
- Client-side URL validation in React UI
- Webhook/notification when suspicious URLs are submitted

---

**Deployed by:** GitHub Copilot  
**Reviewed by:** User  
**Status:** ✅ Production-ready for both menu extraction and business profile analysis
