# Menu Extraction Architecture

## Overview

The menu extraction system is a **distributed, asynchronous processing pipeline** that extracts menu information from PDF files using OCR and AI-powered parsing.

**Key Principle**: Extraction is async because PDF processing can take 1-5 minutes. Instead of blocking the frontend, we use a queue-based system with real-time updates.

---

## System Architecture

```
┌─────────────────┐
│     Frontend    │
│  (React App)    │
└────────┬────────┘
         │ 1. User clicks "Extract Menu"
         │    Sends: { businessId, pdfUrl }
         │
         ▼
┌─────────────────────────────────┐
│  Supabase Edge Function         │
│  extract-menu-pdf               │
│  (Deno runtime)                 │
└────────┬────────────────────────┘
         │ 2. Validate JWT token
         │    Create menu_results record
         │    status = 'queued'
         │    Return resultId
         │
         ▼
┌─────────────────────────────────┐
│  Supabase PostgreSQL            │
│  menu_results table             │
│  (Job Queue)                    │
└────────┬────────────────────────┘
         │ 3. Record created with:
         │    - id (UUID) = resultId
         │    - status = 'queued'
         │    - pdf_url
         │    - business_id
         │
         ▼
┌─────────────────────────────────┐
│  Cloud Run Worker               │
│  (Python service)               │
│  menu-ocr-worker                │
└────────┬────────────────────────┘
         │ 4. Worker polls every 2 seconds:
         │    SELECT * FROM menu_results
         │    WHERE status = 'queued'
         │    LIMIT 1
         │
         │ 5. For each queued job:
         │    a) Download PDF from pdfUrl
         │    b) Extract pages using PyMuPDF
         │    c) OCR each page with Tesseract
         │    d) Apply Danish corrections
         │    e) Parse structure with GPT-4o
         │    f) Update menu_results with results
         │
         ▼
┌─────────────────────────────────┐
│  Frontend Receives Update       │
│  via Supabase Realtime          │
│  (WebSocket subscription)       │
└─────────────────────────────────┘
         │ 6. Frontend updates:
         │    - Shows extracted menu
         │    - Displays confidence scores
         │    - Allows user to refine
```

---

## Component Details

### 1. Frontend Hook: `useMenuHandlers.ts`

**File**: `/src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts`

**Function**: `extractMenuFromUrl(url: string)`

**Flow**:
```typescript
// 1. Get current session
const session = await supabase.auth.getSession()

// 2. Call Edge Function with:
fetch(`${SUPABASE_URL}/functions/v1/extract-menu-pdf`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${session.access_token}` },
  body: JSON.stringify({
    businessId: uuid,  // Business being edited
    pdfUrl: url        // URL to the PDF file
  })
})

// 3. Get resultId from response
const { resultId } = await response.json()

// 4. Subscribe to Realtime updates
supabase
  .channel(`menu_results:${resultId}`)
  .on('UPDATE', (payload) => {
    if (payload.new.status === 'done') {
      // Extraction complete! Show menu
      updateMenuUrl(url, { 
        status: 'extracted',
        extractedData: payload.new.structured_data 
      })
    } else if (payload.new.status === 'error') {
      // Extraction failed
      updateMenuUrl(url, { 
        status: 'error',
        error: payload.new.error_message 
      })
    }
  })
  .subscribe()
```

**States**:
- `extracting` → User clicked extract
- `processing` → Waiting for result, showing spinner
- `extracted` → Complete, showing menu data
- `error` → Failed, showing error message

---

### 2. Edge Function: `extract-menu-pdf`

**File**: `/supabase/functions/extract-menu-pdf/index.ts`

**Runtime**: Deno

**Responsibility**: Lightweight entry point - validates requests and creates job

**Process**:
```
1. Receive POST request with { businessId, pdfUrl }
2. Extract and validate JWT token
3. Check that businessId matches authenticated user's business
4. Create record in menu_results table:
   {
     id: UUID (generated),
     business_id: businessId,
     pdf_url: pdfUrl,
     status: 'queued',
     created_at: now()
   }
5. Return immediately with:
   {
     success: true,
     resultId: id,
     message: 'Menu extraction queued'
   }
```

**Key Points**:
- **Returns in ~15ms** (just database insert)
- Does NOT wait for processing
- Does NOT download/process PDF (that's the worker's job)
- Frontend gets `resultId` to track the job

**Error Cases**:
- Missing `businessId` or `pdfUrl` → 400 error
- Invalid JWT → 401 error
- Database error → 500 error

---

### 3. Job Queue: `menu_results` Table

**File**: `/supabase/migrations/03_setup_menu_queue.sql`

**Schema**:
```sql
CREATE TABLE menu_results (
  id UUID PRIMARY KEY,                    -- Job ID / Result ID
  business_id UUID NOT NULL,              -- Which business this is for
  pdf_url TEXT NOT NULL,                  -- Where to download the PDF
  status TEXT DEFAULT 'queued',           -- queued | processing | done | error
  raw_text TEXT,                          -- Raw OCR output (before corrections)
  structured_data JSONB,                  -- Final parsed menu
  error_message TEXT,                     -- If status=error, why?
  ocr_engine TEXT DEFAULT 'tesseract',    -- Which OCR engine was used
  confidence_score NUMERIC,               -- Average OCR confidence (0-100)
  processing_time_ms INTEGER,             -- How long it took (milliseconds)
  created_at TIMESTAMP,                   -- When job was created
  updated_at TIMESTAMP                    -- When job was last updated
);

-- Indexes for efficient querying
CREATE INDEX idx_menu_results_status ON menu_results(status);
CREATE INDEX idx_menu_results_business_status ON menu_results(business_id, status);

-- Enable Realtime so frontend gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE menu_results;
```

**How It Works As A Queue**:
- **Queued jobs**: `WHERE status = 'queued'`
- **Processing**: Worker changes status to `'processing'` before starting
- **Complete**: Worker changes status to `'done'` when finished
- **Failed**: Worker changes status to `'error'` if something breaks

**Realtime**: Any update to a row triggers a notification to subscribed clients (frontend)

---

### 4. Cloud Run Worker: `menu-ocr-worker`

**File**: `/cloud-run-workers/menu-ocr-worker/main.py`

**Runtime**: Python 3.11 on Google Cloud Run

**Resources**: 2 CPU, 2GB RAM

**Responsibility**: Heavy lifting - downloads PDFs, performs OCR, parses menus

#### Polling Loop
```python
while True:
    # 1. Check for queued jobs
    response = supabase.table('menu_results') \
        .select('*') \
        .eq('status', 'queued') \
        .limit(1) \
        .execute()
    
    jobs = response.data or []
    
    if not jobs:
        time.sleep(2)  # No jobs, wait and try again
        continue
    
    # 2. Process first queued job
    for job in jobs:
        process_job(job)
```

#### Processing Pipeline

**Step 1: Update Status**
```python
supabase.table('menu_results') \
    .update({'status': 'processing'}) \
    .eq('id', result_id) \
    .execute()
```

**Step 2: Download PDF**
```python
response = requests.get(pdf_url)
pdf_content = response.content
```

**Step 3: Extract Pages with PyMuPDF**
```python
doc = fitz.open(stream=pdf_content, filetype="pdf")
for page_num in range(len(doc)):
    page = doc[page_num]
    # Try text extraction first (for digital PDFs)
    text = page.get_text()
    
    # If very little text, convert to image and OCR
    if len(text.strip()) < 50:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        # Continue to OCR step
```

**Step 4: OCR with Tesseract**
```python
# Use Tesseract with Danish language
ocr_text = pytesseract.image_to_string(img, lang='dan')
# Get confidence data
ocr_data = pytesseract.image_to_data(img, lang='dan', output_type='dict')
```

**Step 5: Apply Danish Corrections**
```python
# 180+ patterns to fix common OCR mistakes
# Examples:
corrections = {
    'abler': 'æbler',        # æ misread as a
    'smgr': 'smør',          # ø misread as g+r
    'rode': 'røde',          # ø misread as o
    'gronne': 'grønne',      # ø misread as on+n
    # ... many more
}

for wrong, correct in sorted_corrections:
    text = text.replace(wrong, correct)
```

**Step 6: Parse with GPT-4o**
```python
response = openai.ChatCompletion.create(
    model="gpt-4o",
    messages=[
        {
            "role": "system",
            "content": """You are a menu parser for Danish restaurants.
Extract and structure the menu from the provided text.
Return JSON with:
{
  "categories": [
    {
      "name": "category name",
      "items": [
        {"name": "dish name", "price": "xx DKK", "description": "..."}
      ]
    }
  ],
  "summary": "Brief menu overview"
}"""
        },
        {
            "role": "user",
            "content": f"Parse this menu text:\n{corrected_text}"
        }
    ]
)

structured_data = json.loads(response.choices[0].message.content)
```

**Step 7: Save Results**
```python
supabase.table('menu_results') \
    .update({
        'status': 'done',
        'raw_text': ocr_text,
        'structured_data': structured_data,
        'confidence_score': avg_confidence,
        'processing_time_ms': elapsed_ms,
        'ocr_engine': 'tesseract'
    }) \
    .eq('id', result_id) \
    .execute()
```

#### Error Handling
```python
try:
    # ... processing ...
except Exception as e:
    supabase.table('menu_results') \
        .update({
            'status': 'error',
            'error_message': str(e)
        }) \
        .eq('id', result_id) \
        .execute()
```

---

## Data Flow Example

### Scenario: User extracts Viggo Christmas menu

**Frontend**:
```
User sees: "https://www.jakobsenco.dk/.../Viggo-julemenu-2025.pdf"
User clicks: "Extract Menu"
Frontend sends:
{
  businessId: "8febb42b-a4c0-433e-8422-604098dc00ce",
  pdfUrl: "https://www.jakobsenco.dk/.../Viggo-julemenu-2025.pdf"
}
```

**Edge Function (15ms)**:
```
✅ JWT validated
✅ Record created in menu_results:
   id: "3a7b9d2e-4f8c-11ed-abc1-0242ac120002"
   status: "queued"
   business_id: "8febb42b-a4c0-433e-8422-604098dc00ce"
   pdf_url: "https://www.jakobsenco.dk/.../Viggo-julemenu-2025.pdf"
✅ Returns: { resultId: "3a7b9d2e-4f8c-11ed-abc1-0242ac120002" }
```

**Frontend**:
```
Stores resultId
Shows spinner: "Processing menu..."
Subscribes to updates on this resultId
```

**Cloud Run Worker (1-5 minutes)**:
```
[2:30 PM] Polls database
[2:30 PM] Finds queued job with id "3a7b9d2e..."
[2:30 PM] Updates status to "processing"
[2:31 PM] Downloads PDF (2.1 MB)
[2:32 PM] Extracts 3 pages using PyMuPDF
[2:33 PM] OCR with Tesseract (page 1 of 3)
[2:34 PM] OCR with Tesseract (page 2 of 3)
[2:35 PM] OCR with Tesseract (page 3 of 3)
[2:36 PM] Applies Danish corrections (180+ patterns)
[2:37 PM] Calls GPT-4o to parse structure
[2:38 PM] Updates menu_results:
   status: "done"
   structured_data: {
     "categories": [
       { "name": "Forretter", "items": [...] },
       { "name": "Hovedretter", "items": [...] }
     ]
   }
   confidence_score: 87.5
   processing_time_ms: 480000
```

**Frontend (via Realtime)**:
```
Receives UPDATE event:
{
  id: "3a7b9d2e...",
  status: "done",
  structured_data: { categories: [...] }
}

Updates UI:
✅ Removes spinner
✅ Shows menu with categories and items
✅ Displays confidence: 87.5%
```

---

## File Organization

### Frontend
- **`useMenuHandlers.ts`** - Main extraction logic and Realtime subscription
- **`useMenuSources.ts`** - Menu URL state management
- **`useMenuExtractions.ts`** - Database state for extracted menus

### Backend (Supabase)
- **`extract-menu-pdf/index.ts`** - Edge Function entry point
- **`03_setup_menu_queue.sql`** - Database schema and migrations

### Worker (Cloud Run)
- **`main.py`** - Main worker loop and processing pipeline
- **`requirements.txt`** - Python dependencies
- **`Dockerfile`** - Container specification
- **`danish.ts`** - OCR corrections dictionary (imported from Supabase)

---

## Status Codes

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `queued` | Waiting for worker | Worker picks up |
| `processing` | Worker is processing | Wait for result |
| `done` | Complete, ready to use | Show in UI |
| `error` | Failed, check error_message | Show error to user |

---

## Debugging

### Frontend Not Getting Response
**Check**:
- Console logs show "Starting extraction for..."?
- Does it show "Response status: 200"?
- Check `resultId` was received

### Job Stuck in "processing"
**Check**:
- Cloud Run worker is running: `gcloud run services list`
- Check logs: `gcloud run services logs read menu-ocr-worker`
- Is Supabase connection working?

### Poor OCR Quality
**Check**:
- `raw_text` field in menu_results table
- `confidence_score` - if < 60%, need Phase 2 (PaddleOCR)
- Are Danish characters preserved (æ, ø, å)?

### GPT Parsing Failures
**Check**:
- OPENAI_API_KEY is set on Cloud Run
- `raw_text` has proper content before GPT call
- Check logs for API errors

---

## Performance Characteristics

| Component | Time | Bottleneck |
|-----------|------|-----------|
| Frontend → Edge | 15ms | Network |
| Edge Function | 50ms | Database insert |
| Edge → Frontend Response | 100ms | Total round trip |
| PDF Download | 5-30s | File size / bandwidth |
| Tesseract OCR | 30-120s | Page count (30s per page) |
| GPT-4o Parsing | 10-20s | API latency |
| Total Processing | 1-5 min | **Tesseract OCR** |

---

## Future Improvements

### Phase 2: Fallback OCR Engine
When `confidence_score < 60%`:
- Use PaddleOCR for degraded scans
- Higher accuracy for rotated/low-quality images
- Implemented in Cloud Run worker

### Batch Processing
- Queue multiple PDFs at once
- Parallel workers for faster processing

### Caching
- Cache parsed menus by PDF URL hash
- Skip re-processing identical PDFs

---

## Dependencies

### Frontend
- `@supabase/supabase-js` - Client library
- React hooks for state management

### Edge Function
- Deno standard library
- Supabase JS SDK

### Cloud Run Worker
- **OCR**: Tesseract 5.0 + Danish language pack
- **PDF**: PyMuPDF (fitz)
- **LLM**: OpenAI API (GPT-4o)
- **Database**: supabase-py
- **Server**: Flask (for health checks)

---

## Key Design Decisions

1. **Async Processing**: Can't do 5-minute operations in Edge Function (timeout limit)
2. **Table As Queue**: Simple polling is more reliable than pgmq for this use case
3. **Tesseract First**: Proven on restaurant menus, low cost, good quality for Danish
4. **GPT-4o Parsing**: Better than rule-based parsing for menu structure
5. **Realtime Updates**: Instant feedback to user instead of polling
6. **Distributed**: Separate components so failure in one doesn't break others
