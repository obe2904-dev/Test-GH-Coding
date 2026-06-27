/**
 * Competitive Gap Analyzer
 * AI-driven competitive positioning without hardcoded cuisine types
 * 
 * Uses GPT-4o-mini for fast, cost-effective analysis (~$0.15 per 1M tokens)
 */

export interface CompetitiveGapInput {
  business: {
    name: string;
    category: string;
    avg_price?: number | null;
    about?: string;
  };
  competitors: Array<{
    name: string;
    distance_meters: number;
    rating?: number;
    user_ratings_total?: number;
    price_level?: number; // 1-4 Google scale
  }>;
  neighborhood: string | null;
}

export interface CompetitiveGapOutput {
  gap_type: 'unique_cuisine' | 'premium_positioning' | 'value_positioning' | 'experience_focus' | 'none';
  gap_description: string; // One sentence for content use
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyze competitive gap using AI
 * Returns deterministic fallback if AI unavailable
 */
export async function analyzeCompetitiveGap(
  input: CompetitiveGapInput,
  openaiClient: any // OpenAI client instance
): Promise<CompetitiveGapOutput> {
  if (!openaiClient || input.competitors.length === 0) {
    return {
      gap_type: 'none',
      gap_description: 'Insufficient data to determine competitive positioning',
      confidence: 'low'
    };
  }

  try {
    // Calculate average competitor metrics
    const avgRating = input.competitors
      .filter(c => c.rating)
      .reduce((sum, c, _, arr) => sum + (c.rating! / arr.length), 0);

    const avgPriceLevel = input.competitors
      .filter(c => c.price_level)
      .reduce((sum, c, _, arr) => sum + (c.price_level! / arr.length), 0);

    const avgDistance = input.competitors
      .reduce((sum, c, _, arr) => sum + (c.distance_meters / arr.length), 0);

    // Build competitive context for AI
    const competitorSummary = input.competitors
      .slice(0, 6) // Top 6 closest
      .map(c => `- ${c.distance_meters}m away, rating ${c.rating || 'N/A'}, price level ${c.price_level || 'N/A'}`)
      .join('\n');

    const prompt = `You are analyzing competitive positioning for a restaurant/bar/cafe.

BUSINESS:
Name: ${input.business.name}
Category: ${input.business.category}
Average price: ${input.business.avg_price ? `${input.business.avg_price} DKK` : 'Unknown'}
${input.business.about ? `About: ${input.business.about.substring(0, 200)}` : ''}

NEARBY COMPETITORS (within 200m):
${competitorSummary}

Competitive averages:
- Average rating: ${avgRating.toFixed(1)}
- Average price level: ${avgPriceLevel.toFixed(1)} (1=cheap, 4=expensive)
- Average distance: ${avgDistance.toFixed(0)}m

TASK:
Identify ONE competitive gap or differentiator in max 15 words. Focus on:
1. Unique cuisine/concept not available nearby
2. Premium positioning if competitors skew budget
3. Value positioning if competitors skew premium
4. Experience/ambiance focus if quality gap exists

Return JSON only:
{
  "gap_type": "unique_cuisine" | "premium_positioning" | "value_positioning" | "experience_focus" | "none",
  "gap_description": "One sentence, max 15 words, no competitor names",
  "confidence": "high" | "medium" | "low"
}`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini', // Fast + cheap
      messages: [
        { role: 'system', content: 'You are a competitive positioning analyst. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower = more deterministic
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Validate response
    const validGapTypes = ['unique_cuisine', 'premium_positioning', 'value_positioning', 'experience_focus', 'none'];
    if (!validGapTypes.includes(result.gap_type)) {
      console.warn(`Invalid gap_type from AI: ${result.gap_type}, falling back to 'none'`);
      result.gap_type = 'none';
    }

    return {
      gap_type: result.gap_type,
      gap_description: result.gap_description || 'No clear competitive gap identified',
      confidence: result.confidence || 'medium'
    };

  } catch (error) {
    console.error('Competitive gap analysis failed:', error);
    
    // Deterministic fallback based on price data
    if (input.business.avg_price && input.competitors.length > 0) {
      const avgCompetitorPrice = input.competitors
        .filter(c => c.price_level)
        .reduce((sum, c, _, arr) => sum + (c.price_level! / arr.length), 0);

      if (avgCompetitorPrice >= 3 && input.business.avg_price < 200) {
        return {
          gap_type: 'value_positioning',
          gap_description: 'Accessible pricing in premium-skewed neighborhood',
          confidence: 'medium'
        };
      } else if (avgCompetitorPrice <= 2 && input.business.avg_price > 250) {
        return {
          gap_type: 'premium_positioning',
          gap_description: 'Quality-focused positioning in budget-skewed area',
          confidence: 'medium'
        };
      }
    }

    return {
      gap_type: 'none',
      gap_description: 'Unable to determine competitive positioning',
      confidence: 'low'
    };
  }
}
