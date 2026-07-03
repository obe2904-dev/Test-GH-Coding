/**
 * Menu Analyzer Service
 * Language-aware AI analysis
 */

interface MenuItem {
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  is_signature: boolean;
}

interface AnalyzedMetadata {
  food_philosophy: string;
  organic_certified: boolean;
  local_ingredients_pct: number;
  has_specialty_coffee: boolean;
  coffee_roaster: string | null;
  has_full_bar: boolean;
  has_wine_list: boolean;
  signature_items_count: number;
  total_items_count: number;
  menu_language: string; // NEW: detected language
  insights: {
    dietary_patterns: string[];
    cuisine_style: string;
    price_positioning: string;
    unique_features: string[];
  };
}

export class MenuAnalyzer {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Detect menu language from items
   */
  private detectLanguage(menuItems: MenuItem[]): string {
    // Simple language detection based on common words
    const allText = menuItems
      .map(item => `${item.name} ${item.description || ''}`)
      .join(' ')
      .toLowerCase();

    // Danish indicators
    const danishWords = ['med', 'og', 'på', 'til', 'fra', 'serveres', 'dagens'];
    const danishCount = danishWords.filter(word => allText.includes(word)).length;

    // English indicators
    const englishWords = ['with', 'and', 'the', 'served', 'fresh', 'daily'];
    const englishCount = englishWords.filter(word => allText.includes(word)).length;

    // Swedish indicators
    const swedishWords = ['med', 'och', 'på', 'till', 'från', 'serveras'];
    const swedishCount = swedishWords.filter(word => allText.includes(word)).length;

    if (danishCount > englishCount && danishCount > swedishCount) return 'da';
    if (englishCount > danishCount && englishCount > swedishCount) return 'en';
    if (swedishCount > danishCount && swedishCount > englishCount) return 'sv';
    
    return 'da'; // Default to Danish
  }

  /**
   * Analyze menu items with AI
   */
  async analyzeMenu(
    menuItems: MenuItem[],
    businessContext: any
  ): Promise<AnalyzedMetadata> {
    const detectedLanguage = this.detectLanguage(menuItems);
    const prompt = this.buildAnalysisPrompt(menuItems, businessContext, detectedLanguage);

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
            content: `You are a food industry analyst specializing in European hospitality. You analyze menus to extract metadata. The menu is in ${this.getLanguageName(detectedLanguage)}. Always return valid JSON with food_philosophy in the menu's original language.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    const result = JSON.parse(content);
    
    // Add counts and detected language
    result.total_items_count = menuItems.length;
    result.signature_items_count = menuItems.filter(item => item.is_signature).length;
    result.menu_language = detectedLanguage;

    return result as AnalyzedMetadata;
  }

  /**
   * Get language name for prompt
   */
  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      'da': 'Danish',
      'en': 'English',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'de': 'German',
    };
    return names[code] || 'Danish';
  }

  /**
   * Build analysis prompt (language-aware)
   */
  private buildAnalysisPrompt(
    menuItems: MenuItem[], 
    businessContext: any,
    language: string
  ): string {
    const categories = this.groupByCategory(menuItems);

    const menuText = Object.entries(categories)
      .map(([category, items]) => {
        const itemList = (items as MenuItem[])
          .map(item => {
            const signature = item.is_signature ? ' [SIGNATURE]' : '';
            const desc = item.description ? `: ${item.description}` : '';
            const price = item.price ? ` - ${item.price} ${this.getCurrencySymbol(language)}` : '';
            return `  - ${item.name}${signature}${desc}${price}`;
          })
          .join('\n');
        return `${category}:\n${itemList}`;
      })
      .join('\n\n');

    // Language-specific organic keywords
    const organicKeywords = this.getOrganicKeywords(language);

    return `Analyze this menu from a ${this.getLanguageName(language)} hospitality business.

BUSINESS CONTEXT:
- Name: ${businessContext.business_name}
- Type: ${businessContext.business_type}
- Location: ${businessContext.city}

MENU (${menuItems.length} items, language: ${this.getLanguageName(language)}):
${menuText}

TASK:
Extract metadata in JSON format. Return food_philosophy in the SAME LANGUAGE as the menu.

ANALYSIS GUIDELINES:
1. **Food Philosophy**: Culinary approach (e.g., "Ny Nordisk", "New Nordic", "Fransk bistro"). Write in menu's language.

2. **Organic/Local**: Look for organic keywords: ${organicKeywords.join(', ')}. Check for farm names, local regions.

3. **Organic Certified**: Only true if strong evidence (many organic items, explicit certification).

4. **Coffee Program**: Check for specialty coffee, roaster names, espresso drinks.

5. **Beverage Program**: Wine list, cocktails, craft beer.

6. **Dietary Patterns**: Vegetarian, vegan, gluten-free options.

7. **Cuisine Style**: Nordic, French, Italian, Fusion, etc.

8. **Price Positioning**: Based on prices - budget/moderate/upscale/fine_dining.

9. **Unique Features**: What makes this special?

OUTPUT FORMAT (JSON):
{
  "food_philosophy": "In menu's original language (1-2 sentences)",
  "organic_certified": true/false,
  "local_ingredients_pct": 0-100,
  "has_specialty_coffee": true/false,
  "coffee_roaster": "Roaster name or null",
  "has_full_bar": true/false,
  "has_wine_list": true/false,
  "insights": {
    "dietary_patterns": ["vegetarian_options", etc.],
    "cuisine_style": "Primary type",
    "price_positioning": "budget|moderate|upscale|fine_dining",
    "unique_features": ["Feature 1", "Feature 2"]
  }
}

CRITICAL: Return food_philosophy in ${this.getLanguageName(language)}, not English.
Return ONLY valid JSON, no markdown.
`;
  }

  /**
   * Get organic keywords by language
   */
  private getOrganicKeywords(language: string): string[] {
    const keywords: Record<string, string[]> = {
      'da': ['økologisk', 'øko', 'lokal', 'lokalt', 'bæredygtig', 'Bornholm', 'gård'],
      'en': ['organic', 'local', 'sustainable', 'farm', 'estate'],
      'sv': ['ekologisk', 'lokal', 'hållbar', 'gård'],
      'no': ['økologisk', 'lokal', 'bærekraftig', 'gård'],
      'de': ['bio', 'ökologisch', 'lokal', 'nachhaltig'],
    };
    return keywords[language] || keywords['da'];
  }

  /**
   * Get currency symbol by language
   */
  private getCurrencySymbol(language: string): string {
    const currencies: Record<string, string> = {
      'da': 'DKK',
      'sv': 'SEK',
      'no': 'NOK',
      'en': 'GBP',
      'de': 'EUR',
    };
    return currencies[language] || 'DKK';
  }

  /**
   * Group menu items by category
   */
  private groupByCategory(items: MenuItem[]): Record<string, MenuItem[]> {
    const grouped: Record<string, MenuItem[]> = {};

    for (const item of items) {
      const category = item.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    }

    return grouped;
  }
}
