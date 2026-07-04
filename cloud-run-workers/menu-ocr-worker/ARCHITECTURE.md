# Menu OCR Worker Architecture

## 🏗️ Module Dependencies

```
main.py (Flask app)
    ↓
    ├─→ config.py (Configuration)
    │       ↓
    │       └─→ Supabase Client
    │
    └─→ worker.py (MenuOCRWorker)
            ↓
            ├─→ extractors/
            │       ├─→ pdf_extractor.py
            │       │       ↓
            │       │       └─→ PyMuPDF, Tesseract, Document AI
            │       │
            │       ├─→ vision_extractor.py
            │       │       ↓
            │       │       └─→ GPT-4/5 Vision API
            │       │
            │       └─→ browser_extractor.py
            │               ↓
            │               └─→ Playwright (Chromium headless)
            │
            ├─→ parsers/
            │       └─→ menu_parser.py
            │               ↓
            │               └─→ OpenAI GPT-4o/mini
            │
            └─→ utils/
                    ├─→ text_processing.py (Text utilities)
                    ├─→ corrections.py (OCR corrections)
                    ├─→ storage.py (Supabase storage)
                    └─→ helpers.py (General helpers)
```

## 📊 Processing Flow

```
1. Job Queue
   ↓
2. MenuOCRWorker.claim_next_job()
   ↓
3. MenuOCRWorker.process_job()
   ↓
4. Fetch URL content
   ↓
5. Determine type (PDF/HTML)
   ↓
   ├─→ PDF Branch
   │   ↓
   │   └─→ extract_text_staged()
   │       ↓
   │       ├─→ Digital PDF? → PyMuPDF (fast)
   │       ├─→ Low text? → GPT-5.2 Vision (accurate)
   │       ├─→ Fallback? → Document AI OCR
   │       └─→ Last resort? → Tesseract OCR
   │
   └─→ HTML Branch
       ↓
       ├─→ Check if minimal/empty HTML
       │   ↓
       │   └─→ Yes? → extract_with_browser() (Playwright)
       │       ↓
       │       └─→ Render JavaScript, wait for content
       ↓
       └─→ html_to_text()
   ↓
6. Parse with LLM
   ↓
   └─→ parse_menu_with_llm()
       ↓
       ├─→ Try gpt-4o-mini (cheap)
       ├─→ If empty → Try gpt-4o (better)
       └─→ If still empty (PDF) → Try GPT-5.2 Vision
   ↓
7. Store results
   ↓
   ├─→ business_documents table
   └─→ menu_results_v2 table (status: done)
```

## 🎯 Design Principles

### 1. Separation of Concerns
- **config.py**: Configuration only
- **extractors/**: Text extraction only
- **parsers/**: Menu parsing only
- **utils/**: Reusable utilities
- **worker.py**: Orchestration only
- **main.py**: HTTP server only

### 2. Single Responsibility
Each module does ONE thing:
- `pdf_extractor.py`: Extract text from PDFs
- `menu_parser.py`: Parse text into structured JSON
- `storage.py`: Handle Supabase storage
- `text_processing.py`: Clean and process text

### 3. Dependency Injection
- Modules don't create their own dependencies
- Config is centralized in `config.py`
- Easy to mock for testing

### 4. Error Isolation
- Errors in one extractor don't crash others
- Fallback strategies are built-in
- Clear error messages

## 🔄 Extraction Strategy Matrix

| PDF Type | Method | Cost | Speed | Quality |
|----------|--------|------|-------|---------|
| Digital (text-based) | PyMuPDF | Free | ⚡⚡⚡ | ⭐⭐⭐ |
| Scanned (low quality) | GPT-5.2 Vision | $$$ | ⚡ | ⭐⭐⭐⭐⭐ |
| Scanned (fallback) | Document AI | $$ | ⚡⚡ | ⭐⭐⭐⭐ |
| Scanned (last resort) | Tesseract | Free | ⚡⚡ | ⭐⭐ |
| HTML | Direct | Free | ⚡⚡⚡ | ⭐⭐⭐ |

## 🧪 Testing Strategy

### Unit Tests (Future)
```python
# Test extraction
def test_pdf_extractor():
    from extractors.pdf_extractor import extract_text_digital
    text, metrics = extract_text_digital(sample_pdf, max_pages=5)
    assert metrics['method'] == 'pymupdf'
    assert len(text) > 0

# Test parsing
def test_menu_parser():
    from parsers.menu_parser import parse_menu_with_llm
    menu = parse_menu_with_llm(sample_text, "da", "gpt-4o-mini")
    assert menu is not None
    assert 'categories' in menu

# Test storage
def test_storage_upload():
    from utils.storage import storage_upload_public
    url = storage_upload_public("test", "path.pdf", b"content")
    assert url.startswith("https://")
```

### Integration Tests (Future)
```python
def test_full_pipeline():
    worker = MenuOCRWorker()
    job = {"id": "test", "business_id": "123", "source_url": "..."}
    result = worker.process_job(job)
    assert result == True
```

## 📈 Scalability

### Current State
- Single worker instance
- Processes jobs sequentially
- 2-5 jobs/minute (depending on complexity)

### Easy Scaling Options
1. **Horizontal**: Deploy multiple Cloud Run instances
2. **Vertical**: Increase CPU/memory per instance
3. **Specialized**: Separate workers for PDF vs HTML
4. **Parallel**: Process multiple jobs per worker (add threading)

### Module Benefits for Scaling
- Extract specific extractors into separate services
- Run vision extraction on GPU instances
- Cache results in Redis (add caching layer)
- Monitor per-module performance

## 🔐 Security

- Secrets via environment variables
- No hardcoded credentials
- Supabase RLS for data access
- Token-protected trigger endpoints

## 📝 Monitoring Points

Add monitoring at:
1. **Worker level**: Job claim rate, success rate
2. **Extractor level**: Method usage, success rate per method
3. **Parser level**: Token usage, model usage
4. **Storage level**: Upload success rate, storage usage
