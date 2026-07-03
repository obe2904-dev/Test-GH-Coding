# Menu OCR Worker - Refactored Structure

This worker processes menu extraction jobs from Supabase, handling PDFs and HTML pages with intelligent text extraction and LLM-based parsing.

## 📁 Project Structure

```
cloud-run-workers/menu-ocr-worker/
├── main.py                    # Flask app & entry point (~100 lines)
├── config.py                  # Environment variables & configuration (~90 lines)
├── worker.py                  # MenuOCRWorker class (~300 lines)
│
├── utils/                     # Utility modules
│   ├── __init__.py
│   ├── text_processing.py    # Text cleaning & compression (~170 lines)
│   ├── corrections.py         # Danish OCR corrections (~30 lines)
│   ├── storage.py             # Supabase storage helpers (~50 lines)
│   └── helpers.py             # General utilities (~15 lines)
│
├── extractors/                # Extraction modules
│   ├── __init__.py
│   ├── pdf_extractor.py      # PDF text extraction (~150 lines)
│   └── vision_extractor.py   # GPT-4/5 vision extraction (~130 lines)
│
├── parsers/                   # Parsing modules
│   ├── __init__.py
│   └── menu_parser.py        # LLM menu parsing (~100 lines)
│
├── requirements.txt
├── Dockerfile
└── main_old.py               # Original 1348-line file (backup)
```

## 🎯 Key Features

### Modular Architecture
- **Separation of concerns**: Each module has a single responsibility
- **Easy testing**: Modules can be tested independently
- **Better maintainability**: ~150 lines per file (vs 1348 in original)
- **Reusability**: Extractors and parsers can be used elsewhere

### Smart Extraction Strategy
1. **Digital PDFs**: Fast PyMuPDF text extraction
2. **Scanned PDFs**: GPT-4o/5.2 vision or Document AI OCR
3. **HTML pages**: Direct text extraction with boilerplate filtering

### Cost Optimization
- **Staged extraction**: Try cheap methods first
- **Text compression**: Remove boilerplate before LLM parsing
- **Model escalation**: gpt-4o-mini → gpt-4o → gpt-5.2 vision

## 🚀 Usage

### Running Locally
```bash
cd cloud-run-workers/menu-ocr-worker
export SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
export OPENAI_API_KEY="your-key"
python main.py
```

### Deploying to Cloud Run
```bash
gcloud run deploy menu-ocr-worker-v2 \
  --source . \
  --region europe-west1 \
  --project aigetmenu \
  --memory 1Gi \
  --cpu 1 \
  --timeout 180 \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars="SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...,OPENAI_API_KEY=...,WORKER_BACKGROUND_POLL_ENABLED=false,GPT52_MODEL=gpt-4o-mini"
```

## 📦 Module Overview

### `config.py`
- Environment variable loading
- Supabase client initialization
- Worker configuration constants

### `worker.py`
- `MenuOCRWorker` class
- Job claiming logic
- Main processing pipeline
- Stale job management

### `utils/text_processing.py`
- Language normalization
- Text compression for LLM
- HTML to text conversion
- PDF link extraction

### `utils/corrections.py`
- Danish OCR correction mappings
- Text correction application

### `utils/storage.py`
- Supabase storage uploads
- Public URL generation
- MIME type fallback handling

### `extractors/pdf_extractor.py`
- PyMuPDF digital text extraction
- Tesseract OCR
- Document AI integration
- Staged extraction logic

### `extractors/vision_extractor.py`
- PDF to PNG rendering
- GPT-4/5 vision API calls
- Image-based menu extraction

### `parsers/menu_parser.py`
- LLM-based menu parsing
- Structured JSON validation
- Danish/English system prompts

## 🔧 Configuration

All configuration is via environment variables (see `config.py`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | Required | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Supabase service key |
| `OPENAI_API_KEY` | Required | OpenAI API key |
| `WORKER_BACKGROUND_POLL_ENABLED` | `false` | Enable background polling (use Cloud Scheduler + `/run-once` instead) |
| `GPT52_VISION_ENABLED` | `true` | Use GPT-5.2 for hard PDFs |
| `GPT52_MODEL` | `gpt-4o` | Vision model name |
| `HARD_PDF_SKIP_OCR` | `true` | Skip OCR for hard PDFs |
| `MAX_PAGES_TO_PROCESS` | `12` | Max PDF pages |
| `STALE_JOB_MINUTES` | `12` | Requeue threshold |

## 🧪 Testing

Each module can be tested independently:

```python
# Test PDF extraction
from extractors.pdf_extractor import extract_text_digital
text, metrics = extract_text_digital(pdf_bytes, max_pages=5)

# Test menu parsing
from parsers.menu_parser import parse_menu_with_llm
menu = parse_menu_with_llm(text, "da", "gpt-4o-mini")

# Test storage
from utils.storage import storage_upload_public
url = storage_upload_public("bucket", "path", content)
```

## 📊 Benefits of Refactoring

### Before (main.py: 1348 lines)
- ❌ Hard to navigate
- ❌ Difficult to test
- ❌ Functions buried in one file
- ❌ Tight coupling

### After (9 focused modules)
- ✅ Easy navigation
- ✅ Simple unit testing
- ✅ Clear module boundaries
- ✅ Loose coupling
- ✅ Reusable components

## 🔄 Migration

The old `main.py` is preserved as `main_old.py` for reference. The new structure is **100% backward compatible** - all functionality remains the same.

No changes needed to:
- Deployment scripts
- Environment variables
- Database schema
- API endpoints

## 📝 Next Steps

Consider these enhancements:
1. Add unit tests for each module
2. Add type hints throughout
3. Create separate config files for dev/prod
4. Add performance monitoring
5. Implement retry strategies per extractor
