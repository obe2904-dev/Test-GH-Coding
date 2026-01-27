// Build context-aware prompts with language compliance
import { GenerationContext, IdeaPlan } from '../types.ts'
import {
  formatBusinessProfileForPrompt,
  formatMenuForPrompt,
  formatWeatherForPrompt,
  formatPreviousPostsForPrompt
} from '../data-sources/index.ts'
import { getMenuCategoryGuidance } from '../policies/menu-rules.ts'
import { getLocaleConfig } from '../policies/locale-config.ts'
import { formatPolicyForPrompt } from '../policies/brand-policy-compiler.ts'
import { formatIdeaPlanForPrompt, GenerationPlan, formatPlanForPrompt } from './strategy-engine.ts'
import { getLanguageConfig } from '../config/language-configs.ts'

export function buildSystemPrompt(language: string): string {
  const locale = getLocaleConfig(language)
  const languageGuidance = getLanguageGuidance(language, locale)
  
  return `You are an expert social media marketing manager specializing in ${language} content creation for ${locale.country}.

YOUR ROLE:
- Generate 3 distinct, platform-neutral post IDEAS (not final formatted posts)
- Each idea must be unique in approach, angle, or focus
- Understand subtle cultural and linguistic nuances of ${language} in ${locale.country}
- Create content that feels natural and authentic to local native speakers

CULTURAL CONTEXT FOR ${locale.country}:
- Formality: ${locale.culturalNorms.formalityLevel}
- Emoji usage: ${locale.culturalNorms.emojiUsage}
- Exclamation limit: max ${locale.culturalNorms.exclamationLimit} per text
${locale.culturalNorms.emphasizeHygge ? '- Emphasize local concepts like "hygge" (cozy, warm atmosphere)' : ''}
${locale.culturalNorms.useImperativeCTA ? '- Use direct imperative CTAs ("Kom forbi!", "Besøg os")' : '- Use softer, inviting CTAs'}

LANGUAGE REQUIREMENTS:
${languageGuidance}

OUTPUT FORMAT (JSON only):
{
  "ideas": [
    {
      "slot_id": "A|B|C - Which slot this idea fills",
      "idea_type": "menu|vibe|occasion - Type of content",
      "menu_item": {"name": "Item name", "category": "CATEGORY"} or null,
      "hook": "Opening line/headline (5-10 words max)",
      "caption_base": "Core message without platform-specific formatting (50-150 words). NO hashtags, NO URLs, NO 'link in bio'.",
      "cta_intent": "book|menu|visit|engage - What action should user take",
      "best_time": "HH:MM - Optimal posting time",
      "impact": "low|medium|high - Expected engagement level",
      "photo_suggestion": "Detailed description of ideal photo/image (20-40 words)"
    }
  ]
}

CRITICAL RULES:
1. Return ONLY valid JSON - no explanations, no markdown, no code blocks
2. Each idea fills ONE slot (A, B, or C) - follow slot constraints EXACTLY
3. Use proper ${language} grammar, idioms, and cultural references
4. Never invent facts - only use provided business information and verified anchors
5. Match the brand voice and tone exactly as specified
6. DO NOT include hashtags, URLs, or platform-specific formatting in caption_base
7. DO NOT write "link in bio" or booking URLs - those will be added by platform formatter
8. Focus on the core message and emotional appeal
9. Consider weather, season, and time context for relevance
10. Never use forbidden terms or make unverified claims

SLOT COMPLIANCE:
You will receive a 3-SLOT PLAN with explicit constraints for each idea.
Each slot specifies: type, daypart, required elements, and forbidden elements.
Follow each slot's constraints EXACTLY - deviation will result in rejection.`
}

function getLanguageGuidance(language: string, locale: ReturnType<typeof getLocaleConfig>): string {
  const languageConfig = getLanguageConfig(language)
  
  // Return centralized language guidance with locale-specific customizations
  let guidance = languageConfig.languageGuidance
  
  // Add locale-specific rules if configured
  if (locale.languageRules.avoidAmericanisms) {
    guidance += '\n- Strictly avoid American marketing language and expressions'
  }
  if (locale.languageRules.allowEnglishLoanWords) {
    guidance += '\n- Natural English loan words are acceptable (brunch, toast, smoothie) but always in native language context'
  }
  
  return guidance
}

export function buildUserPrompt(context: GenerationContext, ideaPlan?: IdeaPlan, legacyPlan?: GenerationPlan): string {
  const sections: string[] = []
  
  // IdeaPlan (new 3-slot system with BrandPolicy) - goes first for highest priority
  if (ideaPlan) {
    sections.push(formatIdeaPlanForPrompt(ideaPlan))
    sections.push('\n' + formatPolicyForPrompt(ideaPlan.policy))
  }
  // Legacy GenerationPlan (backward compatibility)
  else if (legacyPlan) {
    sections.push(formatPlanForPrompt(legacyPlan))
    // Business profile
    sections.push(formatBusinessProfileForPrompt(context.businessProfile))
  }
  
  // Menu (only if not using IdeaPlan, which includes menu in slots)
  if (!ideaPlan && context.menuCatalog.items.length > 0) {
    sections.push('\n' + formatMenuForPrompt(context.menuCatalog))
    
    // Get locale-aware menu category guidance
    const menuGuidance = getMenuCategoryGuidance(
      context.menuCatalog.items,
      context.language,
      context.businessProfile.country || 'DK'
    )
    
    if (menuGuidance) {
      sections.push(menuGuidance)
    }
    
    // Add explicit category assignments (OPTION C: Mixed Strategy)
    sections.push('\n=== SUGGESTION STRATEGY (MANDATORY) ===')
    sections.push('You MUST follow this exact assignment pattern:')
    sections.push('')
    
    // Find categories available in menu
    const categories = [...new Set(context.menuCatalog.items.map(i => i.category))]
    const availableByDaypart = {
      breakfast: context.menuCatalog.getAllowedItemsForDaypart('breakfast'),
      lunch: context.menuCatalog.getAllowedItemsForDaypart('lunch'),
      dinner: context.menuCatalog.getAllowedItemsForDaypart('dinner'),
      lateNight: context.menuCatalog.getAllowedItemsForDaypart('lateNight')
    }
    
    // Strategy: 2 menu-focused + 1 lifestyle/vibe
    // Pick two different meal periods that have items
    const assignedCategories: string[] = []
    
    if (availableByDaypart.breakfast.length > 0) {
      const breakfastCats = [...new Set(availableByDaypart.breakfast.map(i => i.category))]
      sections.push(`Suggestion #1: MUST feature item from breakfast categories`)
      sections.push(`  Available categories: ${breakfastCats.join(', ')}`)
      sections.push(`  Available items: ${availableByDaypart.breakfast.map(i => i.name).slice(0, 10).join(', ')}${availableByDaypart.breakfast.length > 10 ? '...' : ''}`)
      assignedCategories.push('breakfast')
    }
    
    if (availableByDaypart.lunch.length > 0 && assignedCategories.length < 2) {
      const lunchCats = [...new Set(availableByDaypart.lunch.map(i => i.category))]
      sections.push(`\nSuggestion #${assignedCategories.length + 1}: MUST feature item from lunch categories`)
      sections.push(`  Available categories: ${lunchCats.join(', ')}`)
      sections.push(`  Available items: ${availableByDaypart.lunch.map(i => i.name).slice(0, 10).join(', ')}${availableByDaypart.lunch.length > 10 ? '...' : ''}`)
      assignedCategories.push('lunch')
    }
    
    if (availableByDaypart.dinner.length > 0 && assignedCategories.length < 2) {
      const dinnerCats = [...new Set(availableByDaypart.dinner.map(i => i.category))]
      sections.push(`\nSuggestion #${assignedCategories.length + 1}: MUST feature item from dinner categories`)
      sections.push(`  Available categories: ${dinnerCats.join(', ')}`)
      sections.push(`  Available items: ${availableByDaypart.dinner.map(i => i.name).slice(0, 10).join(', ')}${availableByDaypart.dinner.length > 10 ? '...' : ''}`)
      assignedCategories.push('dinner')
    }
    
    // Always add lifestyle suggestion
    sections.push(`\nSuggestion #3: Lifestyle/vibe/experience post (NO specific menu item required)`)
    sections.push(`  Focus: Brand values, atmosphere, customer experience, or seasonal theme`)
    sections.push(`  Do NOT include menuItemUsed field for this suggestion`)
    
    sections.push('')
    sections.push('CRITICAL ENFORCEMENT:')
    sections.push('- Each menu suggestion MUST use items from its ASSIGNED categories ONLY')
    sections.push('- Using items from wrong categories will result in REJECTION')
    sections.push('- Lifestyle suggestion MUST NOT include menuItemUsed field')
    sections.push('- This is deterministic validation - there are no exceptions')
  }
  
  // Weather context
  if (context.weather) {
    sections.push(formatWeatherForPrompt(context.weather))
  }
  
  // Previous posts for learning
  if (context.previousPosts && context.previousPosts.length > 0) {
    sections.push(formatPreviousPostsForPrompt(context.previousPosts))
  }
  
  // Current context
  const now = new Date()
  const month = now.toLocaleString(context.language === 'da' ? 'da-DK' : 'default', { month: 'long' })
  const dayOfWeek = now.toLocaleString(context.language === 'da' ? 'da-DK' : 'default', { weekday: 'long' })
  
  sections.push(`\n=== CURRENT CONTEXT ===`)
  sections.push(`Date: ${dayOfWeek}, ${now.getDate()}. ${month} ${now.getFullYear()}`)
  sections.push(`Time: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
  
  // Season
  const month_num = now.getMonth() + 1
  let season = 'spring'
  if (month_num >= 6 && month_num <= 8) season = 'summer'
  else if (month_num >= 9 && month_num <= 11) season = 'autumn'
  else if (month_num === 12 || month_num <= 2) season = 'winter'
  sections.push(`Season: ${season}`)
  
  sections.push(`\n=== YOUR TASK ===`)
  sections.push(`Generate 3 diverse, high-quality post suggestions that:`)
  sections.push(`1. Match the brand voice and tone perfectly`)
  sections.push(`2. Feel authentic and natural in ${context.language}`)
  sections.push(`3. Consider current weather, season, and time of day`)
  sections.push(`4. Feature menu items where relevant (but not forced)`)
  sections.push(`5. Learn from successful previous posts`)
  sections.push(`6. Are substantively different from each other`)
  sections.push(`\nReturn ONLY the JSON object - no other text.`)
  
  return sections.join('\n')
}
