"""Content analysis using AI."""

import json
import logging
from typing import Optional, Dict, Any
from openai import OpenAI

logger = logging.getLogger(__name__)


def analyze_website_content(
    text_content: str,
    metadata: dict,
    url: str,
    openai_api_key: str,
    model: str = "gpt-4o-mini"
) -> Optional[Dict[str, Any]]:
    """
    Analyze website content using AI to extract business information.
    
    Returns structured data about the business.
    """
    try:
        client = OpenAI(api_key=openai_api_key)
        
        # Prepare content for analysis (limit size)
        max_chars = 8000
        if len(text_content) > max_chars:
            text_content = text_content[:max_chars] + "..."
        
        system_prompt = """You are a business information extraction expert specializing in Danish businesses, particularly restaurants and cafes.

Analyze the website content and extract business information in JSON format. Pay special attention to Danish terms like "Åbningstider" (opening hours), "Menukort/Menu" (menu), "Om os/Om" (about), "Kontakt" (contact), "Booking" (reservations).

Return ONLY valid JSON (no markdown) with this structure:
{
  "business_name": "Company name",
  "business_type": "restaurant|cafe|hotel|retail|service|other",
  "short_description": "Brief description in Danish (2-3 sentences) - focus on what makes them unique",
  "long_description": "Detailed description in Danish (4-6 sentences) - include atmosphere, specialties, and story",
  "services": ["List", "of", "services", "offered"],
  "specialties": ["Key", "dishes", "or", "specialties", "mentioned"],
  "target_audience": "Who are their customers - be specific",
  "brand_tone": "professional|casual|luxury|friendly|modern|traditional|cozy",
  "contact": {
    "phone": "Phone number if found",
    "email": "Email if found",
    "address": "Physical address if found"
  },
  "opening_hours": "Opening hours text if found (Åbningstider)",
  "social_media": {
    "facebook": "URL if found",
    "instagram": "URL if found"
  },
  "keywords": ["Relevant", "keywords", "for", "the", "business"],
  "atmosphere": "Description of the atmosphere/ambiance if mentioned",
  "menu_highlights": ["Notable", "menu", "items", "if", "mentioned"]
}

IMPORTANT Rules:
- Extract ALL information available, especially Åbningstider (opening hours) and menu items
- Keep descriptions in Danish if the website is Danish
- Be thorough - include every detail you find
- If information is not found, use null
- Focus on concrete, specific details over generic descriptions
- Extract the actual opening hours text, not just "See website"
"""

        user_content = f"""Website URL: {url}
        
Metadata:
{json.dumps(metadata, indent=2, ensure_ascii=False)}

Website Content:
{text_content}

Extract business information from this website."""

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1500
        )
        
        result_text = response.choices[0].message.content.strip()
        analysis = json.loads(result_text)
        
        logger.info(f"✅ Website analysis completed for {url}")
        return analysis
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error analyzing website content: {str(e)}")
        return None


def generate_brand_profile(
    analysis: Dict[str, Any],
    openai_api_key: str,
    model: str = "gpt-4o-mini"
) -> Optional[Dict[str, Any]]:
    """
    Generate a comprehensive brand profile based on analysis.
    """
    try:
        client = OpenAI(api_key=openai_api_key)
        
        system_prompt = """You are a brand strategist creating detailed brand profiles.

Based on the business analysis, create a comprehensive brand profile in JSON format.

Return ONLY valid JSON with this structure:
{
  "brand_voice": {
    "tone": "Description of brand tone",
    "style": "Description of communication style",
    "key_messages": ["Main", "messages"]
  },
  "visual_identity": {
    "suggested_colors": ["Color themes based on brand"],
    "style_keywords": ["modern", "elegant", "etc"]
  },
  "content_strategy": {
    "themes": ["Content themes"],
    "posting_frequency": "Suggested frequency",
    "best_platforms": ["Recommended social platforms"]
  },
  "target_segments": [
    {
      "segment": "Segment name",
      "characteristics": "Description",
      "messaging": "How to communicate with this segment"
    }
  ]
}
"""

        user_content = f"""Business Analysis:
{json.dumps(analysis, indent=2, ensure_ascii=False)}

Create a comprehensive brand profile for this business."""

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=1200
        )
        
        result_text = response.choices[0].message.content.strip()
        brand_profile = json.loads(result_text)
        
        logger.info("✅ Brand profile generated")
        return brand_profile
        
    except Exception as e:
        logger.error(f"Error generating brand profile: {str(e)}")
        return None
