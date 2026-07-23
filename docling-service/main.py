"""
Docling Menu Extraction Service
Cloud Run service for extracting menu information from PDF documents using Docling
"""

import os
from pathlib import Path

# Make Hugging Face auth available before Docling resolves its models.
HF_TOKEN = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
if HF_TOKEN:
    os.environ.setdefault("HF_TOKEN", HF_TOKEN)
    os.environ.setdefault("HUGGINGFACE_HUB_TOKEN", HF_TOKEN)

HF_HOME = os.environ.get("HF_HOME") or "/tmp/hf"
os.environ.setdefault("HF_HOME", HF_HOME)
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(Path(HF_HOME) / "hub"))
DOCLING_ARTIFACTS_PATH = os.environ.get("DOCLING_ARTIFACTS_PATH") or "/opt/docling-models"

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any
import httpx
import tempfile

from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions

app = FastAPI(title="Docling Menu Extraction Service")

if Path(DOCLING_ARTIFACTS_PATH).is_dir():
    print(f"✅ Using local Docling model artifacts from {DOCLING_ARTIFACTS_PATH}.")
elif not HF_TOKEN:
    print("⚠️ Local Docling models and HF_TOKEN are not configured; model resolution may be rate limited.")
else:
    print("✅ Hugging Face token detected for Docling model resolution.")

# Configure Docling with optimized settings for menu extraction
pipeline_options = PdfPipelineOptions(artifacts_path=DOCLING_ARTIFACTS_PATH)
pipeline_options.do_ocr = False  # Keep the service on the lightweight text-extraction path
pipeline_options.do_table_structure = False
pipeline_options.force_backend_text = True

doc_converter = DocumentConverter(
    allowed_formats=[InputFormat.PDF],
    format_options={
        InputFormat.PDF: PdfFormatOption(
            pipeline_options=pipeline_options,
            backend=PyPdfiumDocumentBackend,
        ),
    }
)


class ExtractionRequest(BaseModel):
    """Request model for URL-based extraction"""
    url: HttpUrl
    source_id: Optional[str] = None


class ExtractionResponse(BaseModel):
    """Response model for menu extraction"""
    success: bool
    text: Optional[str] = None
    markdown: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run"""
    return {"status": "healthy", "service": "docling-menu-extraction"}


@app.post("/extract-pdf", response_model=ExtractionResponse)
async def extract_pdf_from_url(request: ExtractionRequest):
    """
    Extract menu content from a PDF URL using Docling
    
    Args:
        request: Contains PDF URL and optional source_id
        
    Returns:
        Extracted text, markdown, and metadata from the PDF
    """
    temp_file = None
    
    try:
        # Download PDF from URL
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(str(request.url))
            response.raise_for_status()
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
                f.write(response.content)
                temp_file = f.name
        
        # Convert PDF using Docling
        result = doc_converter.convert(temp_file)
        
        # Extract structured content
        text_content = result.document.export_to_text()
        markdown_content = result.document.export_to_markdown()
        
        # Extract metadata
        metadata = {
            "pages": len(result.document.pages),
            "has_tables": any(hasattr(page, 'tables') and page.tables for page in result.document.pages),
            "source_id": request.source_id,
        }
        
        return ExtractionResponse(
            success=True,
            text=text_content,
            markdown=markdown_content,
            metadata=metadata
        )
        
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download PDF: {str(e)}")
    
    except Exception as e:
        return ExtractionResponse(
            success=False,
            error=f"Extraction failed: {str(e)}"
        )
    
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file):
            os.unlink(temp_file)


@app.post("/extract-pdf-file", response_model=ExtractionResponse)
async def extract_pdf_from_file(file: UploadFile = File(...)):
    """
    Extract menu content from an uploaded PDF file using Docling
    
    Args:
        file: Uploaded PDF file
        
    Returns:
        Extracted text, markdown, and metadata from the PDF
    """
    temp_file = None
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
            content = await file.read()
            f.write(content)
            temp_file = f.name
        
        # Convert PDF using Docling
        result = doc_converter.convert(temp_file)
        
        # Extract structured content
        text_content = result.document.export_to_text()
        markdown_content = result.document.export_to_markdown()
        
        # Extract metadata
        metadata = {
            "pages": len(result.document.pages),
            "has_tables": any(hasattr(page, 'tables') and page.tables for page in result.document.pages),
            "filename": file.filename,
        }
        
        return ExtractionResponse(
            success=True,
            text=text_content,
            markdown=markdown_content,
            metadata=metadata
        )
        
    except Exception as e:
        return ExtractionResponse(
            success=False,
            error=f"Extraction failed: {str(e)}"
        )
    
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file):
            os.unlink(temp_file)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
