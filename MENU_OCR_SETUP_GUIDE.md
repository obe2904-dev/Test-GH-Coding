# Menu OCR System - Setup & Testing Guide

## Overview

The **ImageOCR Strategy** handles scanned PDFs and menu images using Google Vision API for text extraction and GPT-4o for structured parsing. This is essential for Danish F&B sites where ~40% use scanned menus.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Menu Discovery (Cloud Run Scraper)                        │
│    - Detects image galleries, scanned PDFs                   │
│    - Returns structure: 'image_gallery', extractionMethod: 'ocr_required' │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 2. Extraction Orchestrator (Frontend)                        │
│    - Receives menu_discovery data                            │
│    - Routes to ImageOCRStrategy when OCR required            │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 3. ImageOCRStrategy                                           │
│    - Extracts image URLs from menu_discovery                 │
│    - Calls ocr-menu Edge Function for each image             │
│    - Combines OCR text from all images                       │
│    - Sends to GPT-4o for structured extraction               │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 4. ocr-menu Edge Function (Supabase)                         │
│    - Fetches image from URL                                  │
│    - Converts to base64                                      │
│    - Calls Google Vision API DOCUMENT_TEXT_DETECTION         │
│    - Returns extracted text + confidence                     │
└─────────────────────────────────────────────────────────────┘
```

## Google Vision API Setup

### 1. Enable Google Cloud Vision API

```bash
# 1. Go to Google Cloud Console
https://console.cloud.google.com/

# 2. Create/select a project

# 3. Enable Cloud Vision API
https://console.cloud.google.com/apis/library/vision.googleapis.com

# 4. Create API Key
# Navigation: APIs & Services → Credentials → Create Credentials → API Key
```

### 2. Configure Supabase Edge Function

```bash
# Set the API key in Supabase secrets
supabase secrets set GOOGLE_VISION_API_KEY=your-api-key-here

# Or via Supabase Dashboard:
# Project Settings → Edge Functions → Secrets
```

### 3. Verify Configuration

```bash
# Test the ocr-menu function directly
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/ocr-menu \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/menu.jpg"
  }'

# Expected response:
{
  "success": true,
  "text": "Extracted menu text...",
  "confidence": 0.95,
  "imageUrl": "https://example.com/menu.jpg"
}
```

## Testing with Souk Aarhus

### Test Case: https://soukaarhus.dk/menu

This restaurant uses **image gallery** menus, perfect for testing the OCR system.

### Expected Flow

1. **Menu Discovery** detects image gallery:
   ```javascript
   {
     structure: 'image_gallery',
     confidence: 'high',
     extractionMethod: 'ocr_required',
     assets: {
       displayedImages: [
         { url: 'https://...', alt: 'Menu', width: 800, height: 1200 }
       ]
     }
   }
   ```

2. **ImageOCRStrategy** is selected:
   ```
   ✅ ImageOCRStrategy selected: menu_discovery indicates OCR required
   ```

3. **OCR extraction** processes each image:
   ```
   🖼️ Found 2 menu images for OCR
   🔍 Performing OCR on: https://...
   📝 OCR extracted 3421 characters
   ```

4. **GPT-4o extraction** structures the menu:
   ```
   ✅ Extracted 8 categories with 47 items
   ```

### Manual Testing Steps

1. **Open Business Profile Dashboard**
   - Navigate to business profile for a test restaurant
   - Or create new business with URL: https://soukaarhus.dk/menu

2. **Queue Menu Extraction**
   ```typescript
   // In MenuExtractionCard.tsx or similar component
   await menuExtractionService.extractMenu({
     businessId: 'uuid',
     sourceId: 'uuid',
     sourceUrl: 'https://soukaarhus.dk/menu',
     supabaseUrl: VITE_SUPABASE_URL,
     supabaseKey: VITE_SUPABASE_ANON_KEY,
   });
   ```

3. **Monitor Console Logs**
   Look for these key indicators:
   ```
   ✅ ImageOCRStrategy selected: menu_discovery indicates OCR required
   🔍 Extracting image URLs from menu_discovery...
   📊 Found 1 menu_discovery entries
   🎯 Total unique image URLs: 2
   🔍 Performing OCR on: https://...
   OCR extracted 3421 characters with 95.3% confidence
   ```

4. **Check Results**
   - Menu items should appear in the UI
   - Verify Danish names are preserved
   - Check that prices are extracted correctly

## Troubleshooting

### Error: "GOOGLE_VISION_API_KEY not configured"

**Cause**: API key not set in Supabase secrets

**Fix**:
```bash
supabase secrets set GOOGLE_VISION_API_KEY=your-key-here
```

### Error: "No menu images found"

**Cause**: Menu discovery didn't detect images, or sourceType not set correctly

**Debug**:
1. Check scraper response:
   ```javascript
   console.log('Scraper menu_discovery:', scraperData.menu_discovery);
   ```

2. Verify menu_discovery structure:
   ```javascript
   {
     structure: 'image_gallery',  // Must be this
     assets: {
       displayedImages: [...],    // Must have images
     }
   }
   ```

3. Check ImageOCRStrategy logs:
   ```
   🔍 ImageOCRStrategy.canHandle: { sourceType: 'html_inline', ... }
   ```

**Fix**: Update menu-discovery.js in cloud-run-scraper to better detect menu images

### Error: "OCR failed for all images"

**Cause**: Google Vision API errors (quota, auth, invalid image)

**Debug**:
1. Check Vision API response:
   ```javascript
   // In ocr-menu/index.ts
   console.log('Vision API response:', visionData);
   ```

2. Verify image URLs are accessible:
   ```bash
   curl -I https://image-url.jpg
   # Should return 200 OK
   ```

3. Check Google Cloud quotas:
   ```
   https://console.cloud.google.com/apis/api/vision.googleapis.com/quotas
   ```

**Fix**:
- Increase Vision API quotas
- Verify API key permissions
- Check if images are behind authentication

### Error: "No viable menu found in OCR text"

**Cause**: OCR text quality too low, or GPT-4o couldn't parse it

**Debug**:
1. Inspect OCR text:
   ```javascript
   console.log('Combined OCR text:', combinedText.substring(0, 500));
   ```

2. Check OCR confidence:
   ```
   OCR extracted 3421 characters with 45.2% confidence  // Too low!
   ```

3. Verify GPT-4o response:
   ```javascript
   console.log('GPT-4o response:', parsed);
   ```

**Fix**:
- Improve image quality (higher resolution)
- Add Danish language hints to Vision API (already done: `languageHints: ['da', 'en']`)
- Enhance GPT-4o prompt to handle OCR errors

### ImageOCRStrategy Not Selected

**Symptoms**: Other strategies run, but ImageOCRStrategy is skipped

**Debug**:
1. Check canHandle logs:
   ```
   🔍 ImageOCRStrategy.canHandle: { sourceType: 'html_inline', hasMenuDiscovery: false }
   ❌ ImageOCRStrategy not applicable for this source
   ```

2. Verify sourceType is set correctly:
   ```javascript
   // Should be 'image_gallery' for image menus
   const sourceType = determineSourceType(scraperData, url);
   ```

**Fix**:
- Update `determineSourceType()` in menuExtractionService.ts
- Ensure scraper returns `structure_type: 'image_gallery'`

## Environment Variables

### Required

```bash
# .env or Supabase Secrets
GOOGLE_VISION_API_KEY=your-google-vision-api-key
VITE_OPENAI_API_KEY=your-openai-api-key  # For GPT-4o parsing

# Supabase (already configured)
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

### Optional

```bash
# Increase timeout for large images
VISION_API_TIMEOUT_MS=30000  # Default: 10000
```

## API Costs

### Google Vision API
- **Document Text Detection**: $1.50 per 1,000 images
- **Free tier**: 1,000 units/month
- **Typical menu**: 2-4 images = $0.003-$0.006 per menu

### OpenAI GPT-4o
- **Input**: $2.50 per 1M tokens
- **Output**: $10.00 per 1M tokens
- **Typical menu**: ~5,000 tokens = $0.01-$0.05 per menu

### Total Cost per Menu Extraction
**~$0.01-$0.06 per menu** (very affordable for 40% of F&B sites)

## Performance

- **Average time per image OCR**: 2-3 seconds
- **GPT-4o parsing**: 3-5 seconds
- **Total for 2-image menu**: 8-12 seconds

## Strategy Priority

ImageOCRStrategy has **high priority** in the cascade:

```typescript
// ExtractionOrchestrator.ts
this.strategies = [
  new StructuredJSONStrategy(),        // Priority 1 (instant)
  new ImageOCRStrategy(...),           // Priority 2 (8-12s)
  new PDFTextStrategy(),               // Priority 3
  new SemanticDOMStrategy(),           // Priority 4
];
```

This ensures scanned menus are handled efficiently before falling back to less accurate strategies.

## Future Enhancements

### 1. PDF OCR Support
Currently only handles direct image URLs. Add support for scanned PDFs:
- Use pdf-lib to extract images from PDF
- Run OCR on each page
- Combine results

### 2. OCR Caching
Cache OCR results to avoid re-processing same images:
```sql
CREATE TABLE ocr_cache (
  image_url TEXT PRIMARY KEY,
  extracted_text TEXT,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Multi-language Support
Expand beyond Danish/English:
```typescript
languageHints: detectLanguage(url) // Auto-detect from domain
```

### 4. OCR Quality Scoring
Add quality metrics to guide strategy selection:
```typescript
{
  ocrConfidence: 0.95,
  textDensity: 0.8,
  languageConfidence: 0.9
}
```

## References

- **Google Vision API Docs**: https://cloud.google.com/vision/docs/ocr
- **Vision API Pricing**: https://cloud.google.com/vision/pricing
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **ImageOCRStrategy Code**: `src/lib/menu-extraction/strategies/ImageOCRStrategy.ts`
- **OCR Edge Function**: `supabase/functions/ocr-menu/index.ts`

## Support

For issues with OCR extraction:
1. Check console logs for detailed diagnostics
2. Verify Google Vision API key in Supabase secrets
3. Test with sample images first
4. Review error analysis document: `menu-extraction-v2-error-analysis.md`
