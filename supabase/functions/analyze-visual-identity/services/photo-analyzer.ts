/**
 * Photo Analyzer Service
 * Uses GPT-4 Vision to analyze photos
 */

interface PhotoAnalysisResult {
  overall_aesthetic: string;
  lighting_preference: string;
  composition_style: string;
  color_grading: string;
  dominant_colors: string[]; // e.g., ["warm brown (#8B7355)", "cream (#F5F5DC)"]
  recognizable_elements: string[];
  venue_description: string;
  photography_tips: string[];
  mood: string;
}

export class PhotoAnalyzer {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Analyze multiple photos with GPT-4 Vision
   */
  async analyzePhotos(photoUrls: string[], locale: string = 'da'): Promise<PhotoAnalysisResult> {
    // Limit to first 5 photos to control costs
    const urlsToAnalyze = photoUrls.slice(0, 5);

    const prompt = this.buildAnalysisPrompt(urlsToAnalyze.length, locale);

    // Build messages with images
    const imageMessages = urlsToAnalyze.map(url => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'low' as const }, // 'low' detail to save costs
    }));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional photography and brand identity consultant specializing in hospitality businesses. You analyze photos to extract visual style guidelines. Always return valid JSON. Write all descriptive text fields (venue_description, overall_aesthetic, lighting_preference, composition_style, color_grading, mood, photography_tips, recognizable_elements) in ${locale === 'da' ? 'Danish' : locale === 'nb' ? 'Norwegian' : locale === 'sv' ? 'Swedish' : 'English'}.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...imageMessages,
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI Vision API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI Vision');
    }

    return JSON.parse(content) as PhotoAnalysisResult;
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(photoCount: number, locale: string = 'da'): string {
    const lang = locale === 'da' ? 'Danish' : locale === 'nb' ? 'Norwegian' : locale === 'sv' ? 'Swedish' : 'English';
    return `Analyze these ${photoCount} photos from a hospitality business (restaurant/café/bar) and extract their visual identity.

TASK:
Identify the consistent visual style across all photos. Look for patterns in:
1. **Overall Aesthetic**: What's the visual style? (e.g., "Natural, warm, authentic", "Modern minimalist", "Rustic cozy")
2. **Lighting**: What type of lighting dominates? (e.g., "Natural light, golden hour", "Soft ambient", "Bright overhead")
3. **Composition**: How are photos composed? (e.g., "Close-ups with context, rule of thirds", "Overhead flatlays", "Wide environmental shots")
4. **Color Grading**: What's the color treatment? (e.g., "Warm tones, earthy", "Cool blue-gray", "High contrast, vibrant")
5. **Dominant Colors**: Extract 3-5 dominant colors WITH hex codes. Format: "warm brown (#8B7355)", "cream (#F5F5DC)"
6. **Recognizable Elements**: What interior/exterior elements are distinctive? (e.g., "Vintage furniture, exposed brick", "Light wood tables, plants", "Industrial metal fixtures")
7. **Venue Description**: Write 2-3 factual sentences describing what this space physically looks and feels like — materials, layout character, indoor/outdoor setup, level of formality. Focus on verifiable facts visible in the photos, not impressions. Example: "Open dining room with light wood tables and black metal chairs. Large windows along one wall with direct sightlines to the street. No tablecloths — casual, unfussy table setting."
8. **Photography Tips**: What photography guidelines would maintain this style? (3-4 specific tips)
9. **Mood**: Overall emotional feeling (e.g., "Cozy and inviting", "Elegant and refined", "Casual and fun")

CRITICAL REQUIREMENTS:
- Extract ACTUAL colors from photos (not generic)
- Include HEX codes for each color (#RRGGBB format)
- Be specific about recognizable elements (not "nice decor" but "vintage wooden chairs, green plants, white subway tiles")
- Photography tips should be actionable

OUTPUT FORMAT (JSON):
{
  "overall_aesthetic": "Concise description",
  "lighting_preference": "Lighting style",
  "composition_style": "Composition approach",
  "color_grading": "Color treatment",
  "dominant_colors": [
    "color name (#HEX)",
    "color name (#HEX)",
    "color name (#HEX)"
  ],
  "recognizable_elements": [
    "Element 1",
    "Element 2",
    "Element 3"
  ],
  "venue_description": "2-3 factual sentences about the physical space (write in ${lang})",
  "photography_tips": [
    "Tip 1",
    "Tip 2",
    "Tip 3"
  ],
  "mood": "Emotional feeling"
}

Return ONLY valid JSON, no markdown formatting.
`;
  }
}
