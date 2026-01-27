# Quick Reference - Menu OCR Worker

## 🚀 Quick Start

```bash
# Install dependencies
cd cloud-run-workers/menu-ocr-worker
pip install -r requirements.txt

# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
export OPENAI_API_KEY="sk-..."

# Run worker
python3 main.py
```

## 📁 Where to Find Things

| Task | File |
|------|------|
| Add environment variable | `config.py` |
| Change extraction logic | `extractors/pdf_extractor.py` or `vision_extractor.py` |
| Modify parsing prompts | `parsers/menu_parser.py` |
| Update text cleaning | `utils/text_processing.py` |
| Change storage behavior | `utils/storage.py` |
| Add Danish corrections | `utils/corrections.py` |
| Modify job processing | `worker.py` |
| Change Flask routes | `main.py` |

## 🔍 Common Tasks

### Add New PDF Extractor
```python
# Create: extractors/new_extractor.py
def extract_with_new_method(pdf_content: bytes) -> tuple[str, dict]:
    """Extract text using new method."""
    # Your logic here
    return text, metrics

# Use in: worker.py
from extractors.new_extractor import extract_with_new_method
```

### Add Language Support
```python
# 1. Update: utils/text_processing.py
def normalize_language_code(code):
    if code == "fr":  # Add French
        return "fr"
    # ...

# 2. Update: parsers/menu_parser.py
if language_code == "fr":
    system_prompt = "French menu extraction prompt..."
```

### Change Vision Model
```python
# Edit: config.py
GPT52_MODEL = os.getenv("GPT52_MODEL", "gpt-4o")  # Change from gpt-5.2
```

### Add Custom OCR Corrections
```python
# Edit: utils/corrections.py
DANISH_OCR_CORRECTIONS = {
    'wrong': 'correct',
    'æble': 'æble',  # Add more
}
```

## 🧪 Testing Individual Modules

```python
# Test PDF extraction
from extractors.pdf_extractor import extract_text_digital
with open('sample.pdf', 'rb') as f:
    text, metrics = extract_text_digital(f.read(), max_pages=5)
    print(f"Extracted {metrics['char_count']} chars")

# Test menu parsing
from parsers.menu_parser import parse_menu_with_llm
menu = parse_menu_with_llm("Sample menu text", "da", "gpt-4o-mini")
print(f"Found {len(menu['categories'])} categories")

# Test storage
from utils.storage import storage_upload_public
url = storage_upload_public("bucket", "test.pdf", b"content")
print(f"Uploaded to {url}")
```

## ⚙️ Configuration

### Core Settings
```bash
SUPABASE_URL=                      # Required
SUPABASE_SERVICE_ROLE_KEY=         # Required
OPENAI_API_KEY=                    # Required
```

### Worker Behavior
```bash
WORKER_BACKGROUND_POLL_ENABLED=true    # Auto-poll queue
WORKER_TRIGGER_TOKEN=                  # Protect /run-once endpoint
STALE_JOB_MINUTES=12                   # Requeue threshold
```

### Extraction
```bash
MAX_PAGES_TO_PROCESS=12                # Max PDF pages
MIN_CHARS_PER_PAGE_FOR_DIGITAL=250     # Digital PDF threshold
MIN_TOTAL_CHARS_FOR_DIGITAL=800        # Digital PDF total threshold
MAX_LLM_CHARS=18000                    # Max text to LLM
```

### Vision
```bash
GPT52_VISION_ENABLED=true              # Enable vision extraction
GPT52_MODEL=gpt-5.2                    # Vision model
GPT52_MAX_PAGES=4                      # Max pages to render
GPT52_MAX_IMAGE_WIDTH=1400             # Image size limit
HARD_PDF_SKIP_OCR=true                 # Skip OCR for hard PDFs
```

### OCR
```bash
DOCAI_ENABLED=true                     # Enable Document AI
DOCAI_PROCESSOR_ID=                    # GCP Document AI processor
DOCAI_LOCATION=                        # GCP location
GOOGLE_CLOUD_PROJECT=                  # GCP project
TESSERACT_ZOOM=1.5                     # Tesseract image zoom
```

## 📊 Monitoring

### Check Health
```bash
curl http://localhost:8080/health
```

### Trigger Manual Job
```bash
curl -X POST http://localhost:8080/run-once \
  -H "x-worker-token: your-token"
```

### View Logs
```bash
# Local
tail -f logs/worker.log

# Cloud Run
gcloud run services logs read menu-ocr-worker-v2 \
  --region europe-west1 \
  --project aigetmenu
```

## 🐛 Debugging

### Check Module Imports
```bash
python3 -c "import config; print('Config OK')"
python3 -c "import worker; print('Worker OK')"
python3 -c "from extractors import pdf_extractor; print('Extractors OK')"
```

### Test Database Connection
```python
from config import supabase
result = supabase.table('menu_results_v2').select('*').limit(1).execute()
print(f"Connected: {len(result.data)} rows")
```

### Check OpenAI API
```python
from openai import OpenAI
from config import OPENAI_API_KEY
client = OpenAI(api_key=OPENAI_API_KEY)
# Should not error if key is valid
```

## 📦 Deployment

### Build & Deploy
```bash
cd cloud-run-workers/menu-ocr-worker

# Deploy to Cloud Run
gcloud run deploy menu-ocr-worker-v2 \
  --source . \
  --region europe-west1 \
  --project aigetmenu \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars="SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...,OPENAI_API_KEY=..."
```

### Update Just Code
```bash
# Changes are automatically picked up on redeploy
gcloud run deploy menu-ocr-worker-v2 --source .
```

## 🔄 Rollback

```bash
# If new version has issues, rollback
gcloud run services update-traffic menu-ocr-worker-v2 \
  --to-revisions REVISION-ID=100 \
  --region europe-west1

# Or restore old code
mv main_old.py main.py
gcloud run deploy menu-ocr-worker-v2 --source .
```

## 📝 File Sizes Reference

| File | Lines | Purpose |
|------|-------|---------|
| main.py | 113 | HTTP server |
| config.py | 88 | Configuration |
| worker.py | 399 | Main logic |
| extractors/pdf_extractor.py | 186 | PDF extraction |
| extractors/vision_extractor.py | 176 | Vision extraction |
| utils/text_processing.py | 179 | Text utils |
| parsers/menu_parser.py | 131 | Menu parsing |
| utils/storage.py | 52 | Storage |
| utils/corrections.py | 33 | Corrections |

**Total: 1,373 lines** (vs 1,347 in original monolith)
