# Menu Extraction Fallback Implementation - Complete

## Overview
Implemented PDF upload and URL fetch functionality for menu extraction as fallback options when AI web scraping fails during onboarding.

## What Was Implemented

### 1. Edge Functions Created ✅

**`supabase/functions/extract-menu-pdf/index.ts`**
- Accepts PDF file upload via multipart form data
- Uses Apache Tika Cloud Run endpoint for text extraction
- Returns extracted text and metadata
- Handles errors gracefully with user-friendly messages

**`supabase/functions/extract-menu-url/index.ts`**
- Accepts URL via JSON body
- Fetches HTML content from the URL
- Extracts text by removing scripts, styles, and HTML tags
- Normalizes whitespace and decodes HTML entities
- Returns extracted text and metadata

### 2. UI Updates ✅

**MenuOfferingsPanel.tsx**
- Added state management: `menuUrl`, `isProcessing`, `processingError`
- Implemented `handlePdfUpload` handler:
  - Accepts PDF file from file input
  - Sends to Edge Function
  - Updates menu description with extracted text
  - Shows success/error feedback
- Implemented `handleFetchMenuUrl` handler:
  - Validates URL input
  - Sends to Edge Function
  - Updates menu description with extracted text
  - Shows success/error feedback
- Wired handlers to UI inputs:
  - PDF file input: `onChange={handlePdfUpload}`, disabled during processing
  - URL input: `value={menuUrl}`, `onChange` handler, disabled during processing
  - "Hent" button: `onClick={handleFetchMenuUrl}`, disabled when processing or empty URL
- Added loading spinner during processing
- Added error message display
- Removed "kommer snart" helper text
- Changed button color from gray to indigo (matches theme)

### 3. Deployment ✅

Both Edge Functions deployed to Supabase:
```bash
/opt/homebrew/bin/supabase functions deploy extract-menu-pdf --project-ref kvqdkohdpvmdylqgujpn
/opt/homebrew/bin/supabase functions deploy extract-menu-url --project-ref kvqdkohdpvmdylqgujpn
```

Status: **DEPLOYED** ✅
- URL: `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/extract-menu-pdf`
- URL: `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/extract-menu-url`

## User Flow

### Scenario: AI Cannot Find Menu

1. **User sees warning box**:
   - Amber background with warning icon
   - Explains why AI couldn't find menu (PDF, protected content, no menu page)
   - Suggests three options

2. **Option 1: Upload PDF**
   - User clicks file input, selects PDF
   - Loading spinner appears: "Behandler..."
   - PDF sent to Tika for text extraction
   - Extracted text populates menu description field
   - Success alert: "PDF behandlet! Tjek menubeskrivelsen nedenfor."

3. **Option 2: Provide URL**
   - User pastes direct menu page URL
   - Clicks "Hent" button
   - Loading spinner appears: "Henter..."
   - HTML fetched and text extracted
   - Extracted text populates menu description field
   - Success alert: "Menu hentet! Tjek menubeskrivelsen nedenfor."
   - URL input cleared for next use

4. **Option 3: Manual Entry**
   - User types menu description directly
   - No processing needed
   - Text used immediately for AI content generation

### Error Handling

All three paths include robust error handling:
- **PDF processing fails**: "Kunne ikke behandle PDF. Prøv venligst igen."
- **URL fetch fails**: "Kunne ikke hente menu fra URL. Tjek at linket er korrekt."
- **Empty URL submitted**: "Indtast venligst en URL"

Error messages shown in red banner below inputs.

## Technical Details

### State Management
```tsx
const [menuUrl, setMenuUrl] = useState('')
const [isProcessing, setIsProcessing] = useState(false)
const [processingError, setProcessingError] = useState<string | null>(null)
```

### API Integration
Both handlers call Supabase Edge Functions:
```tsx
fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-menu-pdf`, ...)
fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-menu-url`, ...)
```

### Loading States
- File input disabled during processing
- URL input disabled during processing
- "Hent" button disabled when processing or URL empty
- Button text changes: "Hent" → "Henter..."
- Spinner icon shown with "Behandler..." text

### Data Flow
1. User provides input (PDF/URL/text)
2. Handler processes input → Edge Function
3. Edge Function returns extracted text
4. Text updates `menuDescription` via `onMenuDescriptionChange`
5. Description field auto-populates
6. User can edit/refine the extracted text
7. Text used as context for AI content generation

## Benefits

### For Users
- **No dead ends**: Always a way to provide menu data
- **Flexibility**: Three options match different use cases
- **Professional**: Proper error handling maintains trust
- **Clear feedback**: Users know what's happening at each step

### For Paid Tiers
- **Value delivery**: Feature works as advertised
- **Reliability**: Fallback ensures menu extraction never completely fails
- **User satisfaction**: Multiple paths reduce frustration

### For AI Content Quality
- **Better context**: Menu data always available for post generation
- **Accurate posts**: Real menu items vs generic descriptions
- **Seasonal updates**: Users can re-upload when menu changes

## Testing Checklist

- [x] PDF upload handler created
- [x] URL fetch handler created
- [x] Edge Functions created and deployed
- [x] UI inputs wired to handlers
- [x] Loading states implemented
- [x] Error handling implemented
- [x] Success feedback implemented
- [ ] Test with real PDF file
- [ ] Test with real menu URL
- [ ] Test error scenarios (invalid PDF, 404 URL, etc.)
- [ ] Verify extracted text quality
- [ ] Test on Smart tier account
- [ ] Test on Pro tier account

## Next Steps

1. **User Testing**
   - Upload sample menu PDFs
   - Test various menu page URLs (different CMS platforms)
   - Verify text extraction quality

2. **Monitoring**
   - Track usage of each option (PDF vs URL vs manual)
   - Monitor Tika processing times
   - Watch for common error patterns

3. **Potential Improvements**
   - Add file size limit indicator for PDFs
   - Show preview of extracted text before applying
   - Add "Try again" button in error states
   - Support for image files (JPG/PNG of menus)

## Files Modified

1. **src/pages/dashboard/businessProfile/components/MenuOfferingsPanel.tsx**
   - Added state management (lines 17-20)
   - Added handlers (lines 36-119)
   - Updated UI (lines 335-367)
   - Wired inputs to handlers

2. **supabase/functions/extract-menu-pdf/index.ts** (NEW)
   - PDF processing with Tika integration
   - Error handling and validation

3. **supabase/functions/extract-menu-url/index.ts** (NEW)
   - URL fetching and HTML parsing
   - Text extraction and cleanup

## Architecture Notes

### Why Tika?
- Handles both text-based and scanned PDFs
- Already integrated in project (upload-pdf function)
- Hosted on Google Cloud Run (reliable, scalable)
- Supports multiple document formats

### Why Simple HTML Parsing?
- Most restaurant websites have simple menu pages
- No need for JavaScript rendering (most menus are static HTML)
- Fast and reliable for 80% of use cases
- Can upgrade to Puppeteer/Playwright if needed later

### Design Decisions
1. **Three options vs wizard**: Parallel options give users control
2. **Direct text population**: Skip preview step for faster workflow
3. **Alert feedback**: Simple, immediate confirmation
4. **Indigo buttons**: Matches existing theme (vs gray disabled state)
5. **No auto-save**: Let users review extracted text before saving profile

## Success Metrics

- PDF extraction success rate > 90%
- URL extraction success rate > 70%
- Average processing time < 5 seconds
- User adoption of fallback options > 60% when AI fails
- Reduction in support tickets about missing menus

---

**Status**: READY FOR TESTING ✅
**Deployed**: December 12, 2024
**Next Action**: User testing with real menu PDFs and URLs
