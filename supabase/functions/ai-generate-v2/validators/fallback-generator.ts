// Deterministic fallback template generator for failed validations
// Generates brand-compliant post ideas without AI when validation fails

import { PostIdea, IdeaSlot, IdeaPlan, BusinessProfile, MenuItem } from '../types.ts'
import { getLanguageConfig } from '../config/language-configs.ts'

/**
 * Generate a fallback post idea using deterministic templates
 * Used when AI-generated content fails critical validation
 * 
 * @param slotId - Which slot failed (A, B, or C)
 * @param ideaPlan - Full idea plan with slots and policy
 * @param businessProfile - Business context
 * @returns Deterministic, brand-compliant PostIdea
 */
export function generateFallbackIdea(
  slotId: string,
  ideaPlan: IdeaPlan,
  businessProfile: BusinessProfile
): PostIdea {
  const slot = ideaPlan.slots.find(s => s.slot_id === slotId)
  
  if (!slot) {
    throw new Error(`Slot ${slotId} not found in IdeaPlan`)
  }

  // Generate based on slot type
  switch (slot.idea_type) {
    case 'menu':
      return generateMenuFallback(slot, ideaPlan, businessProfile)
    case 'vibe':
      return generateVibeFallback(slot, ideaPlan, businessProfile)
    case 'occasion':
      return generateOccasionFallback(slot, ideaPlan, businessProfile)
    default:
      throw new Error(`Unknown slot type: ${slot.idea_type}`)
  }
}

/**
 * Generate menu spotlight fallback template
 * Uses locale-specific templates (NO ENGLISH)
 */
function generateMenuFallback(
  slot: IdeaSlot,
  ideaPlan: IdeaPlan,
  businessProfile: BusinessProfile
): PostIdea {
  const policy = ideaPlan.policy
  const language = policy.language || 'da'
  const config = getLanguageConfig(language)
  const templates = config.templates
  
  // Get a menu item name from slot constraints or offerings
  let menuItemName = slot.must_include.menu_item?.name
  
  if (!menuItemName) {
    // Extract from offerings or use generic
    const offerings = policy.offerings?.exact || policy.offerings_allowlist || []
    const foodTerms = offerings.filter(term => 
      !['drikkevarer', 'drinks', 'beverages'].some(drink => term.toLowerCase().includes(drink))
    )
    menuItemName = foodTerms[0] || offerings[0] || (language === 'da' ? 'vores specialitet' : 
                                                      language === 'sv' ? 'vår specialitet' : 
                                                      'unsere Spezialität')
  }
  
  // Get location anchor
  const locationAnchors = policy.verified_anchors.location || []
  const anchor = locationAnchors[0] || ''
  
  // Build caption using locale template
  const emoji = getEmoji('food')
  const hook = `${capitalizeFirst(menuItemName)} ${emoji}`
  
  const captionBase = templates.menu_spotlight.caption(menuItemName, anchor, slot.reasoning)

  return {
    idea_type: 'menu',
    menu_item: { name: menuItemName, category: slot.must_include.menu_item?.category || 'GENERAL' },
    hook,
    caption_base: captionBase,
    cta_intent: slot.cta_intent || 'book',
    best_time: getCurrentTime(),
    impact: 'medium',
    photo_suggestion: `${menuItemName} served on a plate, appetizing presentation, natural lighting`,
    slot_id: slot.slot_id,
    reasoning: `Fallback template for ${slot.slot_id}`
  }
}

/**
 * Generate vibe/experience fallback template
 * Uses locale-specific templates (NO ENGLISH)
 */
function generateVibeFallback(
  slot: IdeaSlot,
  ideaPlan: IdeaPlan,
  businessProfile: BusinessProfile
): PostIdea {
  const policy = ideaPlan.policy
  const language = policy.language || 'da'
  const config = getLanguageConfig(language)
  const templates = config.templates
  
  // Get tone word
  const toneWords = policy.voice_rules.tone || []
  const toneWord = toneWords[0] || (language === 'da' ? 'Velkommen' : 
                                     language === 'sv' ? 'Välkommen' : 
                                     'Willkommen')
  
  // Get interior/location anchor
  const interiorAnchors = policy.verified_anchors.interior || []
  const locationAnchors = policy.verified_anchors.location || []
  const anchor = interiorAnchors[0] || locationAnchors[0] || templates.vibe_reminder.defaultAnchor
  
  // Build caption using locale template
  const emoji = getEmoji('place')
  const hook = `${capitalizeFirst(toneWord)} ${emoji}`
  
  const captionBase = templates.vibe_reminder.caption(anchor, businessProfile.business_name)

  return {
    idea_type: 'vibe',
    menu_item: null,
    hook,
    caption_base: captionBase,
    cta_intent: slot.cta_intent || 'visit',
    best_time: getCurrentTime(),
    impact: 'medium',
    photo_suggestion: `Interior atmosphere shot, cozy ambiance, inviting space`,
    slot_id: slot.slot_id,
    reasoning: `Fallback template for ${slot.slot_id}`
  }
}

/**
 * Generate occasion/ritual fallback template
 * Uses locale-specific templates (NO ENGLISH)
 */
function generateOccasionFallback(
  slot: IdeaSlot,
  ideaPlan: IdeaPlan,
  businessProfile: BusinessProfile
): PostIdea {
  const policy = ideaPlan.policy
  const language = policy.language || 'da'
  const config = getLanguageConfig(language)
  const templates = config.templates
  
  // Get experience anchor or create occasion phrase
  const experienceAnchors = policy.verified_anchors.experience || []
  const occasionPhrase = experienceAnchors[0] || templates.occasion_prompt.defaultOccasion
  
  // Build caption using locale template
  const emoji = getEmoji('time')
  const daypart = slot.daypart || 'default'
  const hookPhrase = templates.occasion_prompt.hookPhrases[daypart as keyof typeof templates.occasion_prompt.hookPhrases] || 
                     templates.occasion_prompt.hookPhrases.default
  const hook = `${hookPhrase} ${emoji}`
  
  const ctaIntent = slot.cta_intent || 'engage'
  const ctaPhrase = templates.occasion_prompt.ctaPhrases[ctaIntent as keyof typeof templates.occasion_prompt.ctaPhrases] || 
                    templates.occasion_prompt.ctaPhrases.visit
  
  const captionBase = templates.occasion_prompt.caption(occasionPhrase, ctaPhrase, businessProfile.business_name)

  return {
    idea_type: 'occasion',
    menu_item: null,
    hook,
    caption_base: captionBase,
    cta_intent: slot.cta_intent || 'engage',
    best_time: getCurrentTime(),
    impact: 'medium',
    photo_suggestion: `Lifestyle shot showing people enjoying the space, warm atmosphere`,
    slot_id: slot.slot_id,
    reasoning: `Fallback template for ${slot.slot_id}`
  }
}

/**
 * Get emoji by category
 */
function getEmoji(category: string): string {
  const emojiMap: Record<string, string[]> = {
    food: ['🍽️', '🥗', '🍴', '😋'],
    place: ['🏠', '✨', '🌿', '💫'],
    time: ['🌙', '☀️', '🕐', '📅']
  }
  
  const emojis = emojiMap[category] || ['✨']
  return emojis[Math.floor(Math.random() * emojis.length)]
}

/**
 * Get current time in HH:MM format
 */
function getCurrentTime(): string {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
  if (!str || str.length === 0) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Get random item from array
 */
function getRandomItem<T>(array: T[]): T | undefined {
  if (!array || array.length === 0) return undefined
  return array[Math.floor(Math.random() * array.length)]
}
