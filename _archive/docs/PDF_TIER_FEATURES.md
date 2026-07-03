# PDF Extraction: Tier-Based Features

## Overview
The PDF storage system now uses **tier-based extraction methods** to provide enhanced accuracy for Premium subscribers.

## Tier Comparison

### 🆓 Free Tier
- **Extraction Method:** unpdf (basic text extraction)
- **Best For:** Digital PDFs with clean text
- **Accuracy:** Good for standard PDFs
- **Cost:** Free
- **Features:**
  - Extracts plain text from PDFs
  - Works with most digital PDFs
  - Fast processing

### ⭐ Standard Plus
- **Extraction Method:** unpdf (basic text extraction)
- **Best For:** Digital PDFs with clean text
- **Accuracy:** Good for standard PDFs
- **Cost:** Included in Standard Plus plan
- **Features:**
  - Same as Free tier
  - More storage capacity

### 💎 Premium Tier
- **Extraction Method:** GPT-4 Vision (AI-powered)
- **Best For:** Complex layouts, scanned menus, image-based PDFs
- **Accuracy:** Excellent for all PDF types
- **Cost:** ~$0.01 per page (included in Premium plan)
- **Features:**
  - AI understands visual layout
  - Extracts text from images and scans
  - Recognizes table structures
  - Handles handwritten notes
  - Context-aware extraction
  - Better formatting preservation

## How It Works

### Automatic Tier Detection
```typescript
// Frontend passes user's tier to upload function
body: {
  pdfUrl: 'https://restaurant.com/menu.pdf',
  fileName: 'menu.pdf',
  businessId: '...',
  pdfType: 'menu',
  userTier: 'premium'  // 'free', 'standardplus', or 'premium'
}
```

### Backend Processing
```typescript
// Edge Function selects extraction method based on tier
if (userTier === 'premium') {
  // Use GPT-4 Vision for enhanced extraction
  extractedText = await extractWithVision(pdfBuffer)
} else {
  // Free & Standard Plus: use unpdf
  const pdf = await getDocumentProxy(pdfBuffer)
  const { text } = await extractText(pdf, { mergePages: true })
}
```

## GPT-4 Vision Advantages

### Better Understanding
- Recognizes visual hierarchy (headers, sections, prices)
- Understands context (menu items vs descriptions vs prices)
- Handles multi-column layouts

### Scanned Document Support
- OCR capability for image-based PDFs
- Works with photos of physical menus
- Handles low-quality scans

### Structured Extraction
- Preserves formatting and organization
- Groups related information
- Maintains menu structure

## Use Cases by Tier

### Free/Standard Plus (unpdf)
✅ Perfect for:
- Digital PDFs created from Word/InDesign
- Clean, text-based documents
- Modern websites with downloadable PDFs
- Quick extraction needs

### Premium (GPT-4 Vision)
✅ Perfect for:
- Scanned physical menus
- Image-heavy PDFs
- Complex table layouts
- Wine lists with detailed descriptions
- Multi-language menus
- Handwritten or stylized text
- Old or low-quality scans

## Pricing Breakdown

### Premium Tier Cost Example
For a 10-page restaurant menu:
- GPT-4 Vision cost: ~$0.10 total
- Storage: Included in Premium plan
- Total: Minimal per-document cost

### ROI for Premium Users
- Better extraction = Better AI posts
- Time saved on manual corrections
- Works with any menu format
- Higher quality content generation

## Testing the Feature

### Test as Free User
1. Switch tier toggle to "Free" in sidebar
2. Upload a PDF menu
3. Check console: "User tier: free (unpdf)"
4. Review extracted text in database

### Test as Premium User
1. Switch tier toggle to "Premium" in sidebar
2. Upload the same PDF menu
3. Check console: "User tier: premium (GPT-4 Vision enabled)"
4. Compare extracted text quality

### Verify in Console
```
🎯 User tier: premium (GPT-4 Vision enabled)
📤 Uploading PDFs to storage... 1
🤖 Calling GPT-4 Vision for PDF analysis...
✅ Vision extraction successful
✅ Uploaded PDF: menu.pdf
```

## Fallback Strategy

Premium tier includes automatic fallback:
```typescript
try {
  // Try GPT-4 Vision first
  extractedText = await extractWithVision(pdfBuffer)
} catch (visionError) {
  // Fallback to unpdf if Vision fails
  const pdf = await getDocumentProxy(pdfBuffer)
  const { text } = await extractText(pdf, { mergePages: true })
}
```

This ensures Premium users always get results, even if Vision API is temporarily unavailable.

## Future Enhancements

### Planned Features
- [ ] Preview extracted text before saving
- [ ] Side-by-side comparison (unpdf vs Vision)
- [ ] Manual correction interface
- [ ] Re-extract button with tier upgrade
- [ ] Extraction quality score

### Potential Upgrades
- Adobe PDF Services for table extraction
- Custom OCR training for specific restaurant styles
- Multi-language optimization
- Batch processing discounts

## Configuration

### Environment Variables Required
```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Edge Function (Supabase Dashboard)
OPENAI_API_KEY=sk-...  # Required for Premium tier Vision
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Deployment Status
- ✅ Edge Function deployed: `upload-pdf`
- ✅ Frontend updated with tier detection
- ✅ Database schema ready
- ✅ Storage bucket configured

## Summary

**The tier-based PDF extraction is now live!** Premium users automatically get enhanced extraction with GPT-4 Vision, while Free and Standard Plus users get reliable extraction with unpdf. The system intelligently selects the best method based on the user's subscription tier.
