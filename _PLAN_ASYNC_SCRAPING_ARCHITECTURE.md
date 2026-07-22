# Async Scraping Architecture - Implementation Plan

**Created:** 2026-07-22  
**Problem:** IDLE_TIMEOUT errors when multi-page scraping exceeds 150s Edge Function limit  
**Solution:** Two-phase async architecture with webhook callbacks and targeted re-scraping

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Design](#component-design)
3. [Database Schema Changes](#database-schema-changes)
4. [API Endpoints](#api-endpoints)
5. [Implementation Phases](#implementation-phases)
6. [Flow Diagrams](#flow-diagrams)
7. [Error Handling & Resilience](#error-handling--resilience)
8. [Migration Strategy](#migration-strategy)
9. [Testing Plan](#testing-plan)
10. [Rollout Strategy](#rollout-strategy)

---

## 1. Architecture Overview

### Current (Synchronous) Architecture
```
User clicks "Analyze Website"
    ↓
Frontend calls analyze-and-distribute-website
    ↓
Edge Function waits for Cloud Run (175s timeout)
    ↓ [IDLE_TIMEOUT at 150s] ❌
Cloud Run scrape-v3 (180s timeout)
    ↓
Edge Function extract-from-scrape
    ↓
Database writes
    ↓
Response to user (if not timed out)
```

**Problems:**
- Edge Function idle timeout (150s) vs actual scrape time (160-180s for multi-page)
- No progress visibility for user
- All-or-nothing scraping (can't target missing fields)
- Wasted resources on timeout retries

---

### New (Asynchronous) Architecture

```
Phase 1: Initial Scrape (Always async)
==========================================
User clicks "Analyze Website"
    ↓
Frontend calls /analyze-website-async
    ↓
Edge Function creates job record & triggers Cloud Run
    ↓
[IMMEDIATE RESPONSE <5s] ✅
    {
      "job_id": "uuid",
      "status": "scraping",
      "progress_url": "/scrape-status/{job_id}"
    }
    ↓
User sees progress UI with polling
    ↓
Cloud Run completes scraping
    ↓
Cloud Run calls /scrape-completed webhook
    ↓
Edge Function processes extraction & saves to DB
    ↓
Job status → "completed"


Phase 2: Targeted Re-scrape (Conditional)
==========================================
Frontend detects missing critical fields
    ↓
Frontend calls /rescrape-missing-fields
    ↓
Edge Function triggers targeted Cloud Run scrape
    {
      "pages_to_scrape": ["/kontakt/", "/menu/"],
      "target_fields": ["booking_url", "menu_items"]
    }
    ↓
Cloud Run crawls ONLY specified pages
    ↓
Merges with existing extraction
    ↓
Updates database with new fields
```

---

## 2. Component Design

### 2.1 New Edge Functions

#### `/analyze-website-async`
**Purpose:** Initiate async scraping job  
**Timeout:** 30s (only sets up job, doesn't wait)  
**Returns:** Job ID immediately

**Responsibilities:**
- Validate URL & authentication
- Check 24h cache (bypass if force_refresh)
- Create `scrape_jobs` record with status "pending"
- Trigger Cloud Run scraper with webhook URL
- Return job_id to frontend

**Input:**
```typescript
{
  url: string;
  business_id: string;
  force_refresh?: boolean;
  callback_url?: string; // Optional webhook for frontend
}
```

**Output:**
```typescript
{
  job_id: string;
  status: "pending" | "scraping" | "extracting" | "completed" | "failed";
  estimated_duration_ms: number; // Based on historical data
  progress_url: string;
  created_at: string;
}
```

---

#### `/scrape-completed` (Webhook)
**Purpose:** Receive callback from Cloud Run when scraping finishes  
**Timeout:** 150s (runs extraction)  
**Auth:** API key from Cloud Run

**Responsibilities:**
- Validate webhook signature/API key
- Update job status to "extracting"
- Call existing `extract-from-scrape` logic
- Update job status to "completed" or "failed"
- Trigger frontend callback if provided
- Handle errors gracefully (mark job as failed)

**Input:**
```typescript
{
  job_id: string;
  scrape_result_id: string; // From website_scrape_results
  status: "success" | "partial" | "failed";
  pages_crawled: number;
  error?: string;
}
```

---

#### `/scrape-status/{job_id}`
**Purpose:** Get current status of scraping job  
**Timeout:** 10s (read-only)

**Responsibilities:**
- Return current job status
- Include partial results if available
- Provide error details if failed

**Output:**
```typescript
{
  job_id: string;
  status: "pending" | "scraping" | "extracting" | "completed" | "failed";
  progress_percent: number; // 0-100
  current_step: string; // "Crawling homepage", "Extracting data", etc.
  pages_crawled?: number;
  estimated_time_remaining_ms?: number;
  result?: {
    scrape_id: string;
    quality: string;
    extraction_summary: any;
  };
  error?: string;
  created_at: string;
  updated_at: string;
}
```

---

#### `/rescrape-missing-fields`
**Purpose:** Trigger targeted re-scrape for specific missing fields  
**Timeout:** 30s (async like Phase 1)

**Responsibilities:**
- Identify which pages likely contain missing fields
- Trigger Cloud Run with targeted crawl instructions
- Merge results with existing extraction
- Update database incrementally

**Input:**
```typescript
{
  business_id: string;
  scrape_id: string; // Previous scrape to augment
  missing_fields: string[]; // ["booking_url", "kitchen_close_time"]
  target_pages?: string[]; // Optional explicit page list
}
```

**Strategy:** Maps fields to likely page types:
- `booking_url` → Contact page, Booking page
- `menu_items` → Menu page, Homepage
- `opening_hours` → Contact page, Homepage, About page
- `kitchen_close_time` → Menu page, Contact page

---

### 2.2 Cloud Run Scraper Updates

#### New endpoint: `/scrape-v3-async`
**Purpose:** Same as `/scrape-v3` but with webhook callback support

**Changes:**
1. Accept `webhook_url` parameter
2. Accept `job_id` parameter for correlation
3. **POST to webhook when complete** (or on failure)
4. Support `targeted_crawl` mode:
   ```javascript
   {
     mode: "targeted",
     pages_to_scrape: ["/kontakt/", "/menu/"],
     base_extraction_id: "uuid" // Merge with this
   }
   ```

**Webhook Payload:**
```typescript
{
  job_id: string;
  scrape_result_id: string;
  status: "success" | "partial" | "failed";
  pages_crawled: number;
  duration_ms: number;
  quality_rating: string;
  error?: string;
}
```

---

### 2.3 Frontend Updates

#### New hook: `useAsyncAnalysis`
```typescript
const {
  analyze,      // Trigger async analysis
  status,       // Current job status
  progress,     // Progress percentage
  result,       // Final result when complete
  error,        // Error if failed
  isLoading,    // Boolean convenience
} = useAsyncAnalysis();

// Usage
const handleAnalyze = async () => {
  const job = await analyze(websiteUrl);
  // Automatic polling starts
  // Hook updates status/progress in real-time
};
```

**Implementation:**
- Calls `/analyze-website-async` to start job
- Polls `/scrape-status/{job_id}` every 3s
- Updates UI with progress
- Shows completion or error
- Handles re-scrape trigger for missing fields

#### UI Changes

**Progress States:**
1. **Pending** - "Preparing scraper..." (5-10s)
2. **Scraping** - "Analyzing website... (Page 1 of 3)" (30-180s)
3. **Extracting** - "Processing data..." (10-30s)
4. **Completed** - Show results
5. **Failed** - Show error + retry option

**Progress Indicators:**
- Linear progress bar (0-100%)
- Step indicator (1/3, 2/3, 3/3)
- Estimated time remaining
- Cancel button (optional - mark job as cancelled)

**Missing Fields UI:**
```
⚠️ Some information couldn't be found:
   • Booking link
   • Kitchen closing time

[🔄 Search Again] [⏭️ Continue Without]
```

---

## 3. Database Schema Changes

### 3.1 New Table: `scrape_jobs`

```sql
CREATE TABLE scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'scraping', 'extracting', 'completed', 'failed', 'cancelled')),
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_step TEXT,
  
  -- Results
  scrape_result_id UUID REFERENCES website_scrape_results(id),
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  force_refresh BOOLEAN DEFAULT false,
  callback_url TEXT, -- Optional webhook for frontend notifications
  initiated_by UUID REFERENCES auth.users(id),
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  
  -- Statistics
  pages_crawled INTEGER DEFAULT 0,
  duration_ms INTEGER,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  parent_job_id UUID REFERENCES scrape_jobs(id), -- For targeted re-scrapes
  
  -- Indexes
  INDEX idx_scrape_jobs_business ON scrape_jobs(business_id),
  INDEX idx_scrape_jobs_status ON scrape_jobs(status),
  INDEX idx_scrape_jobs_created ON scrape_jobs(created_at DESC)
);

-- Row-level security
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scrape jobs"
  ON scrape_jobs FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));
```

---

### 3.2 Table Updates: `website_scrape_results`

**Add columns for async tracking:**

```sql
ALTER TABLE website_scrape_results
  ADD COLUMN job_id UUID REFERENCES scrape_jobs(id),
  ADD COLUMN webhook_status TEXT CHECK (webhook_status IN ('pending', 'delivered', 'failed')),
  ADD COLUMN webhook_attempts INTEGER DEFAULT 0,
  ADD COLUMN is_targeted_rescrape BOOLEAN DEFAULT false,
  ADD COLUMN parent_scrape_id UUID REFERENCES website_scrape_results(id),
  ADD COLUMN targeted_pages TEXT[]; -- For targeted re-scrapes
```

---

### 3.3 Migration Script

```sql
-- File: _add_async_scraping_tables.sql

BEGIN;

-- 1. Create scrape_jobs table
CREATE TABLE IF NOT EXISTS scrape_jobs (
  -- [Full schema from above]
);

-- 2. Add async columns to website_scrape_results
ALTER TABLE website_scrape_results
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES scrape_jobs(id),
  ADD COLUMN IF NOT EXISTS webhook_status TEXT,
  ADD COLUMN IF NOT EXISTS webhook_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_targeted_rescrape BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_scrape_id UUID,
  ADD COLUMN IF NOT EXISTS targeted_pages TEXT[];

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_business 
  ON scrape_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status 
  ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created 
  ON scrape_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_results_job 
  ON website_scrape_results(job_id);

-- 4. Enable RLS
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scrape jobs"
  ON scrape_jobs FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

COMMIT;
```

---

## 4. API Endpoints

### Summary Table

| Endpoint | Method | Timeout | Purpose | Auth |
|----------|--------|---------|---------|------|
| `/analyze-website-async` | POST | 30s | Start async scrape job | User JWT |
| `/scrape-status/{job_id}` | GET | 10s | Get job status | User JWT |
| `/scrape-completed` | POST | 150s | Webhook from Cloud Run | API Key |
| `/rescrape-missing-fields` | POST | 30s | Targeted re-scrape | User JWT |
| Cloud Run `/scrape-v3-async` | POST | 180s | Async scrape with callback | API Key |

---

### Endpoint Details

#### POST `/analyze-website-async`

**Request:**
```typescript
POST /functions/v1/analyze-website-async
Authorization: Bearer <user_jwt>
Content-Type: application/json

{
  "url": "https://restaurantvaldemar.dk/",
  "force_refresh": false,
  "callback_url": "https://myapp.com/webhook/scrape-complete" // Optional
}
```

**Response (200):**
```typescript
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "estimated_duration_ms": 45000,
  "progress_url": "/functions/v1/scrape-status/550e8400-...",
  "created_at": "2026-07-22T14:30:00Z"
}
```

**Response (200 - Cache Hit):**
```typescript
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "cached": true,
  "scrape_id": "abc123",
  "quality": "good",
  "extraction_summary": { /* ... */ }
}
```

**Error Responses:**
- `400` - Invalid URL or missing business_id
- `401` - Invalid/missing JWT
- `429` - Rate limit exceeded (max 5 concurrent jobs per user)

---

#### GET `/scrape-status/{job_id}`

**Request:**
```typescript
GET /functions/v1/scrape-status/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <user_jwt>
```

**Response (200):**
```typescript
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "scraping",
  "progress_percent": 65,
  "current_step": "Crawling contact page (2 of 3)",
  "pages_crawled": 2,
  "estimated_time_remaining_ms": 15000,
  "created_at": "2026-07-22T14:30:00Z",
  "started_at": "2026-07-22T14:30:05Z",
  "estimated_completion_at": "2026-07-22T14:31:05Z"
}
```

**Response (200 - Completed):**
```typescript
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress_percent": 100,
  "current_step": "Extraction complete",
  "pages_crawled": 3,
  "result": {
    "scrape_id": "abc123",
    "quality": "good",
    "extraction_summary": {
      "tier1_fields": ["business_name", "address", "phone"],
      "tier2_fields": ["opening_hours", "menu_preview"],
      "tier3_fields": ["booking_url"],
      "total_saved": 12
    }
  },
  "created_at": "2026-07-22T14:30:00Z",
  "completed_at": "2026-07-22T14:31:02Z",
  "duration_ms": 62000
}
```

**Response (200 - Failed):**
```typescript
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "progress_percent": 40,
  "error": "Scraper timeout after 180s",
  "error_details": {
    "code": "SCRAPER_TIMEOUT",
    "pages_crawled": 1,
    "last_successful_page": "https://example.com/"
  },
  "created_at": "2026-07-22T14:30:00Z",
  "completed_at": "2026-07-22T14:33:05Z"
}
```

---

#### POST `/scrape-completed` (Webhook)

**Request (from Cloud Run):**
```typescript
POST /functions/v1/scrape-completed
X-API-Key: <cloud_run_api_key>
Content-Type: application/json

{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "scrape_result_id": "abc123-def456-...",
  "status": "success",
  "pages_crawled": 3,
  "duration_ms": 58000,
  "quality_rating": "good"
}
```

**Response (200):**
```typescript
{
  "acknowledged": true,
  "extraction_started": true
}
```

**Process:**
1. Validate API key
2. Update job status to "extracting"
3. Call existing `extract-from-scrape` logic
4. Update job to "completed" or "failed"
5. If frontend callback_url provided, trigger webhook

---

#### POST `/rescrape-missing-fields`

**Request:**
```typescript
POST /functions/v1/rescrape-missing-fields
Authorization: Bearer <user_jwt>
Content-Type: application/json

{
  "business_id": "uuid",
  "scrape_id": "abc123",
  "missing_fields": ["booking_url", "kitchen_close_time"],
  "target_pages": ["/kontakt/", "/menu/"] // Optional
}
```

**Response (200):**
```typescript
{
  "job_id": "new-job-uuid",
  "status": "pending",
  "scrape_type": "targeted_rescrape",
  "parent_scrape_id": "abc123",
  "pages_to_scrape": ["/kontakt/", "/menu/"],
  "estimated_duration_ms": 25000,
  "progress_url": "/functions/v1/scrape-status/new-job-uuid"
}
```

**Smart Page Selection:**
```javascript
const FIELD_TO_PAGE_MAP = {
  booking_url: ['contact', 'booking', 'reservation'],
  kitchen_close_time: ['menu', 'contact', 'about'],
  opening_hours: ['contact', 'about', 'homepage'],
  menu_items: ['menu', 'homepage'],
  takeaway_info: ['menu', 'delivery', 'takeaway'],
};
```

---

## 5. Implementation Phases

### Phase 1: Core Async Infrastructure (Week 1)
**Goal:** Make basic async scraping work

**Tasks:**
1. ✅ Create database migration for `scrape_jobs` table
2. ✅ Create `/analyze-website-async` Edge Function
3. ✅ Create `/scrape-status/{job_id}` Edge Function
4. ✅ Create `/scrape-completed` webhook handler
5. ✅ Update Cloud Run scraper to support webhooks
6. ✅ Add `job_id` tracking to `website_scrape_results`
7. ✅ Test end-to-end async flow

**Success Criteria:**
- User can trigger async scrape
- Frontend receives immediate job_id response
- Cloud Run calls webhook on completion
- Extraction runs asynchronously
- Job status updates correctly

**Testing:**
- Test with Restaurant Valdemar (multi-page, 160s+)
- Test timeout scenarios (scraper fails at 180s)
- Test concurrent jobs (multiple users)

---

### Phase 2: Frontend Integration (Week 1-2)
**Goal:** Replace sync calls with async UI

**Tasks:**
1. ✅ Create `useAsyncAnalysis` React hook
2. ✅ Build progress UI components
3. ✅ Add polling logic (3s interval)
4. ✅ Handle all job states (pending, scraping, extracting, completed, failed)
5. ✅ Add cancel functionality
6. ✅ Update "Analyze Website" button flow
7. ✅ Add loading states and error handling

**Success Criteria:**
- Users see real-time progress
- No more IDLE_TIMEOUT errors
- Clear feedback on success/failure
- Can retry failed jobs

**UI Mockup:**
```
┌─────────────────────────────────────┐
│ Analyzing Website...                │
│ ████████████░░░░░░░░░░  65%        │
│ Crawling contact page (2 of 3)     │
│ Estimated time: 15 seconds          │
│                                     │
│ [Cancel]                            │
└─────────────────────────────────────┘
```

---

### Phase 3: Targeted Re-scraping (Week 2)
**Goal:** Fill missing data without full re-scrape

**Tasks:**
1. ✅ Implement field-to-page mapping logic
2. ✅ Create `/rescrape-missing-fields` endpoint
3. ✅ Add merge logic for partial extractions
4. ✅ Update Cloud Run for targeted crawl mode
5. ✅ Build "Search Again" UI for missing fields
6. ✅ Add completeness scoring to results

**Success Criteria:**
- Can re-scrape just `/kontakt/` page for booking_url
- Merges new data with existing extraction
- Faster than full re-scrape (15-30s vs 160s)
- User decides whether to re-scrape or proceed

**UI Flow:**
```
Initial Scrape Complete ✓

⚠️ Some information couldn't be found:
   • Booking link (usually on Contact page)
   • Kitchen closing time

[🔄 Search Again]  [⏭️ Continue Without]

↓ (if Search Again)

Searching for missing information...
████████████████████  100%
Found 1 of 2 missing fields

✓ Booking link: restaurantvaldemar.dk/kontakt/
✗ Kitchen closing time: Not found
```

---

### Phase 4: Optimization & Monitoring (Week 3)
**Goal:** Production-ready reliability

**Tasks:**
1. ✅ Add retry logic for webhook failures
2. ✅ Implement job timeout cleanup (24h old jobs)
3. ✅ Add Supabase Realtime subscriptions (replace polling)
4. ✅ Create admin dashboard for job monitoring
5. ✅ Add metrics/analytics:
   - Average scrape duration by page count
   - Failure rates by error type
   - Most common missing fields
6. ✅ Optimize polling intervals (adaptive based on progress)
7. ✅ Add rate limiting (prevent abuse)

**Success Criteria:**
- 99%+ webhook delivery success
- Jobs auto-cleanup after 24h
- Real-time updates via Supabase Realtime
- Clear visibility into system health

---

## 6. Flow Diagrams

### 6.1 Happy Path: Full Async Flow

```
┌──────────┐
│  User    │ Clicks "Analyze Website"
└────┬─────┘
     │
     v
┌────────────────────────────────────────────────┐
│  Frontend: POST /analyze-website-async         │
│  - url: "https://restaurantvaldemar.dk/"       │
│  - business_id: "uuid"                         │
└────┬───────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────┐
│  Edge Function: analyze-website-async          │
│  1. Validate auth & URL                        │
│  2. Check 24h cache (miss)                     │
│  3. Create scrape_jobs record (status: pending)│
│  4. Trigger Cloud Run with webhook URL         │
│  5. Return job_id immediately (< 5s)           │
└────┬───────────────────────────────────────────┘
     │
     v
┌──────────┐
│ Frontend │ Receives job_id, starts polling /scrape-status
└────┬─────┘ (every 3 seconds)
     │
     ├──> Shows: "Preparing scraper..." (status: pending)
     │
     v
┌────────────────────────────────────────────────┐
│  Cloud Run: /scrape-v3-async                   │
│  1. Update job: status=scraping, progress=10%  │
│  2. Crawl homepage (45s)                       │
│  3. Update job: progress=40%                   │
│  4. Detect missing booking → crawl /kontakt/   │
│  5. Update job: progress=70%                   │
│  6. Extract data from 2 pages                  │
│  7. Save to website_scrape_results             │
│  8. Update job: progress=90%                   │
│  9. POST webhook to /scrape-completed          │
│  Total time: 58s                               │
└────┬───────────────────────────────────────────┘
     │
     │ (Frontend polls, sees progress updates)
     ├──> "Analyzing website... (Page 1 of 2)"
     ├──> "Analyzing website... (Page 2 of 2)"
     │
     v
┌────────────────────────────────────────────────┐
│  Edge Function: /scrape-completed (webhook)    │
│  1. Validate API key                           │
│  2. Update job: status=extracting              │
│  3. Call extract-from-scrape (3-tier)          │
│     - Tier 1: Critical fields                  │
│     - Tier 2: Important fields                 │
│     - Tier 3: AI-enriched fields               │
│  4. Write to database (12 fields saved)        │
│  5. Update job: status=completed, progress=100%│
│  Total time: 15s                               │
└────┬───────────────────────────────────────────┘
     │
     v
┌──────────┐
│ Frontend │ Next poll sees status=completed
└────┬─────┘
     │
     ├──> Stops polling
     ├──> Shows success message
     └──> Displays extracted data

Total Duration: 5s (response) + 58s (scrape) + 15s (extract) = 78s
User Experience: Immediate response, live progress, no timeout
```

---

### 6.2 Error Scenario: Cloud Run Timeout

```
User triggers analysis
     │
     v
Edge Function creates job (status: pending)
     │
     v
Cloud Run starts scraping
     │
     ├──> Homepage crawled (45s) ✓
     ├──> Detects 5 more pages needed
     ├──> Starts crawling page 2 (30s) ✓
     ├──> Starts crawling page 3 (30s) ✓
     ├──> Starts crawling page 4 (30s) ✓
     ├──> Starts crawling page 5...
     └──> TIMEOUT at 180s ❌
     │
     v
Cloud Run sends webhook with status: "partial"
     │
     v
Edge Function receives webhook
     │
     ├──> Updates job: status=completed (partial)
     ├──> Runs extraction on 4 pages (not 5)
     └──> Marks missing fields
     │
     v
Frontend shows results:
┌────────────────────────────────────────┐
│ ✓ Analysis Complete (Partial)         │
│                                        │
│ Found: 10 of 12 fields                │
│                                        │
│ ⚠️ Missing:                            │
│   • Kitchen closing time               │
│   • Detailed menu items                │
│                                        │
│ [🔄 Search Again]  [⏭️ Continue]       │
└────────────────────────────────────────┘
```

---

### 6.3 Targeted Re-scrape Flow

```
User sees missing booking_url
     │
     └──> Clicks "Search Again"
     │
     v
Frontend: POST /rescrape-missing-fields
     {
       scrape_id: "abc123",
       missing_fields: ["booking_url"]
     }
     │
     v
Edge Function:
     │
     ├──> Maps booking_url → [contact, booking pages]
     ├──> Loads previous scrape (abc123)
     ├──> Identifies /kontakt/ not yet crawled
     ├──> Creates new job (targeted mode)
     └──> Triggers Cloud Run:
          {
            mode: "targeted",
            pages: ["/kontakt/"],
            parent_scrape: "abc123"
          }
     │
     v
Cloud Run:
     │
     ├──> Only crawls /kontakt/ (20s)
     ├──> Detects "Bestil bord" section
     ├──> Extracts booking_url
     └──> Sends webhook with partial update
     │
     v
Edge Function:
     │
     ├──> Merges with existing extraction (abc123)
     ├──> Updates business_profile.booking_url
     └──> Marks job complete
     │
     v
Frontend:
┌────────────────────────────────────────┐
│ ✓ Found missing information!           │
│                                        │
│ • Booking link: ✓                      │
│   restaurantvaldemar.dk/kontakt/       │
│                                        │
│ [Continue]                             │
└────────────────────────────────────────┘

Total Time: 25s (vs 160s for full re-scrape)
Cost: $0.01 (vs $0.06 for full re-scrape)
```

---

## 7. Error Handling & Resilience

### 7.1 Webhook Delivery Failures

**Problem:** Cloud Run completes but webhook to Edge Function fails

**Solution: Retry with Exponential Backoff**

```javascript
// In Cloud Run after scraping
async function deliverWebhook(webhookUrl, payload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });
      
      if (response.ok) {
        console.log('✅ Webhook delivered on attempt', attempt);
        return true;
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error(`❌ Webhook attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  // All retries failed - update scrape_result with error flag
  console.error('❌ Webhook delivery failed after', maxRetries, 'attempts');
  await markWebhookFailed(payload.job_id);
  return false;
}
```

**Fallback:** Edge Function runs cleanup job every 5 minutes:
```sql
-- Find scrapes without completed jobs (webhook never arrived)
SELECT sr.id, sr.created_at, sj.status
FROM website_scrape_results sr
JOIN scrape_jobs sj ON sr.job_id = sj.id
WHERE sj.status = 'scraping'
  AND sr.created_at < NOW() - INTERVAL '10 minutes'
  AND sr.webhook_status = 'pending';

-- Manually trigger extraction for these orphaned scrapes
```

---

### 7.2 Job Timeout Scenarios

**Scenario A: Cloud Run times out (180s)**
- Cloud Run sends partial webhook with error details
- Edge Function extracts what was scraped (4 of 5 pages)
- Job marked as "completed" with warnings
- User offered targeted re-scrape option

**Scenario B: Webhook never received (Cloud Run crashed)**
- Cleanup job detects orphaned scrapes after 10 minutes
- Automatically triggers extraction on saved scrape result
- Marks job as "completed" or "failed" based on quality

**Scenario C: Extraction times out (150s)**
- Edge Function catches timeout, marks job as "failed"
- Saves partial extraction results
- User can retry extraction (no need to re-scrape)

---

### 7.3 Rate Limiting

**Prevent abuse with per-user limits:**

```sql
-- Check active jobs before creating new one
SELECT COUNT(*)
FROM scrape_jobs
WHERE business_id = :business_id
  AND status IN ('pending', 'scraping', 'extracting')
  AND created_at > NOW() - INTERVAL '10 minutes';

-- If count > 5, return 429 Too Many Requests
```

**Limits:**
- Max 5 concurrent jobs per user
- Max 20 jobs per hour per user
- Max 100 jobs per day per user (free tier)

---

### 7.4 Idempotency

**Problem:** User clicks "Analyze" multiple times rapidly

**Solution: Idempotent job creation**

```javascript
// In /analyze-website-async
const existingJob = await supabase
  .from('scrape_jobs')
  .select('id, status, created_at')
  .eq('business_id', businessId)
  .eq('url', url)
  .in('status', ['pending', 'scraping', 'extracting'])
  .gte('created_at', new Date(Date.now() - 5 * 60 * 1000)) // Last 5 minutes
  .maybeSingle();

if (existingJob) {
  // Return existing job instead of creating duplicate
  return {
    job_id: existingJob.id,
    status: existingJob.status,
    duplicate: true,
    message: 'Analysis already in progress',
  };
}

// Otherwise create new job
```

---

### 7.5 Monitoring & Alerts

**Key Metrics to Track:**

1. **Job Success Rate**
   - Target: >95% successful completions
   - Alert if <90% over 1 hour

2. **Average Duration**
   - Baseline: 45-60s for single page, 120-180s for multi-page
   - Alert if p95 > 200s

3. **Webhook Delivery Rate**
   - Target: >99% first-attempt success
   - Alert if <95%

4. **Extraction Quality**
   - Track fields found per scrape
   - Alert if average completeness <70%

5. **Error Types**
   - Track distribution of error codes
   - Alert on new error patterns

**Implementation:**
```sql
-- Create metrics view
CREATE VIEW scrape_metrics_hourly AS
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  AVG(duration_ms) AS avg_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
  AVG(pages_crawled) AS avg_pages
FROM scrape_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

---

## 8. Migration Strategy

### 8.1 Gradual Rollout Plan

**Phase 1: Shadow Mode (Week 1)**
- Deploy async endpoints alongside existing sync endpoint
- Frontend still uses sync endpoint (`analyze-and-distribute-website`)
- Async jobs run in background for comparison
- Monitor success rates and timing

**Phase 2: Beta Users (Week 2)**
- Enable async mode for 10% of users (feature flag)
- Gather feedback on UI/UX
- Monitor error rates vs sync mode
- Fix bugs before wider rollout

**Phase 3: Gradual Migration (Week 3)**
- 25% of traffic → async
- 50% of traffic → async
- 75% of traffic → async
- Monitor continuously, ready to rollback

**Phase 4: Full Migration (Week 4)**
- 100% of traffic → async
- Mark sync endpoint as deprecated
- Keep sync endpoint for 30 days (fallback)
- Delete sync endpoint after stability confirmed

---

### 8.2 Feature Flag Implementation

```typescript
// In frontend config
const FEATURES = {
  ASYNC_SCRAPING: {
    enabled: true,
    rolloutPercent: 100, // 0-100
    betaUsers: ['user-id-1', 'user-id-2'], // Always enabled
  },
};

function useFeatureFlag(flag: string): boolean {
  const user = useUser();
  const config = FEATURES[flag];
  
  if (!config.enabled) return false;
  if (config.betaUsers.includes(user.id)) return true;
  
  // Hash user ID to get consistent rollout
  const hash = hashString(user.id) % 100;
  return hash < config.rolloutPercent;
}

// Usage in component
const isAsyncEnabled = useFeatureFlag('ASYNC_SCRAPING');

const handleAnalyze = () => {
  if (isAsyncEnabled) {
    return analyzeAsync(); // New async flow
  } else {
    return analyzeSync(); // Old sync flow
  }
};
```

---

### 8.3 Rollback Plan

**Trigger Conditions:**
- Success rate drops below 80%
- P95 latency exceeds 300s
- More than 10 user complaints in 1 hour
- Critical bug discovered

**Rollback Steps:**
1. Set `ASYNC_SCRAPING.enabled = false` in frontend config
2. All users immediately revert to sync endpoint
3. Investigate root cause
4. Deploy fix
5. Re-enable for 10% of users
6. Gradual re-rollout

**No Data Loss:**
- All scrape_jobs remain in database
- Can re-run extraction on completed scrapes
- No user-facing data changes (same database tables)

---

## 9. Testing Plan

### 9.1 Unit Tests

**Edge Functions:**
- `analyze-website-async` creates jobs correctly
- `scrape-status` returns accurate progress
- `scrape-completed` webhook validates auth
- `rescrape-missing-fields` maps fields to pages correctly

**Cloud Run:**
- Webhook delivery retries on failure
- Targeted crawl mode only scrapes specified pages
- Progress updates sent at correct intervals

---

### 9.2 Integration Tests

**Happy Path:**
1. Create job → verify job_id returned
2. Poll status → verify progress updates
3. Complete scrape → verify webhook received
4. Check database → verify extraction saved
5. Query frontend → verify data displayed

**Error Scenarios:**
1. Invalid URL → verify 400 error
2. Unauthorized user → verify 401 error
3. Scraper timeout → verify partial results saved
4. Webhook failure → verify cleanup job runs
5. Duplicate job request → verify idempotency

**Targeted Re-scrape:**
1. Initial scrape missing booking_url
2. Trigger re-scrape for contact page only
3. Verify only 1 page crawled (not full site)
4. Verify booking_url merged into existing data

---

### 9.3 Load Testing

**Scenario 1: Concurrent Users**
- 50 users trigger analysis simultaneously
- Verify all jobs created within 10s
- Verify no database deadlocks
- Verify proper rate limiting

**Scenario 2: Sustained Load**
- 10 jobs/minute for 1 hour (600 total jobs)
- Verify success rate >95%
- Verify average latency stable
- Verify no memory leaks in Cloud Run

**Scenario 3: Spike**
- 100 jobs triggered within 30 seconds
- Verify graceful degradation (some queued)
- Verify no crashes
- Verify all jobs eventually complete

---

### 9.4 User Acceptance Testing (UAT)

**Test Cases:**
1. **First-time user**
   - Onboarding flow with website analysis
   - Verify progress indicators clear
   - Verify results easy to understand

2. **Power user**
   - Analyze 5 websites in succession
   - Verify re-scrape for missing fields works
   - Verify cache behavior (skip re-scraping same URL)

3. **Edge cases**
   - Website with 10+ pages (very slow)
   - Website with JavaScript-heavy SPAs
   - Website with PDF menus
   - Website completely down (DNS failure)

---

### 9.5 Test Websites

**Simple (baseline):**
- https://restaurant-example.com/ (single page, <30s)

**Complex (realistic):**
- https://restaurantvaldemar.dk/ (multi-page, ~160s)
- https://cafe-faust.dk/ (embedded menus, forms)

**Challenging (stress test):**
- https://heavy-spa-site.com/ (12s hydration timeout)
- https://pdf-only-menu.com/ (PDF parsing required)

---

## 10. Rollout Strategy

### Week 1: Infrastructure
- ✅ Deploy database migration
- ✅ Deploy Edge Functions (shadow mode)
- ✅ Update Cloud Run scraper
- ✅ Integration testing
- ✅ Monitoring setup

### Week 2: Frontend & Beta
- ✅ Build async UI components
- ✅ Add feature flag system
- ✅ Enable for 5 beta users
- ✅ Gather feedback & fix bugs
- ✅ Load testing

### Week 3: Gradual Rollout
- ✅ 10% rollout → monitor 24h
- ✅ 25% rollout → monitor 24h
- ✅ 50% rollout → monitor 48h
- ✅ 75% rollout → monitor 24h
- ✅ Implement targeted re-scrape

### Week 4: Full Migration
- ✅ 100% rollout
- ✅ Deprecate sync endpoint
- ✅ Update documentation
- ✅ Post-mortem & lessons learned

---

## 11. Success Metrics

**Pre-Rollout (Current State):**
- IDLE_TIMEOUT errors: ~30% of multi-page scrapes
- Average scrape time: 45-180s (user waits synchronously)
- User frustration: High ("Why did it fail?")

**Post-Rollout (Target State):**
- IDLE_TIMEOUT errors: 0%
- User-perceived response time: <5s (immediate job_id)
- Completion rate: >95%
- User satisfaction: "I love seeing the progress!"

**KPIs:**
1. **Immediate Response:** 100% of requests return <5s
2. **Success Rate:** >95% of jobs complete successfully
3. **Average Total Time:** <90s for typical restaurant site
4. **Re-scrape Efficiency:** Targeted re-scrape 70% faster than full re-scrape
5. **User Retention:** Onboarding completion rate increases 20%

---

## 12. Future Enhancements

### Post-MVP Ideas

**Smart Caching:**
- Cache individual pages, not just full scrapes
- Invalidate cache only for changed pages
- "Last updated 2 days ago - [Refresh]"

**Predictive Re-scraping:**
- AI predicts which missing fields likely exist
- Automatically suggest targeted re-scrape
- "We didn't find opening hours, but 87% of restaurants have them on their Contact page. [Search there?]"

**Real-time Updates:**
- Replace polling with Supabase Realtime subscriptions
- Instant progress updates via WebSocket
- Lower server load (no polling every 3s)

**Parallel Page Crawling:**
- Scrape multiple pages simultaneously (not sequentially)
- Reduce multi-page scrape time: 160s → 80s
- Requires careful rate limiting

**Incremental Extraction:**
- Run extraction on each page as it's crawled (not at end)
- Faster time-to-first-result
- User sees partial data immediately

---

## Summary

This async architecture solves the IDLE_TIMEOUT problem by:

1. **Decoupling scraping from user request** - Immediate response, no waiting
2. **Progress visibility** - Users see what's happening
3. **Targeted re-scraping** - Fill missing data efficiently
4. **Resilient webhooks** - Retry logic prevents lost jobs
5. **Gradual rollout** - Minimize risk, validate at each step

**Estimated Implementation Time:** 3-4 weeks  
**Estimated Cost Impact:** Neutral (same scraping, better UX)  
**Risk Level:** Medium (new architecture, but with rollback plan)  
**User Impact:** High (eliminates frustrating timeouts)

---

**Next Steps:**
1. Review and approve this plan
2. Create GitHub issues for each phase
3. Assign developers to Phase 1 tasks
4. Schedule kickoff meeting
5. Begin Week 1 implementation

**Questions to Resolve:**
- Should we build real-time updates (Supabase Realtime) in Phase 1 or later?
- What's the acceptable polling interval? (3s? 5s? Adaptive?)
- Should re-scrape be automatic or require user confirmation?
- Do we want admin dashboard for monitoring in MVP?
