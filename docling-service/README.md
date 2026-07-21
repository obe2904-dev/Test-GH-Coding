# Docling Menu Extraction Service

Cloud Run service for extracting menu information from PDF documents using [Docling](https://github.com/DS4SD/docling).

## Features

- PDF text extraction with OCR support for scanned documents
- Table structure preservation for menu items
- Markdown export for structured content
- Fast API with health checks
- Optimized for Cloud Run deployment

## Deployment

### Prerequisites

- Google Cloud SDK installed and configured
- Docker installed
- GCP project with Cloud Run and Container Registry enabled

### Deploy to Cloud Run

1. Update the `PROJECT_ID` in `deploy.sh` with your GCP project ID
2. Make the script executable:
   ```bash
   chmod +x deploy.sh
   ```
3. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

### Manual Deployment

```bash
# Build and push image
docker build -t gcr.io/YOUR_PROJECT_ID/docling-menu-extractor .
docker push gcr.io/YOUR_PROJECT_ID/docling-menu-extractor

# Deploy to Cloud Run
gcloud run deploy docling-menu-extractor \
  --image gcr.io/YOUR_PROJECT_ID/docling-menu-extractor \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300
```

## API Endpoints

### Health Check
```
GET /health
```

### Extract from URL
```
POST /extract-pdf
Content-Type: application/json

{
  "url": "https://example.com/menu.pdf",
  "source_id": "optional-identifier"
}
```

### Extract from File Upload
```
POST /extract-pdf-file
Content-Type: multipart/form-data

file: [PDF file]
```

## Response Format

```json
{
  "success": true,
  "text": "Extracted plain text content...",
  "markdown": "# Extracted markdown content...",
  "metadata": {
    "pages": 5,
    "has_tables": true,
    "source_id": "optional-identifier"
  },
  "error": null
}
```

## Environment Variables

- `PORT`: Server port (default: 8080, set by Cloud Run)
- `HF_TOKEN` or `HUGGINGFACE_HUB_TOKEN`: Hugging Face access token used to download Docling models without unauthenticated rate limits
- `HF_HOME`: Cache directory for Hugging Face artifacts (default recommended: `/tmp/hf` on Cloud Run)
- `HUGGINGFACE_HUB_CACHE`: Hugging Face cache path (default recommended: `/tmp/hf/hub` on Cloud Run)

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
python main.py
```

## Integration with Supabase Edge Functions

After deployment, add the Cloud Run URL to your Supabase environment variables:

```bash
DOCLING_SERVICE_URL=https://docling-menu-extractor-xxxxx-uc.a.run.app
```

## Cost Optimization

- Service scales to zero when not in use
- 2GB memory and 2 CPU recommended for PDF processing
- Adjust `--max-instances` based on expected load
