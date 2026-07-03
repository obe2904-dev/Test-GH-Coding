"""LLM-based menu parsing."""

import json
import time
import logging
from typing import Optional, Dict, Any
from openai import OpenAI

from config import OPENAI_API_KEY

logger = logging.getLogger(__name__)


def parse_menu_with_llm(text: str, language_code: str, model: str) -> Optional[Dict[str, Any]]:
    """Parse menu text into structured JSON using an LLM."""
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)

        if language_code == "da":
            system_prompt = """You are a precise Danish restaurant menu extraction expert.

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "summary": "short menu summary in Danish",
  "categories": [
    {
      "name": "Category name",
      "items": [
        {
          "name": "Item name",
          "description": "Description or null",
          "price": 145.0,
          "currency": "DKK"
        }
      ]
    }
  ]
}

Rules:
- Preserve Danish characters (æ, ø, å) exactly as written.
- Do not invent items. Only extract what is explicitly present.
- Keep multi-line item descriptions grouped with the item name.
- Extract numeric prices when present. If missing, set price null.

Splitting:
- If a dish (e.g. a platter/menu) lists many components separated by commas/newlines then create one item per component.
- For headings like "Juleplatte" you may use it as a category name, and put the components as items.

Price parsing (DKK):
- Parse common Danish formats: "20.-", "20,-", "20 kr", "20 kroner", "DKK 20".
- If currency is not shown but the restaurant is Danish, set currency to "DKK" when a price exists.
"""
        else:
            system_prompt = """You are a precise restaurant menu extraction expert (English).

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "summary": "short menu summary in English",
  "categories": [
    {
      "name": "Category name",
      "items": [
        {
          "name": "Item name",
          "description": "Description or null",
          "price": 12.5,
          "currency": "USD"
        }
      ]
    }
  ]
}

Rules:
- Do not invent items. Only extract what is explicitly present.
- Keep multi-line item descriptions grouped with the item name.
- Extract numeric prices when present. If missing, set price null.

Splitting:
- If an item contains a long comma-separated list of components, create one item per component.
"""

        llm_start = time.time()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Parse this menu:\n\n{text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=1400 if model == "gpt-4o-mini" else 2000,
        )

        logger.info(
            f"LLM {model} finished in {int((time.time() - llm_start) * 1000)}ms; input_chars={len(text)}"
        )

        result_text = response.choices[0].message.content.strip()

        # Handle markdown code blocks defensively
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]

        structured = json.loads(result_text)
        logger.info(f"Parsed {len(structured.get('categories', []))} menu categories using {model}")
        return structured

    except Exception as e:
        logger.error(f"Error parsing menu with LLM: {str(e)}")
        return None


def validate_structured_menu(structured: Optional[Dict[str, Any]]) -> bool:
    """Validate that structured menu has content."""
    if not structured or not isinstance(structured, dict):
        return False
    categories = structured.get('categories')
    if not isinstance(categories, list) or len(categories) == 0:
        return False
    total_items = 0
    for cat in categories:
        items = (cat or {}).get('items')
        if isinstance(items, list):
            total_items += len(items)
    return total_items > 0
