"""GPT-4/5 vision-based extraction for hard-to-read PDFs."""

import base64
import json
import time
import logging
import fitz  # PyMuPDF
from typing import Optional, Dict, Any, Tuple, List

from config import (
    OPENAI_API_KEY,
    GPT52_MODEL,
    GPT52_MAX_PAGES,
    GPT52_MAX_IMAGE_WIDTH,
)

logger = logging.getLogger(__name__)


def render_pdf_pages_to_pngs(pdf_content: bytes, max_pages: int, max_width: int) -> List[bytes]:
    """Render first N pages of a PDF to PNG images for vision models."""
    doc = fitz.open(stream=pdf_content, filetype="pdf")
    page_count = min(len(doc), max(1, max_pages))
    out: List[bytes] = []

    for i in range(page_count):
        page = doc[i]
        rect = page.rect
        base_width = float(rect.width or 1.0)
        zoom = min(3.0, max(1.0, max_width / base_width))
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        out.append(pix.tobytes("png"))

    return out


def parse_menu_from_images_with_vision(
    images_png: List[bytes], 
    language_code: str,
    model: str
) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """Use GPT vision to extract readable text + structured menu JSON from images."""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY)

        if language_code == "da":
            system_prompt = (
                "You extract Danish restaurant menus from images. "
                "Return ONLY valid JSON (no markdown).\n\n"
                "Schema:\n"
                "{\n"
                "  \"extracted_text\": \"string\",\n"
                "  \"menu\": {\n"
                "    \"summary\": \"short menu summary in Danish\",\n"
                "    \"categories\": [\n"
                "      {\n"
                "        \"name\": \"Category name\",\n"
                "        \"items\": [\n"
                "          {\n"
                "            \"name\": \"Item name\",\n"
                "            \"description\": \"Description or null\",\n"
                "            \"price\": 145.0,\n"
                "            \"currency\": \"DKK\"\n"
                "          }\n"
                "        ]\n"
                "      }\n"
                "    ]\n"
                "  }\n"
                "}\n\n"
                "Rules:\n"
                "- Preserve Danish characters (æ, ø, å).\n"
                "- Do not invent items.\n"
                "- Parse prices if shown (20.-, 20,-, 20 kr). If missing, set price null.\n"
                "- If currency not shown but price exists, use DKK."
            )
        else:
            system_prompt = (
                "You extract restaurant menus from images. "
                "Return ONLY valid JSON (no markdown).\n\n"
                "Schema:\n"
                "{\n"
                "  \"extracted_text\": \"string\",\n"
                "  \"menu\": {\n"
                "    \"summary\": \"short menu summary in English\",\n"
                "    \"categories\": [ ... ]\n"
                "  }\n"
                "}\n\n"
                "Rules:\n"
                "- Do not invent items.\n"
                "- Extract numeric prices when present, else null."
            )

        content_parts: List[Dict[str, Any]] = [
            {"type": "text", "text": "Extract the menu from these images."}
        ]
        for img in images_png:
            b64 = base64.b64encode(img).decode("utf-8")
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{b64}"},
            })

        llm_start = time.time()
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content_parts},
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_completion_tokens=2200,
            )
        except TypeError as e:
            if "max_completion_tokens" not in str(e):
                raise
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content_parts},
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=2200,
            )
        except Exception as e:
            msg = str(e)
            if "max_tokens" in msg and "max_completion_tokens" in msg:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": content_parts},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=2200,
                )
            else:
                raise

        logger.info(
            "Vision model (%s) finished in %dms; pages=%d",
            model,
            int((time.time() - llm_start) * 1000),
            len(images_png),
        )

        result_text = response.choices[0].message.content.strip()
        payload = json.loads(result_text)
        extracted_text = payload.get("extracted_text")
        menu = payload.get("menu")
        if isinstance(extracted_text, str) and isinstance(menu, dict):
            return extracted_text, menu
        return None, None
    except Exception as e:
        logger.error("Vision parse failed: %s", str(e), exc_info=True)
        return None, None


def extract_with_vision(pdf_content: bytes, language_code: str) -> Tuple[Optional[str], Optional[Dict[str, Any]], Dict[str, Any]]:
    """Extract menu using vision model (for hard PDFs)."""
    images = render_pdf_pages_to_pngs(pdf_content, GPT52_MAX_PAGES, GPT52_MAX_IMAGE_WIDTH)
    vision_text, vision_menu = parse_menu_from_images_with_vision(images, language_code, GPT52_MODEL)
    
    metrics = {
        'total_pages': min(len(images), GPT52_MAX_PAGES),
        'char_count': len(vision_text) if vision_text else 0,
        'method': 'gpt-5.2-vision',
    }
    
    return vision_text, vision_menu, metrics
