/**
 * Prompt Builder Service
 * Constructs intelligent prompts for GPT-4o based on gathered knowledge
 */

import type { BusinessKnowledgeGathered } from '../types.ts';

export function buildBrandProfilePrompt(knowledge: BusinessKnowledgeGathered): string {
  const { business, location, operations, menu_items, menu_metadata } = knowledge;

  // Build context sections
  const businessContext = `
BUSINESS IDENTITY:
- Name: ${business.name}
- Type: ${business.type}
- Location: ${business.address}, ${business.city}
`;

  const locationContext = location ? `
LOCATION CONTEXT:
- Neighborhood: ${location.neighborhood || 'Not specified'}
- Area Type: ${location.area_type || 'Not specified'}
- View: ${location.has_view ? `Yes (${location.view_type?.join(', ')})` : 'No'}
- Outdoor Space: ${location.outdoor_space_type || 'None'}
- Nearby Landmarks: ${location.landmarks_nearby.map(l => l.name).join(', ') || 'None listed'}
- Location Hooks: ${location.location_marketing_hooks.join('; ') || 'None'}
` : '';

  const operationsContext = operations ? `
OPERATIONS:
- Seating: ${operations.seating_capacity_indoor || 0} indoor${operations.seating_capacity_outdoor ? ` + ${operations.seating_capacity_outdoor} outdoor` : ''}
- Price Level: ${operations.price_level || 'Not specified'}
- Service Style: ${operations.has_table_service ? 'Table service' : 'Counter service'}
- Takeaway: ${operations.has_takeaway ? 'Yes' : 'No'}
` : '';

  const menuContext = menu_items && menu_items.length > 0 ? `
MENU HIGHLIGHTS:
${menu_items.slice(0, 10).map(item => 
  `- ${item.name}${item.is_signature ? ' (SIGNATURE)' : ''}${item.description ? ': ' + item.description : ''}`
).join('\n')}
` : '';

  const philosophyContext = menu_metadata ? `
FOOD PHILOSOPHY:
- Philosophy: ${menu_metadata.food_philosophy || 'Not specified'}
- Organic Certified: ${menu_metadata.organic_certified ? 'Yes' : 'No'}
- Specialty Coffee: ${menu_metadata.has_specialty_coffee ? `Yes (${menu_metadata.coffee_roaster || 'roaster not specified'})` : 'No'}
` : '';

  const prompt = `You are a brand strategist specializing in Danish hospitality businesses. Generate a comprehensive brand profile for this business.

${businessContext}
${locationContext}
${operationsContext}
${menuContext}
${philosophyContext}

TASK:
Create a brand profile that captures the authentic essence of this business. The profile must be in DANISH and deeply understand Danish hospitality culture.

CRITICAL REQUIREMENTS:
1. **Language**: All content in Danish (except JSON structure keys)
2. **Authenticity**: Avoid generic hospitality clichés
3. **Banned Words**: Identify overused words that dilute authenticity (e.g., "fantastisk", "perfekt" outside menu context)
4. **Tone**: Match the business type and location (upscale ≠ casual café)
5. **Content Hooks**: Specific, factual hooks from the data above (not generic claims)

OUTPUT FORMAT (JSON):
{
  "brand_essence": "One-line essence capturing who they are (in Danish, max 80 chars)",
  "brand_positioning": "How they position themselves (in Danish, 1-2 sentences)",
  "tone_of_voice": {
    "primary_tone": "Main tone (e.g., 'Warm and inviting')",
    "attributes": ["attribute1", "attribute2", "attribute3"],
    "formality_level": "casual | professional | formal"
  },
  "content_hooks": [
    {
      "hook": "Specific factual hook (e.g., location, signature item)",
      "usage": "When to use this hook"
    }
  ],
  "banned_words": [
    "word1 (reason why banned)",
    "word2 (reason why banned)"
  ],
  "target_audience": {
    "primary": "Primary audience description",
    "characteristics": ["characteristic1", "characteristic2"]
  },
  "competitive_positioning": {
    "differentiators": ["What makes them unique"],
    "key_advantages": ["Their strengths"]
  }
}

EXAMPLES OF GOOD BRAND ESSENCE:
- "Økologisk brunch ved åen"
- "Nordisk bistro i hjertet af Vesterbro"
- "Håndværkskaffe og hjemmebag siden 2015"

EXAMPLES OF GOOD CONTENT HOOKS:
- {"hook": "Udsigt til kanalen fra vores terrasse", "usage": "Summer outdoor posts"}
- {"hook": "Vores signatur: Brunchen", "usage": "Weekend brunch promotion"}
- {"hook": "2 minutters gang fra Nyhavn", "usage": "Location-based content"}

EXAMPLES OF BANNED WORDS (with reasons):
- "fantastisk (overused, empty marketing speak)"
- "perfekt (unless describing menu item from context)"
- "amazing (not Danish)"

Generate the brand profile now. Return ONLY valid JSON, no markdown formatting.
`;

  return prompt;
}
