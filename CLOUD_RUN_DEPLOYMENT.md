# Cloud Run Deployment Guide - Menu OCR Worker

## Prerequisites

1. Google Cloud Project with Cloud Run enabled
2. Docker CLI installed
3. `gcloud` CLI configured with your project
4. Supabase account with pgmq enabled

## Environment Setup

### 1. Enable pgmq in Supabase

Run this SQL in your Supabase SQL editor:

```sql
create extension if not exists pgmq;

-- Create the queue
select pgmq.create('menu_queue');

-- Verify it was created
select * from pgmq.q_menu_queue;
```

### 2. Deploy Schema Migrations

Run the migration SQL to create the `menu_results` table:

```bash
# Using Supabase CLI
supabase migration new setup_menu_queue
# Then copy the content of supabase/migrations/03_setup_menu_queue.sql into the new migration
supabase db push
```

Or run directly in Supabase SQL editor:
```bash
cat supabase/migrations/03_setup_menu_queue.sql | supabase sql
```

## Building & Deploying to Cloud Run

### 1. Build Docker Image

```bash
cd cloud-run-workers/menu-ocr-worker

# Build locally (optional, for testing)
docker build -t menu-ocr-worker:latest .

# Tag for Google Container Registry
docker tag menu-ocr-worker:latest gcr.io/YOUR_PROJECT_ID/menu-ocr-worker:latest
```

### 2. Push to Container Registry

```bash
# Push to GCR
docker push gcr.io/YOUR_PROJECT_ID/menu-ocr-worker:latest

# Or use gcloud build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/menu-ocr-worker:latest
```

### 3. Deploy to Cloud Run

```bash
gcloud run deploy menu-ocr-worker \
  --image gcr.io/YOUR_PROJECT_ID/menu-ocr-worker:latest \
  --platform managed \
  --region europe-west1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600s \
  --set-env-vars "SUPABASE_URL=your_supabase_url,SUPABASE_SERVICE_ROLE_KEY=your_service_role_key,OPENAI_API_KEY=your_openai_key" \
  --no-allow-unauthenticated
```

### 4. Configure Environment Variables

Create a `.env.yaml` file in Cloud Run:

```yaml
SUPABASE_URL: https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY: sk-proj-...
```

## Testing

### 1. Trigger a Menu Extraction

Call the Edge Function:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/extract-menu-pdf \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "550e8400-e29b-41d4-a716-446655440000",
    "pdfUrl": "https://example.com/menu.pdf"
  }'
```

Response:
```json
{
  "success": true,
  "resultId": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Menu extraction queued"
}
```

### 2. Check Status

Query Supabase:

```javascript
// React/JavaScript
const { data } = await supabase
  .from('menu_results')
  .select('*')
  .eq('id', resultId)
  .single()

// Status can be: queued, processing, done, error
```

### 3. Subscribe to Real-time Updates (Frontend)

```javascript
supabase
  .channel(`menu_results:id=eq.${resultId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'menu_results',
      filter: `id=eq.${resultId}`,
    },
    (payload) => {
      console.log('Update:', payload.new)
      if (payload.new.status === 'done') {
        setMenuData(payload.new.structured_data)
      }
    }
  )
  .subscribe()
```

## Monitoring

### Cloud Run Logs

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=menu-ocr-worker" --limit 50 --format json

# Or in Cloud Console: Cloud Run → menu-ocr-worker → Logs
```

### Key Metrics to Monitor

- Processing time per menu (goal: <30s for 5-page menu)
- Confidence scores (goal: >75%)
- Garbled word count (goal: <5% of extracted words)
- Error rate (goal: <5%)

## Scaling Recommendations

### Phase 1 (Initial)
- Memory: 2 GiB
- CPU: 2
- Concurrency: 1
- Max instances: 5

### Phase 2 (If needed)
- Memory: 4 GiB  
- CPU: 4
- Concurrency: 2
- Max instances: 20

## Cost Estimation

**Per menu extraction:**
- 2 GiB, 2 CPU, 20 seconds processing: ~$0.00002
- **100 menus/month: ~$0.002**
- **1000 menus/month: ~$0.02**

With Cloud Run scaling to zero, you only pay for actual processing time.

## Troubleshooting

### Worker Not Processing Jobs

1. Check pgmq queue is populated:
```sql
select * from pgmq.q_menu_queue;
```

2. Check Cloud Run logs for errors
3. Verify environment variables are set correctly
4. Check Supabase connectivity

### Memory Issues

If you see OOM errors, increase memory:

```bash
gcloud run update menu-ocr-worker --memory 4Gi --region europe-west1
```

### Tesseract Language Issues

Current setup includes Danish (`tesseract-ocr-dan`). To add more languages:

Edit `Dockerfile`:
```dockerfile
RUN apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-dan \
    tesseract-ocr-eng \
    tesseract-ocr-swe \  # Add Swedish
    ...
```

Then rebuild and redeploy.

## Next Steps

1. **Phase 1 Testing**: Run 10-20 real menus, monitor quality metrics
2. **Phase 2 Preparation**: Prepare PaddleOCR container for fallback if needed
3. **Performance Tuning**: Adjust memory/CPU based on actual metrics
4. **Web Scraping**: Deploy similar worker for URL extraction
