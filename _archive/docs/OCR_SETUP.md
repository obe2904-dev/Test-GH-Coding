# OCR Setup for Image-Based PDFs

## Overview
The system now uses OCR.space API to extract text from scanned/image-based PDFs for StandardPlus and Premium tier users.

## Setup Steps

### 1. Get OCR.space API Key (Free)
1. Visit: https://ocr.space/ocrapi/freekey
2. Enter your email address
3. Check your email for the API key
4. Free tier includes: **25,000 requests/month**

### 2. Add API Key to Supabase
```bash
supabase secrets set OCR_SPACE_API_KEY='your_api_key_here'
```

### 3. Verify Setup
After setting the secret, the Edge Function will automatically use OCR for image-based PDFs.

## How It Works

### Automatic Detection Flow:
1. **Website Analysis**: Detects PDF on business website
2. **User Consent**: User approves storing PDF
3. **PDF Upload**: File uploaded to Supabase Storage
4. **Text Extraction Attempt**: unpdf tries to extract text
5. **Image Detection**: If text extraction returns empty → image-based PDF detected
6. **OCR Processing** (StandardPlus/Premium only):
   - Converts PDF to base64
   - Sends to OCR.space API
   - Extracts text (English + Danish)
   - Parses text to structured JSON menu
7. **Storage**: Stores extracted text and JSON in database
8. **Display**: Shows menu in verification frame

### Tier-Based Behavior:
- **Free**: PDF stored, no OCR (shows "image-based PDF" warning)
- **StandardPlus/Premium**: Automatic OCR extraction

## OCR.space Features
- **Languages**: English + Danish (`eng,dan`)
- **Engine**: Engine 2 (optimized for documents)
- **Orientation**: Auto-detect and correct
- **Scale**: Auto-scale for better accuracy
- **Max file size**: 1MB per request (our PDFs are typically <2MB)

## API Limits
- Free tier: 25,000 requests/month
- Rate limit: 10 requests/minute (sufficient for our use case)
- Max file size: 1MB (upgrade to paid if needed)

## Cost Estimate
- Free tier covers ~833 PDF extractions/day
- Typical restaurant: 1-2 PDFs (menu, wine list)
- Estimate: ~400-800 restaurants/day before needing paid tier

## Troubleshooting

### OCR Returns Empty Text
- PDF might be too low quality
- PDF might have security/encryption
- File might be corrupted
- Solution: User can manually enter menu items

### API Key Not Working
```bash
# Check if secret is set
supabase secrets list

# Update the secret
supabase secrets set OCR_SPACE_API_KEY='new_key_here'

# Redeploy function
supabase functions deploy upload-pdf
```

### Rate Limit Exceeded
- Free tier: 10 requests/minute
- If exceeded, wait 1 minute or upgrade to paid tier
- Paid tier: $6.99/month for 100,000 requests

## Alternative OCR Services (if needed)

### Google Cloud Vision API
- Higher accuracy (~98-99%)
- Cost: $1.50 per 1,000 pages
- Setup: More complex (requires Google Cloud account)

### Azure Computer Vision
- Similar accuracy to Google
- Cost: $1.50 per 1,000 pages
- Setup: Requires Azure account

### Tesseract.js (Client-side)
- Free and open source
- Slower (~5-10 seconds/page)
- Lower accuracy (~85-95%)
- Runs in browser (no API needed)

## Current Status
✅ Edge Function deployed with OCR support
✅ CORS headers configured
✅ Error handling implemented
✅ Tier-based access control
⚠️ Need to add OCR_SPACE_API_KEY secret

## Next Steps
1. Get OCR.space API key from https://ocr.space/ocrapi/freekey
2. Set the secret: `supabase secrets set OCR_SPACE_API_KEY='your_key'`
3. Test with a scanned menu PDF
4. Verify extraction in Step 3 verification frame
