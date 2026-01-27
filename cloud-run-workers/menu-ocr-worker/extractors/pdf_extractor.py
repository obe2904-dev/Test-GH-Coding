"""PDF text extraction using PyMuPDF, Tesseract, and Document AI."""

import os
import logging
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from typing import Dict, Any, Optional, Tuple

from utils.text_processing import tesseract_lang_for
from config import (
    MAX_PAGES_TO_PROCESS,
    TESSERACT_ZOOM,
    MIN_CHARS_PER_PAGE_FOR_DIGITAL,
    MIN_TOTAL_CHARS_FOR_DIGITAL,
    DOCAI_ENABLED,
    DOCAI_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


def is_docai_configured() -> bool:
    """Check if Document AI is configured."""
    return bool(
        os.getenv("DOCAI_PROCESSOR_ID") 
        and os.getenv("DOCAI_LOCATION") 
        and os.getenv("GOOGLE_CLOUD_PROJECT")
    )


def docai_extract_text(pdf_content: bytes, timeout_seconds: int) -> str:
    """Extract text via Google Document AI OCR."""
    from google.cloud import documentai  # type: ignore

    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("DOCAI_LOCATION")
    processor_id = os.getenv("DOCAI_PROCESSOR_ID")

    client = documentai.DocumentProcessorServiceClient()
    name = client.processor_path(project_id, location, processor_id)

    raw_document = documentai.RawDocument(content=pdf_content, mime_type="application/pdf")
    request = documentai.ProcessRequest(name=name, raw_document=raw_document)
    result = client.process_document(request=request, timeout=timeout_seconds)

    document = result.document
    full_text = document.text or ""

    def layout_to_text(layout) -> str:
        if not layout or not layout.text_anchor or not layout.text_anchor.text_segments:
            return ""
        pieces = []
        for seg in layout.text_anchor.text_segments:
            start = int(getattr(seg, "start_index", 0) or 0)
            end = int(seg.end_index)
            pieces.append(full_text[start:end])
        return "".join(pieces)

    pages_out = []
    for page in document.pages:
        para_texts = []
        for para in page.paragraphs:
            t = layout_to_text(para.layout).strip()
            if t:
                para_texts.append(t)
        pages_out.append("\n".join(para_texts))

    combined = "\n\n".join([p for p in pages_out if p.strip()]).strip()
    return combined


def extract_text_digital(pdf_content: bytes, max_pages: int) -> Tuple[str, Dict[str, Any]]:
    """Extract text from digital PDF using PyMuPDF."""
    metrics: Dict[str, Any] = {
        'total_pages': 0,
        'char_count': 0,
        'method': 'pymupdf',
    }

    doc = fitz.open(stream=pdf_content, filetype="pdf")
    total_pages = min(len(doc), max_pages)
    metrics['total_pages'] = total_pages

    pages = []
    per_page_counts = []
    for i in range(total_pages):
        page = doc[i]
        t = page.get_text("text")
        t = (t or "").strip()
        pages.append(t)
        per_page_counts.append(len(t))

    combined = "\n\n".join([p for p in pages if p]).strip()
    metrics['char_count'] = len(combined)
    metrics['chars_per_page'] = (sum(per_page_counts) / total_pages) if total_pages else 0
    metrics['per_page_chars'] = per_page_counts
    return combined, metrics


def extract_text_with_tesseract(
    pdf_content: bytes, 
    language_code: str, 
    max_pages: int,
    zoom: float
) -> Tuple[str, Dict[str, Any]]:
    """Extract text from PDF using PyMuPDF rendering + Tesseract OCR."""
    metrics = {
        'total_pages': 0,
        'avg_confidence': 0.0,
        'char_count': 0,
        'garbled_words': 0,
        'method': 'tesseract',
    }

    doc = fitz.open(stream=pdf_content, filetype="pdf")
    metrics['total_pages'] = min(len(doc), max_pages)

    all_text = []
    confidences = []

    tess_lang = tesseract_lang_for(language_code)

    for page_num in range(metrics['total_pages']):
        page = doc[page_num]
        text = page.get_text()

        if len((text or '').strip()) < 50:
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            data = pytesseract.image_to_data(img, lang=tess_lang, output_type=pytesseract.Output.DICT)
            text = '\n'.join(data['text'])

            confidences_page = [int(conf) for conf in data['conf'] if int(conf) > 0]
            if confidences_page:
                confidences.extend(confidences_page)

        all_text.append(text)

    raw_text = '\n'.join(all_text)
    metrics['char_count'] = len(raw_text)
    if confidences:
        metrics['avg_confidence'] = sum(confidences) / len(confidences)

    import re
    special_patterns = re.findall(r"[^a-zæøåA-ZÆØÅ\s\-']{2,}", raw_text)
    metrics['garbled_words'] = len(special_patterns)

    logger.info(
        f"Extracted {metrics['char_count']} chars, "
        f"confidence: {metrics['avg_confidence']:.1f}%, "
        f"garbled: {metrics['garbled_words']}"
    )

    return raw_text, metrics


def extract_text_staged(pdf_content: bytes, language_code: str) -> Tuple[str, Dict[str, Any]]:
    """Staged text extraction: digital → Document AI → Tesseract."""
    digital_text, digital_metrics = extract_text_digital(pdf_content, MAX_PAGES_TO_PROCESS)
    total_chars = digital_metrics.get('char_count', 0) or 0
    chars_per_page = digital_metrics.get('chars_per_page', 0) or 0

    if total_chars >= MIN_TOTAL_CHARS_FOR_DIGITAL and chars_per_page >= MIN_CHARS_PER_PAGE_FOR_DIGITAL:
        return digital_text, digital_metrics

    # Signal that GPT-5.2 vision should be used instead of OCR
    from config import GPT52_VISION_ENABLED, HARD_PDF_SKIP_OCR
    if GPT52_VISION_ENABLED and HARD_PDF_SKIP_OCR:
        raise RuntimeError("HARD_PDF_REQUIRES_GPT52_VISION")

    if DOCAI_ENABLED and is_docai_configured():
        try:
            logger.info("Using Document AI OCR (low text density detected)")
            docai_text = docai_extract_text(pdf_content, timeout_seconds=DOCAI_TIMEOUT_SECONDS)
            if len(docai_text.strip()) >= 200:
                return docai_text, {
                    'total_pages': digital_metrics.get('total_pages', 0),
                    'char_count': len(docai_text),
                    'method': 'docai',
                }
        except Exception as e:
            logger.error(f"Document AI OCR failed, falling back to Tesseract: {str(e)}")

    return extract_text_with_tesseract(pdf_content, language_code, MAX_PAGES_TO_PROCESS, TESSERACT_ZOOM)
