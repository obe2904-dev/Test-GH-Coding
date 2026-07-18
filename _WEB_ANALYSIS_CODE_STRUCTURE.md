# Web Analysis Code Structure Overview

**Last Updated:** 2026-07-17  
**System Status:** ✅ Operational

---

## 🏗️ Architecture Overview

The web analysis system extracts business information from websites using a three-tier architecture:

```
Frontend (React/Vite)
    ↓
Supabase Edge Function (extract-from-scrape)
    ↓
Cloud Run Scraper Service (Puppeteer)
    ↓
AI Extractors (Gemini 2.5 Flash / GPT-4o-mini)
```

---

## 📁 Key Components

### 1. Frontend UI Layer

**File:** `src/pages/dashboard/BusinessProfilePage.tsx`

**Responsibilities:**
- Display "Analysér hjemmeside" button (green, bg-cta)
- Trigger website analysis on click
- Load and display extracted data in form fields
- Show analysis progress/completion state

**Key Code:**
- Lines 368-374: Load location data with `.eq('is_primary', true)`
- Line 535: Map `address_line1` to form state
- Analysis trigger calls Supabase function

**User Flow:**
1. User enters website URL
2. Clicks "Analysér hjemmeside" button
3. System calls `/extract-from-scrape` function
4. Page refreshes with extracted data

---

### 2. Completion Validation

**File:** `src/hooks/useSetupCompletion.ts`

**Responsibilities:**
- Check if business profile setup is complete
- Validate all required fields are filled
- Control UI state (show/hide completion prompts)

**Key Code:**
```typescript
// Lines 121-129: Query location data
.eq('business_id', business.id)
.eq('is_primary', true)
.maybeSingle()

// Lines 137-140: Validation check
locationFieldsFilled = 
  hasText(address_line1) && 
  hasText(postal_code) && 
  hasText(city) &&        // ⚠️ Required field (fixed 2026-07-17)
  hasText(country)
```

**Critical:** All 4 location fields MUST be present for completion.

---

### 3. Extraction Orchestrator

**File:** `supabase/functions/extract-from-scrape/index.ts` (898 lines)

**Responsibilities:**
- Coordinate scraping and extraction workflow
- Call Cloud Run scraper service
- Run AI extractors on scraped content
- Write results to database

**Architecture:**
```typescript
1. Fetch business from database
2. Call Cloud Run scraper: /scrape-v3
3. Extract fields using tier system:
   - Tier 1: Direct scraper patterns (fastest, most reliable)
   - AI Fallback: Gemini/GPT when tier 1 fails
4. Write to database tables:
   - businesses
   - business_profile
   - business_locations (⚠️ manual INSERT/UPDATE)
   - opening_hours
```

**Key Functions:**

**splitDanishAddress()** - Lines 867-878
```typescript
// Regex: /^(.+?)\s+(\d{4})\s+(.+)$/
// Input:  "Åboulevarden 32 8000 Aarhus C"
// Output: {
//   address_line1: "Åboulevarden 32",
//   postal_code: "8000",
//   city: "Aarhus C"
// }
```

**buildBusinessLocations()** - Lines 587-597
```typescript
return {
  email: (t1.email ?? ai.email)?.value ?? null,
  phone: (t1.phone ?? ai.phone)?.value ?? null,
  address_line1: (t1.address_line1 ?? ai.address_line1)?.value ?? null,
  postal_code: (t1.postal_code ?? ai.postal_code)?.value ?? null,
  city: (t1.city ?? ai.city)?.value ?? null,  // ✅ Added 2026-07-17
};
```

**writeBusinessLocations()** - Lines 707-744
```typescript
// Manual INSERT/UPDATE (no UPSERT due to missing unique constraint)
const { data: existing } = await supabase
  .from('business_locations')
  .select('id')
  .eq('business_id', business_id)
  .maybeSingle();

if (existing?.id) {
  // UPDATE existing row
  await supabase
    .from('business_locations')
    .update({ is_primary: true, country: 'Denmark', ...data })
    .eq('id', existing.id);
} else {
  // INSERT new row
  await supabase
    .from('business_locations')
    .insert({ business_id, is_primary: true, country: 'Denmark', ...data });
}
```

**Deployment:**
```bash
npx supabase functions deploy extract-from-scrape --project-ref oadwluspjlsnxhgakral
```

---

### 4. Cloud Run Scraper Service

**Directory:** `cloud-run-scraper/`

**Endpoint:** `https://scraper-831683741713.europe-west1.run.app/scrape-v3`  
**Current Version:** `scraper-00088-86c`  
**API Key:** `wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo=`

**Responsibilities:**
- Crawl website with Puppeteer (2Gi memory, 60s timeout)
- Extract structured data (blocks, navigation, metadata)
- Detect platform type (WordPress, custom, etc.)
- Smart page crawling (homepage + targeted pages)

**Key Files:**

**index.js** - Main orchestrator
- Lines 632-642: Smart crawl logic
  - Always crawls homepage
  - Crawls `/kontakt/` if phone missing (not for address - homepage sufficient)
  - Skips menu pages to avoid timeouts
- Platform detection (WordPress, Wix, etc.)
- CDP stability fixes (Node-side polling)

**services/contact-extractor.js** - Contact information extraction
```javascript
// extractAddressFromBlocks() - Lines 11-45

// Step 1: Pattern matching
const fullPattern = /([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s]+\s+\d+[A-Za-z]?)[,\s]+(\d{4})\s+([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s]+)/;

// Step 2: Cleanup
address = address.replace(/^[A-Z]\s+/, '');  // Remove leading single char
address = address.replace(/\s+(Tlf|Tel|E-mail|CVR|Se vejkort|Åbningstider).*$/i, '');

// Output: "Åboulevarden 32 8000 Aarhus C"
```

**Phone Extraction:**
- Regex: `/(\+45\s*)?(\d{2}\s*\d{2}\s*\d{2}\s*\d{2})|Tlf\.?:?\s*(\d{2}\s*\d{2}\s*\d{2}\s*\d{2})/`
- Handles: "+45 86 19 07 06", "Tlf.: 86 19 07 06"

**Email Extraction:**
- Regex: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/`
- Simple pattern matching

**Deployment:**
```bash
cd cloud-run-scraper
gcloud run deploy scraper \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 60s \
  --set-env-vars="API_KEY=wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo=" \
  --project strategyp2g
```

---

## 🔄 Data Flow

### Complete Analysis Workflow

```
1. USER ACTION
   ├─ Enters website URL in UI
   └─ Clicks "Analysér hjemmeside" button

2. FRONTEND (BusinessProfilePage.tsx)
   ├─ Calls Supabase function: extract-from-scrape
   └─ Payload: { business_id: "uuid" }

3. SUPABASE FUNCTION (extract-from-scrape/index.ts)
   ├─ Fetches business data from database
   ├─ Calls Cloud Run scraper with website URL
   └─ Receives structured JSON response

4. CLOUD RUN SCRAPER (scraper/index.js)
   ├─ Launches Puppeteer browser
   ├─ Crawls homepage (always)
   ├─ Smart crawl: /kontakt/ if needed
   ├─ Extracts: blocks, navigation, metadata
   ├─ contact-extractor.js extracts:
   │   ├─ Phone: "+45 86 19 07 06"
   │   ├─ Email: "hello@soukaarhus.dk"
   │   └─ Address: "Åboulevarden 32 8000 Aarhus C"
   └─ Returns JSON to Supabase function

5. EXTRACTION ORCHESTRATOR (extract-from-scrape/index.ts)
   ├─ Tier 1 extraction (direct patterns)
   │   ├─ splitDanishAddress() splits raw address
   │   └─ Stores: address_line1, postal_code, city
   ├─ AI extraction (Gemini 2.5 Flash) for:
   │   ├─ Business name
   │   ├─ About text
   │   ├─ Key offerings
   │   └─ Fallback for missing contact data
   └─ Database writes:
       ├─ businesses (name, website_url)
       ├─ business_profile (user_about_text, key_offerings)
       ├─ business_locations (address, email, phone, city) ✅
       └─ opening_hours (structured schedule)

6. FRONTEND REFRESH
   ├─ useSetupCompletion validates all fields
   ├─ Checks: address_line1, postal_code, city, country ✅
   └─ UI displays extracted data in form
```

---

## 🗄️ Database Schema

### business_locations table

**Structure:**
```sql
CREATE TABLE business_locations (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  address_line1 TEXT,      -- ✅ "Åboulevarden 32"
  postal_code TEXT,        -- ✅ "8000"
  city TEXT,               -- ✅ "Aarhus C" (fixed 2026-07-17)
  country TEXT,            -- ✅ "Denmark"
  phone TEXT,              -- ✅ "+45 86 19 07 06"
  email TEXT,              -- ✅ "hello@soukaarhus.dk"
  is_primary BOOLEAN,      -- ✅ true (required for UI query)
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Important:**
- NO unique constraint on `business_id` (manual INSERT/UPDATE logic required)
- `is_primary: true` required for UI to find location
- ALL fields (address_line1, postal_code, city, country) required for completion check

---

## 🚨 Critical Fixes Applied

### Fix 1: City Field Extraction (2026-07-17)

**Problem:** useSetupCompletion requires `city` field, but splitDanishAddress() was only extracting street and postal code.

**Before:**
```typescript
const match = raw.match(/^(.+?)\s+(\d{4})\b/);
// Only captured: "Åboulevarden 32" + "8000"
// Lost: "Aarhus C"
```

**After:**
```typescript
const match = raw.match(/^(.+?)\s+(\d{4})\s+(.+)$/);
// Captures: "Åboulevarden 32" + "8000" + "Aarhus C"
return { address_line1, postal_code, city };
```

**Impact:** Completion check now passes with all 4 required fields.

---

### Fix 2: is_primary Flag (2026-07-16)

**Problem:** UI queries for `is_primary: true`, but database rows had `false`.

**Solution:** Set `is_primary: true` on both INSERT and UPDATE operations in writeBusinessLocations().

---

### Fix 3: Address Homepage Pattern (2026-07-16)

**Problem:** /kontakt/ page fails in Cloud Run due to network sandbox blocking external resources.

**Solution:** Extract address from homepage using simple pattern + cleanup in contact-extractor.js.

---

### Fix 4: Phone Regex for "Tlf.:" (2026-07-15)

**Problem:** Danish format "Tlf.: 86 19 07 06" not matching.

**Solution:** Updated regex to handle both "+45" and "Tlf.:" prefixes.

---

## 🧪 Testing

### Manual Test Commands

**Test Scraper:**
```bash
curl -s -X POST https://scraper-831683741713.europe-west1.run.app/scrape-v3 \
  -H "Content-Type: application/json" \
  -H "x-api-key: wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo=" \
  -d '{
    "url": "https://soukaarhus.dk",
    "business_id": "875cf323-23cd-4487-af31-892e6a307f84"
  }' | jq '.contact.addresses[0].value'
```

**Test Extraction:**
```bash
curl -s -X POST 'https://oadwluspjlsnxhgakral.supabase.co/functions/v1/extract-from-scrape' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  -d '{"business_id": "875cf323-23cd-4487-af31-892e6a307f84"}' \
  | jq '{success, locations_saved: [.extraction.saved[] | select(startswith("locations."))], errors: .extraction.errors}'
```

**Expected Output:**
```json
{
  "success": true,
  "locations_saved": [
    "locations.email",
    "locations.phone",
    "locations.address_line1",
    "locations.postal_code",
    "locations.city"
  ],
  "errors": []
}
```

---

## 📊 Test Businesses

### Business 1: Souka Aarhus
- **ID:** `875cf323-23cd-4487-af31-892e6a307f84`
- **URL:** https://soukaarhus.dk
- **Expected Results:**
  - Phone: "+45 86 19 07 06" ❌ (currently null)
  - Email: "hello@soukaarhus.dk" ✅
  - Address: "Åboulevarden 32" ✅
  - Postal: "8000" ✅
  - City: "Aarhus C" ✅

### Business 2: Café Faust
- **ID:** `ac838e1d-571a-4aeb-8a3e-00fe0b0903b0`
- **URL:** https://cafefaust.dk
- **Expected Results:**
  - Phone: "+45 86 19 07 06" ✅
  - Email: "info@cafefaust.dk" ✅
  - Address: "Åboulevarden 32" ✅
  - Postal: "8000" ✅
  - City: "Aarhus C" ✅

---

## 🔧 Deployment Commands

### Deploy Scraper
```bash
cd cloud-run-scraper
gcloud run deploy scraper \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 60s \
  --set-env-vars="API_KEY=wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo=" \
  --project strategyp2g
```

### Deploy Extraction Function
```bash
npx supabase functions deploy extract-from-scrape \
  --project-ref oadwluspjlsnxhgakral
```

### Deploy Frontend
```bash
git add .
git commit -m "Fix: description"
git push origin main  # Vercel auto-deploys
```

---

## 🎯 System Constraints

### Cloud Run Scraper Limits
- **Memory:** 2Gi (Puppeteer requirement)
- **Timeout:** 60s (trade-off: speed vs completeness)
- **Network:** Sandbox blocks some external resources on /kontakt/ pages
- **Concurrency:** Default (multiple instances auto-scale)

### Supabase Function Limits
- **Timeout:** 60s (must wait for scraper)
- **Memory:** Default Deno limits
- **Cold Start:** ~2-3s initial delay

### Database Constraints
- **NO unique constraint** on business_locations.business_id
  - Cannot use UPSERT
  - Must use manual INSERT/UPDATE logic
- **is_primary flag** required for UI queries
- **ALL 4 location fields** required for completion check

---

## 📝 Known Issues & Limitations

### 1. Phone Not Extracting for Souka Aarhus
- Status: ⚠️ Investigation needed
- Café Faust works, Souka Aarhus returns null
- Likely: different page structure or format

### 2. Menu Page Crawling Disabled
- Reason: Causes 504 timeouts (large HTML)
- Impact: Menu offerings not automatically extracted
- User must manually enter key offerings

### 3. /kontakt/ Page Network Issues
- Reason: Cloud Run sandbox blocks external resources
- Workaround: Extract from homepage when possible
- Impact: Some contact pages may be skipped

### 4. No UPSERT Support
- Reason: Missing unique constraint on business_id
- Workaround: Manual check + INSERT or UPDATE
- Risk: Race conditions if multiple analyses run simultaneously

---

## 🚀 Future Improvements

### High Priority
- [ ] Investigate Souka Aarhus phone extraction failure
- [ ] Add unique constraint to business_locations.business_id
- [ ] Implement proper UPSERT logic after schema fix

### Medium Priority
- [ ] Optimize menu page crawling (stream processing?)
- [ ] Add retry logic for failed extractions
- [ ] Implement rate limiting for AI API calls

### Low Priority
- [ ] Support for multiple locations per business
- [ ] Automatic menu offerings extraction
- [ ] Social media profile extraction

---

## 📚 Related Documentation

- `_ANALYSIS_BOOKING_CTA_INCONSISTENCY.md` - Booking CTA logic
- `_BRAND_PROFILE_INTEGRATION_GUIDE.md` - Brand profile system
- `/memories/repo/location-intelligence-schema-drift.md` - Schema history
- `/memories/repo/menu-normalization-audit.md` - Menu handling

---

## 🔑 Access & Credentials

### Supabase (Staging)
- **Project:** oadwluspjlsnxhgakral
- **URL:** https://oadwluspjlsnxhgakral.supabase.co
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- **Password:** 0le.B@k.2023

### Cloud Run
- **Project:** strategyp2g
- **Region:** europe-west1
- **Service:** scraper
- **API Key:** wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo=

### Gemini AI
- **Model:** gemini-2.0-flash-exp
- **API Key:** AIzaSyCHqc_MmVwJNa8iuMWZMp0DPO5UqK-fM0E
- **Cost:** $0.075/1M input tokens

### GitHub / Vercel
- **Repo:** Test-GH-Coding (obe2904-dev)
- **Branch:** main (single-branch deployment)
- **Live URL:** https://social-media-saas-psi.vercel.app/

---

**End of Document**
