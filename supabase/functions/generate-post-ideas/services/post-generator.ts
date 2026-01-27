/**
 * Post Generator Service
 * Generates post ideas using GPT-4o
 */

interface PostIdea {
  caption: string;
  hashtags: string[];
  platform: 'instagram' | 'facebook' | 'both';
  suggested_post_time: string;
  content_type: string;
  visual_suggestions: {
    composition: string;
    lighting: string;
    subject: string;
    color_palette: string[];
  };
  aligned_goal_id: string;
  goal_description: string;
}

export class PostGenerator {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Generate post ideas with GPT-4o
   */
  async generatePosts(
    knowledge: any,
    numberOfPosts: number = 3
  ): Promise<PostIdea[]> {
    const prompt = this.buildPrompt(knowledge, numberOfPosts);

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
            content: 'You are a Danish social media marketing expert for hospitality businesses. You create engaging, goal-driven post ideas that respect brand voice and drive results. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8, // Higher for creativity
        max_tokens: 2500,
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
    return result.posts as PostIdea[];
  }

  /**
   * Build comprehensive prompt
   */
  private buildPrompt(knowledge: any, numberOfPosts: number): string {
    const topGoal = knowledge.goals[0]; // Already prioritized
    const brandVoice = knowledge.brand_profile.tone_of_voice;
    const contentHooks = knowledge.brand_profile.content_hooks || [];
    const bannedWords = knowledge.brand_profile.banned_words || [];
    const locationHooks = knowledge.location.location_marketing_hooks || [];

    return `Generate ${numberOfPosts} social media post ideas for this Danish hospitality business.

BUSINESS CONTEXT:
- Name: ${knowledge.business.name}
- Type: ${knowledge.business.type}
- Location: ${knowledge.business.city}, ${knowledge.location.neighborhood || 'Denmark'}
- Brand Essence: ${knowledge.brand_profile.brand_essence}
- Food Philosophy: ${knowledge.menu_metadata.food_philosophy}

TOP PRIORITY GOAL:
${topGoal ? `- ${topGoal.description} (Priority: ${topGoal.priority})` : '- General brand awareness'}
${topGoal?.time_constraints?.target_days ? `- Focus days: ${topGoal.time_constraints.target_days.join(', ')}` : ''}
${topGoal?.time_constraints?.target_periods ? `- Focus periods: ${topGoal.time_constraints.target_periods.join(', ')}` : ''}

BRAND VOICE GUIDELINES:
- Primary Tone: ${brandVoice.primary_tone || 'Professional and friendly'}
- Attributes: ${brandVoice.attributes?.join(', ') || 'Welcoming, authentic'}
- Formality: ${brandVoice.formality_level || 'Casual'}
- CRITICAL: NEVER use these banned words: ${bannedWords.length > 0 ? bannedWords.join(', ') : 'None'}

CONTENT HOOKS (Use these!):
${contentHooks.slice(0, 3).map((h: any) => `- "${h.hook}" → ${h.usage}`).join('\n')}

LOCATION HOOKS (Weave these in naturally):
${locationHooks.slice(0, 3).map((h: string) => `- ${h}`).join('\n')}

VISUAL STYLE:
- Photography: ${knowledge.visual_identity.photography_style?.overall_aesthetic || 'Natural and inviting'}
- Lighting: ${knowledge.visual_identity.photography_style?.lighting_preference || 'Natural light'}
- Composition: ${knowledge.visual_identity.photography_style?.composition_style || 'Balanced'}
- Colors: ${knowledge.visual_identity.primary_colors?.map((c: any) => c.name).join(', ') || 'Warm, welcoming'}

OPERATIONAL CONTEXT:
- Slow Periods: ${knowledge.operations.typical_slow_periods?.map((p: any) => `${p.day} ${p.period}`).join(', ') || 'None specified'}
- Busy Periods: ${knowledge.operations.typical_busy_periods?.map((p: any) => `${p.day} ${p.period}`).join(', ') || 'None specified'}

TASK:
Create ${numberOfPosts} post ideas that:
1. **Directly support the top priority goal** - every post should drive this objective
2. **Match the brand voice exactly** - use the specified tone and attributes
3. **Avoid ALL banned words** - these are detected as inauthentic for this brand
4. **Incorporate content hooks** - use at least one hook per post
5. **Include location context** - weave in location hooks naturally
6. **Optimize for platform** - Instagram (visual, 4:5 ratio) vs Facebook (wider reach)
7. **Suggest optimal timing** - based on operational patterns and goal focus
8. **Provide visual guidance** - specific composition/lighting/subject suggestions

CRITICAL REQUIREMENTS:
- Write in Danish (this is a Danish business)
- Captions: 80-150 characters for Instagram, 100-200 for Facebook
- Hashtags: 5-8 relevant Danish hashtags, mix of broad and niche
- NO generic phrases like "kom forbi", "perfekt til", "nyd en" unless brand uses these
- AUTHENTIC voice - sound like the actual business owner would write
- SPECIFIC details - mention actual menu items, neighborhoods, features
- ACTION-ORIENTED - clear call to action aligned with goal

OUTPUT FORMAT (JSON):
{
  "posts": [
    {
      "caption": "Engaging caption in Danish",
      "hashtags": ["#københavnfood", "#nyhavn", "#brunch"],
      "platform": "instagram" | "facebook" | "both",
      "suggested_post_time": "2026-01-15T10:00:00Z",
      "content_type": "lunch_promotion" | "menu_highlight" | "brand_building" | etc.,
      "visual_suggestions": {
        "composition": "Close-up of signature dish with context",
        "lighting": "Natural window light from left",
        "subject": "Smørrebrød with coffee in background",
        "color_palette": ["warm brown", "cream", "green"]
      },
      "aligned_goal_id": "${topGoal?.id || ''}",
      "goal_description": "${topGoal?.description || 'Brand awareness'}"
    }
  ]
}

Return ONLY valid JSON, no markdown formatting.
`;
  }
}
