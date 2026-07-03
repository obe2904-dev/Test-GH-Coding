# Website Analyzer Worker

Cloud Run worker that analyzes business websites and generates brand profiles.

## 🎯 What It Does

1. **Fetches** business website content
2. **Extracts** text and metadata from HTML
3. **Analyzes** content using GPT-4o to extract:
   - Business name & type
   - Descriptions
   - Services & specialties
   - Contact information
   - Brand tone
4. **Generates** comprehensive brand profile
5. **Updates** business profile in database

## 📁 Structure

```
website-analyzer-worker/
├── main.py                      # Flask app & entry point
├── config.py                    # Configuration
├── worker.py                    # Main worker logic
├── analyzers/
│   └── content_analyzer.py     # AI-based content analysis
├── utils/
│   ├── helpers.py              # Helper functions
│   └── web_fetcher.py          # Web content fetching
├── requirements.txt
├── Dockerfile
└── README.md
```

## 🚀 Deployment

### Prerequisites

Same credentials as menu-ocr-worker:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

### Deploy to Cloud Run

```bash
cd cloud-run-workers/website-analyzer-worker

gcloud run deploy website-analyzer-worker \
  --source . \
  --region europe-west1 \
  --project aigetmenu \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars="SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_KEY},OPENAI_API_KEY=${OPENAI_KEY},WORKER_BACKGROUND_POLL_ENABLED=false"
```

## 📊 Database Setup

Run this SQL in Supabase:

```sql
-- Create jobs table
CREATE TABLE IF NOT EXISTS public.website_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'error')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_website_jobs_status ON website_analysis_jobs(status, created_at);
CREATE INDEX idx_website_jobs_business ON website_analysis_jobs(business_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE website_analysis_jobs;

-- Create RPC for atomic job claiming
CREATE OR REPLACE FUNCTION claim_website_analysis_job()
RETURNS SETOF website_analysis_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_job website_analysis_jobs;
BEGIN
  SELECT * INTO claimed_job
  FROM website_analysis_jobs
  WHERE status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed_job.id IS NOT NULL THEN
    UPDATE website_analysis_jobs
    SET status = 'processing',
        claimed_at = NOW()
    WHERE id = claimed_job.id;
    
    RETURN QUERY SELECT * FROM website_analysis_jobs WHERE id = claimed_job.id;
  END IF;
  
  RETURN;
END;
$$;

-- Create RPC for requeuing stale jobs
CREATE OR REPLACE FUNCTION requeue_stale_website_jobs(max_age_minutes INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  requeued_count INT;
BEGIN
  UPDATE website_analysis_jobs
  SET status = 'queued',
      claimed_at = NULL
  WHERE status = 'processing'
    AND claimed_at < NOW() - (max_age_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS requeued_count = ROW_COUNT;
  RETURN requeued_count;
END;
$$;
```

## 🔌 Frontend Integration

### Queue Analysis Job

```typescript
// Edge Function: queue-website-analysis
const { data, error } = await supabase
  .from('website_analysis_jobs')
  .insert({
    business_id: businessId,
    website_url: url,
    status: 'queued'
  })
  .select()
  .single()

return { jobId: data.id }
```

### Monitor Progress

```typescript
// Subscribe to realtime updates
const subscription = supabase
  .channel(`website_job:${jobId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'website_analysis_jobs',
      filter: `id=eq.${jobId}`
    },
    (payload) => {
      if (payload.new.status === 'done') {
        console.log('Analysis complete:', payload.new.result)
        // Update UI with analysis results
      } else if (payload.new.status === 'error') {
        console.error('Analysis failed:', payload.new.error_message)
      }
    }
  )
  .subscribe()

// Or poll
const { data } = await supabase
  .from('website_analysis_jobs')
  .select('*')
  .eq('id', jobId)
  .single()
```

## ⚙️ Configuration

Environment variables:

```bash
# Required (reuse from menu-ocr-worker)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=

# Optional
WORKER_BACKGROUND_POLL_ENABLED=true
FETCH_TIMEOUT_SECONDS=25
MAX_CONTENT_SIZE_MB=10
STALE_JOB_MINUTES=12
GPT_MODEL=gpt-4o-mini
GPT_FALLBACK_MODEL=gpt-4o
MAX_AI_RETRIES=2
```

## 🧪 Testing

```bash
# Test locally
export SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."
export OPENAI_API_KEY="..."
python main.py

# Health check
curl http://localhost:8080/health

# Trigger manual job
curl -X POST http://localhost:8080/run-once
```

## 📦 Output Structure

The worker produces:

```json
{
  "website_url": "https://example.com",
  "analysis": {
    "business_name": "Company Name",
    "business_type": "restaurant",
    "short_description": "...",
    "long_description": "...",
    "services": ["..."],
    "specialties": ["..."],
    "contact": {...},
    "keywords": ["..."]
  },
  "brand_profile": {
    "brand_voice": {...},
    "visual_identity": {...},
    "content_strategy": {...},
    "target_segments": [...]
  },
  "metadata": {
    "title": "...",
    "description": "..."
  },
  "analyzed_at": "2025-12-21T..."
}
```

## 🔄 Same Pattern as Menu Worker

This worker follows the exact same architecture as `menu-ocr-worker`:
- ✅ Modular structure
- ✅ Queue-based processing
- ✅ Realtime updates
- ✅ Automatic retries
- ✅ Stale job handling
- ✅ Health checks
