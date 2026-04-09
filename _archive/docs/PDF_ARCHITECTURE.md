# PDF Storage & Extraction Architecture

## Overview
This document describes the complete PDF consent-based storage and extraction workflow for business menu documents.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│ USER ENTERS WEBSITE URL                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Website Crawling & PDF Detection                   │
│ (Edge Function: analyze-website)                           │
│                                                             │
│ • Fetch homepage HTML                                       │
│ • Classify links (MENU, BOOKING, CONTACT, ABOUT)          │
│ • Detect PDF files on website                              │
│ • Extract text from MENU PDFs directly                     │
│ • Return analysis + detected PDFs list                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: PDF Consent Dialog (Frontend)                      │
│                                                             │
│ IF PDFs detected:                                           │
│   ┌───────────────────────────────────────────────────┐   │
│   │ "We found 2 PDF files. Store them?"               │   │
│   │                                                     │   │
│   │  [Yes, store them]    [Skip for now]             │   │
│   └───────────────────────────────────────────────────┘   │
│                                                             │
│ User choices:                                               │
│ ├── YES → Proceed to STEP 3 (Upload to Storage)           │
│ └── NO  → Skip storage, use extracted text only           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: PDF Upload & Storage                               │
│ (Edge Function: upload-pdf)                                │
│                                                             │
│ For each PDF:                                               │
│ • Fetch PDF from URL (or upload from device)              │
│ • Extract text using unpdf                                 │
│ • Upload to Supabase Storage (business-documents bucket)   │
│ • Store metadata in business_documents table               │
│ • Return: storage path, public URL, extracted text        │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Edge Function: `analyze-website`
**Location:** `/supabase/functions/analyze-website/index.ts`

**Purpose:** Crawl website, detect PDFs, extract business information

**Key Features:**
- Crawls homepage + priority pages (MENU, BOOKING, CONTACT, ABOUT)
- Classifies links using pattern matching + AI fallback
- Detects PDF files (`.pdf` extension)
- Extracts text from MENU PDFs using `unpdf`
- Returns detected PDFs list for consent workflow

**Request:**
```typescript
{
  url: string
  businessName?: string
  businessType?: string
  tier?: 'free' | 'standard_plus' | 'premium'
}
```

**Response:**
```typescript
{
  businessName: string
  businessType: string
  description: string
  contact: { phone, email, address }
  openingHours: { ... }
  offerings: { categories, signatureItems, dietaryOptions }
  menuUrl: string
  bookingUrl: string
  keywords: string[]
  detectedPDFs: Array<{
    url: string
    type: 'MENU' | 'ABOUT'
    name: string  // filename
  }>
}
```

### 2. Edge Function: `upload-pdf`
**Location:** `/supabase/functions/upload-pdf/index.ts`

**Purpose:** Upload and store PDF files with text extraction

**Key Features:**
- Supports URL-based fetch OR base64 upload
- Extracts text using `unpdf` (serverless-friendly)
- Uploads to Supabase Storage (`business-documents` bucket)
- Stores metadata in `business_documents` table
- Returns public URL and extracted text

**Request:**
```typescript
{
  pdfUrl?: string           // Fetch from URL
  pdfBase64?: string        // Or upload directly
  fileName: string
  businessId: string
  pdfType: 'menu' | 'wine_list' | 'other'
}
```

**Response:**
```typescript
{
  success: true
  storagePath: string       // business-id/menu/filename.pdf
  publicUrl: string         // Public accessible URL
  extractedText: string     // Full PDF text
  textLength: number
  fileSize: number
  documentId: string        // Database record ID
}
```

### 3. Database Table: `business_documents`
**Location:** `/supabase/migrations/002_business_documents.sql`

**Schema:**
```sql
CREATE TABLE business_documents (
  id UUID PRIMARY KEY
  business_id UUID REFERENCES businesses(id)
  document_type TEXT CHECK (IN ('menu', 'wine_list', 'other'))
  file_name TEXT
  storage_path TEXT UNIQUE
  public_url TEXT
  extracted_text TEXT        -- Full PDF text for AI analysis
  file_size INTEGER
  created_at TIMESTAMP
  updated_at TIMESTAMP
)
```

**RLS Policies:**
- Users can only access documents for their own businesses
- Full CRUD permissions for authenticated users

### 4. Supabase Storage Bucket: `business-documents`
**Configuration:**
- Public bucket (files accessible via public URL)
- Folder structure: `{business_id}/{document_type}/{filename}.pdf`
- RLS policies enforce user ownership

**Example paths:**
```
business-documents/
  ├── 550e8400-e29b-41d4-a716-446655440000/
  │   ├── menu/
  │   │   ├── summer-menu-2024.pdf
  │   │   └── wine-list.pdf
  │   └── other/
  │       └── catering-menu.pdf
```

### 5. Frontend: PDF Consent Dialog
**Location:** `/src/pages/dashboard/BusinessProfilePage.tsx`

**UI Flow:**
1. User enters website URL → clicks "Analyze"
2. If PDFs detected → Show consent dialog
3. User chooses:
   - **"Yes, store them"** → Calls `upload-pdf` for each PDF
   - **"Skip for now"** → Close dialog, use extracted text only

**Manual Upload:**
- File input below consent dialog
- Accepts multiple PDFs
- Converts to base64 → calls `upload-pdf`

**State Management:**
```typescript
const [detectedPDFs, setDetectedPDFs] = useState<Array<{url, type, name}>>([])
const [showPDFConsent, setShowPDFConsent] = useState(false)
const [pdfConsentGiven, setPdfConsentGiven] = useState(false)
```

## PDF Extraction Methods

### Current: unpdf (Free, Serverless)
- **Use case:** Simple text-based PDFs
- **Pros:** Free, works in Deno, no external dependencies
- **Cons:** Limited OCR, struggles with complex layouts
- **Suitable for:** Free tier, basic menus

### Future: Adobe PDF Services API (Premium)
- **Use case:** Scanned menus, complex layouts, OCR
- **Pros:** Excellent accuracy, table extraction, OCR
- **Cons:** Costs money (after free tier)
- **Suitable for:** Premium tier, professional menus

**Tier-based selection:**
```typescript
const getPDFExtractor = (tier: string) => {
  switch (tier) {
    case 'premium':
      return 'adobe'  // Best quality
    case 'standard_plus':
      return 'unpdf'  // Good balance
    case 'free':
    default:
      return 'unpdf'  // Free
  }
}
```

## User Workflows

### Workflow 1: Consent-Based Storage (Recommended)
1. User enters website URL
2. System detects PDFs automatically
3. Consent dialog appears: "Store 2 PDFs?"
4. User clicks "Yes, store them"
5. PDFs uploaded to Supabase Storage
6. Text extracted and saved
7. Available for re-analysis anytime

**Benefits:**
- ✅ PDFs stored permanently
- ✅ Can re-analyze with better AI models
- ✅ No repeated fetching from external sites
- ✅ Faster future analyses

### Workflow 2: Manual Upload
1. User goes to Step 3 (Website Helper)
2. Clicks "Upload Menu PDFs Manually"
3. Selects one or multiple PDF files
4. Files uploaded directly to storage
5. Text extracted automatically

**Benefits:**
- ✅ Works even without website URL
- ✅ Full user control
- ✅ Supports multiple uploads

### Workflow 3: Skip Storage (Quick)
1. User enters website URL
2. System detects PDFs automatically
3. Consent dialog appears
4. User clicks "Skip for now"
5. Text already extracted during analysis
6. PDFs NOT stored permanently

**Benefits:**
- ✅ Faster (no upload step)
- ✅ Privacy-conscious
- ❌ Cannot re-analyze later
- ❌ Repeated fetches if URL changes

## Security & Privacy

### Authentication
- All Edge Functions require authenticated requests
- JWT token passed in `Authorization` header
- RLS policies enforce user ownership

### Storage Permissions
- Users can only upload to their own business folders
- Folder path: `{business_id}/{type}/{filename}`
- Public read access (for displaying in UI)
- Write/delete restricted to owners

### Data Retention
- PDFs stored indefinitely (until user deletes)
- Users can delete via UI (future feature)
- Extracted text stored in database for fast access

## AI Model Integration

### Current Flow:
```
PDF → unpdf → Plain Text → OpenAI GPT-4o-mini → Structured JSON
```

### Text Processing:
```typescript
const pdfText = await extractTextFromPdf(pdfUrl)
const prompt = `
Extract menu information from this PDF text:
${pdfText}

Return JSON with:
- categories: ["Brunch", "Dinner", "Drinks"]
- signatureItems: ["Eggs Benedict", "Burger"]
- dietaryOptions: ["vegan", "gluten-free"]
`
```

### Future Enhancement:
```
PDF → Adobe API → Enhanced Text + Tables → GPT-4o → Rich JSON
```

## Cost Considerations

### Free Tier (Current)
- unpdf: Free, open-source
- OpenAI: $0.150 / 1M input tokens (gpt-4o-mini)
- Supabase Storage: 1GB free
- **Estimated cost:** ~$0.01 per analysis

### Premium Tier (Future)
- Adobe PDF Services: ~$0.05-0.10 per PDF
- OpenAI GPT-4o: $2.50 / 1M input tokens
- **Estimated cost:** ~$0.15 per analysis with OCR

## Future Enhancements

### Phase 1 (Current) ✅
- [x] URL-based PDF detection
- [x] Consent dialog UI
- [x] PDF upload to Storage
- [x] Text extraction with unpdf
- [x] Manual upload support

### Phase 2 (Planned)
- [ ] Adobe PDF Services integration
- [ ] Tier-based extraction method
- [ ] PDF preview in UI
- [ ] Re-analysis feature
- [ ] Delete stored PDFs

### Phase 3 (Advanced)
- [ ] OCR for scanned menus
- [ ] Table extraction
- [ ] Multi-language support
- [ ] Automatic menu updates (webhook)
- [ ] Version history for menus

## Testing

### Test Scenarios:
1. **Website with PDF menu link**
   - Enter URL → PDFs detected → Store → Verify storage
2. **Website without PDFs**
   - Enter URL → No consent dialog → HTML-only analysis
3. **Manual upload**
   - Skip URL → Upload PDF manually → Verify extraction
4. **Multiple PDFs**
   - Website with 3 PDFs → Store all → Check database
5. **Large PDF (>5MB)**
   - Test upload limits → Error handling

### Test URLs:
- Restaurant with PDF menu: https://example-restaurant.com
- Café with wine list PDF: https://example-cafe.dk

## Deployment

### Prerequisites:
1. Supabase project with Storage enabled
2. OpenAI API key configured
3. Database migrations applied

### Deploy Steps:
```bash
# 1. Apply database migrations
supabase db push

# 2. Deploy Edge Functions
supabase functions deploy analyze-website
supabase functions deploy upload-pdf

# 3. Set environment variables
supabase secrets set OPENAI_API_KEY=sk-...

# 4. Test locally
supabase functions serve

# 5. Deploy frontend
npm run build
```

### Environment Variables:
- `OPENAI_API_KEY` - OpenAI API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only)

## Monitoring

### Key Metrics:
- PDF upload success rate
- Text extraction errors
- Storage usage per business
- Average extraction time
- Cost per analysis

### Logging:
- All PDF operations logged with emojis (📄, ✅, ❌)
- Edge Function logs accessible via Supabase Dashboard
- Database audit trail (created_at, updated_at)

## Support

### Common Issues:

**1. "PDF extraction failed"**
- Cause: Scanned PDF without OCR
- Solution: Use Adobe PDF Services (Premium)

**2. "Upload failed"**
- Cause: File size > 50MB
- Solution: Compress PDF or split into multiple files

**3. "No PDFs detected"**
- Cause: PDFs behind authentication
- Solution: Manual upload instead

**4. "Permission denied"**
- Cause: RLS policy issue
- Solution: Check business ownership

---

## Summary

The PDF consent workflow provides a flexible, privacy-conscious approach to menu document storage:

1. **Automatic detection** - Find PDFs on business websites
2. **User consent** - Ask permission before storing
3. **Dual upload methods** - URL fetch OR manual upload
4. **Text extraction** - unpdf (free) with Adobe upgrade path
5. **Permanent storage** - Supabase Storage + metadata DB
6. **Re-analysis ready** - Stored PDFs available for future AI improvements

This architecture balances user privacy, cost efficiency, and technical flexibility.
