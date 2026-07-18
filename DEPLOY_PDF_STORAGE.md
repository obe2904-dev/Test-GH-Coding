# Quick Deployment Guide - PDF Storage System

## 1. Create Storage Bucket

**Via Supabase Dashboard**:
1. Go to Storage → Create new bucket
2. Name: `menu-files`
3. Public: **OFF** (private bucket)
4. File size limit: 50 MB
5. Allowed MIME types: `application/pdf, image/jpeg, image/png, image/webp`

**OR via SQL**:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-files',
  'menu-files',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);
```

## 2. Set Storage Policies

```sql
-- Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-files');

-- Allow authenticated reads
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'menu-files');

-- Service role full access
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'menu-files');
```

## 3. Deploy Edge Functions

```bash
cd "Test P2G 1-iCloud"

# Deploy download function
supabase functions deploy download-menu-pdf

# Deploy extract function
supabase functions deploy extract-pdf-text

# Verify deployment
supabase functions list
```

## 4. Test Deployment

```bash
# Test download function
curl -X POST https://oadwluspjlsnxhgakral.supabase.co/functions/v1/download-menu-pdf \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pdfUrl": "https://media.uheadless.com/aciiffac23/media/uyjewiys/souk-frokost-menu-summer.pdf",
    "businessId": "test-id",
    "sourceId": "test-source"
  }'
```

Expected: `{"success":true,"storagePath":"menu-pdfs/...","sizeBytes":...}`

## 5. Rebuild & Deploy Frontend

```bash
# Install dependencies (if needed)
npm install

# Build
npm run build

# Deploy to Vercel
git add .
git commit -m "Add PDF storage architecture"
git push origin main
```

## 6. Test with Real Menu

1. Open your app: https://social-media-saas-psi.vercel.app/
2. Go to Business Profile → Menus
3. Queue extraction for Souk Aarhus
4. Monitor browser console:
   ```
   📄 Detected PDF - downloading to storage first...
   ✅ PDF stored at: menu-pdfs/.../....pdf
   📝 Checking for text layer...
   ```

## Expected Results

### For Text-Layer PDFs (best case):
```
✅ Extracted 3421 chars from text layer (no OCR needed!)
→ Fast extraction (2-3 seconds)
→ No API costs
```

### For Scanned PDFs (needs work):
```
⚠️ No text layer found - will need OCR
⚠️ PDF OCR not yet implemented - need to convert PDF pages to images first
→ Extraction fails gracefully
→ TODO: Implement PDF-to-images conversion
```

## What Works Now

✅ PDF download with clean URLs  
✅ Storage in Supabase  
✅ Text layer detection  
✅ Text extraction (if layer exists)  
✅ Graceful failure for scanned PDFs  

## What's Still TODO

⚠️ PDF-to-images conversion  
⚠️ OCR on scanned PDF pages  
⚠️ Pass real businessId/sourceId (currently 'temp')  

## Troubleshooting

### "Bucket does not exist"
→ Create `menu-files` bucket in Supabase Dashboard

### "Permission denied"
→ Check RLS policies on storage.objects table

### "Failed to download PDF"
→ Check PDF URL is accessible (curl test)

### "SUPABASE_SERVICE_ROLE_KEY not found"
→ Set in Supabase Edge Functions secrets

## Files to Deploy

```
supabase/functions/
├── download-menu-pdf/
│   └── index.ts          ← NEW
├── extract-pdf-text/
│   └── index.ts          ← NEW
└── ...existing functions

src/lib/menu-extraction/strategies/
└── ImageOCRStrategy.ts   ← UPDATED
```

## Cost Impact

**Before**: ~$0.06 per scanned menu (Vision API)  
**After**: 
- Text-layer PDFs: **$0** (no API calls)
- Scanned PDFs: ~$0.06 (same, but only when needed)

**Storage**: ~$0.001 per menu stored (negligible)

## Next Session TODO

1. Implement PDF-to-images conversion (see PDF_STORAGE_ARCHITECTURE.md)
2. Add proper businessId/sourceId context passing
3. Test end-to-end with multiple PDF types
4. Add caching logic (don't re-download same PDF)
5. Implement cleanup (delete old PDFs after N days)
