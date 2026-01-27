// Strategy Engine - Pre-decides explicit 3-slot plan with hard constraints
// This ensures predictable variety and prevents AI from guessing

import { GenerationContext, MenuItem, Daypart, IdeaPlan, IdeaSlot, BrandPolicy } from '../types.ts'
import { 
  inferDaypartFromTime, 
  getAllowedDayparts, 
  inferDaypartWithContext,
  type EnhancedDaypartResult 
} from '../policies/menu-rules.ts'
import { getLocaleConfig } from '../policies/locale-config.ts'
import { compileBrandPolicy } from '../policies/brand-policy-compiler.ts'

// DEPRECATED: Use IdeaPlan instead
export interface IdeaRequirement {
  type: 'menu' | 'vibe' | 'moment'
  category?: string  // e.g., "BRUNCH", "FROKOST", "AFTEN"
  daypart?: Daypart  // e.g., "lunch", "dinner"
  menu_items?: MenuItem[]  // Pre-filtered items to choose from
  requirement: string  // Instruction for AI
}

// DEPRECATED: Use IdeaPlan instead
export interface GenerationPlan {
  ideas: IdeaRequirement[]
  reasoning: string  // Why this plan was chosen
}

/**
 * Create explicit 3-slot IdeaPlan with hard constraints
 * Each slot has specific type, daypart, and allowed mentions
 * 
 * ENHANCED: Now timezone + opening hours aware
 */
export function createIdeaPlan(context: GenerationContext): IdeaPlan {
  const locale = getLocaleConfig(context.language, context.businessProfile.country)
  const currentTime = getCurrentTime()
  
  // Use enhanced daypart detection with timezone and opening hours
  const daypartContext = inferDaypartWithContext(
    locale,
    context.businessProfile.timezone,
    context.businessProfile.opening_hours,
    context.businessProfile.business_offerings
  )
  
  console.log(`📋 Creating 3-slot idea plan:`, {
    daypart: daypartContext.daypart,
    isOpen: daypartContext.isOpen,
    businessType: daypartContext.businessType,
    confidence: daypartContext.confidence
  })
  
  // Step 1: Compile BrandPolicy (allowlists + constraints)
  const policy = compileBrandPolicy(context.businessProfile, context.menuCatalog)
  
  // Step 2: Group menu by category
  const menuByCategory = groupMenuByCategory(context.menuCatalog.items)
  const availableCategories = Object.keys(menuByCategory)
  
  // Step 3: Create 3 explicit slots - WITH "BUSINESS CLOSED" HANDLING
  let slots: [IdeaSlot, IdeaSlot, IdeaSlot]
  let strategyReasoning: string
  
  if (!daypartContext.isOpen) {
    // BUSINESS CLOSED - Bias toward "plan later" posts
    console.log(`🚫 Business currently CLOSED - creating anticipation strategy`)
    slots = createClosedBusinessSlots(
      daypartContext,
      menuByCategory,
      availableCategories,
      policy,
      context
    )
    strategyReasoning = `Business closed (opens ${daypartContext.opensAt || daypartContext.nextOpenDay}) - anticipation strategy`
  } else {
    // BUSINESS OPEN - Normal strategy
    const currentDaypart = daypartContext.daypart || 'lunch'
    slots = create3Slots(
      currentDaypart,
      currentTime,
      menuByCategory,
      availableCategories,
      policy,
      context,
      daypartContext
    )
    strategyReasoning = `Business open (${daypartContext.businessType}, ${currentDaypart}) - time-aware 3-slot plan`
  }
  
  return {
    slots,
    policy,
    strategy_reasoning: strategyReasoning
  }
}

/**
 * DEPRECATED: Use createIdeaPlan instead
 * Kept for backward compatibility
 */
export function createGenerationPlan(context: GenerationContext): GenerationPlan {
  const locale = getLocaleConfig(context.language, context.businessProfile.country)
  const currentTime = getCurrentTime()
  const currentDaypart = inferDaypartFromTime(currentTime, locale)
  
  console.log(`📋 Creating generation plan for ${currentDaypart} (${currentTime})`)
  
  // Get menu items by category
  const menuByCategory = groupMenuByCategory(context.menuCatalog.items)
  const availableCategories = Object.keys(menuByCategory)
  
  console.log(`   Available categories: ${availableCategories.join(', ')}`)
  
  // Strategy: Generate diverse mix based on time and available items
  const plan = selectIdeaMix(
    currentDaypart,
    currentTime,
    menuByCategory,
    availableCategories,
    context
  )
  
  return plan
}

/**
 * Create 3 explicit slots with constraints
 * 
 * Slot Strategy:
 * - Slot A: Menu Spotlight (must reference specific menu item from current/adjacent daypart)
 * - Slot B: Vibe/Experience (uses verified anchors only, no menu item required)
 * - Slot C: Occasion/Ritual (situation-rich, may be menu or non-menu)
 * 
 * ENHANCED: Now receives daypartContext for better decision-making
 */
function create3Slots(
  currentDaypart: Daypart,
  currentTime: string,
  menuByCategory: Record<string, MenuItem[]>,
  availableCategories: string[],
  policy: BrandPolicy,
  context: GenerationContext,
  daypartContext?: EnhancedDaypartResult
): [IdeaSlot, IdeaSlot, IdeaSlot] {
  
  // SLOT A: Menu Spotlight (current daypart)
  const slotA = createMenuSlot(
    'A',
    currentDaypart,
    menuByCategory,
    availableCategories,
    policy,
    'current',
    daypartContext
  )
  
  // SLOT B: Vibe/Experience (verified anchors only)
  const slotB = createVibeSlot(
    'B',
    policy,
    context.businessProfile.content_pillars,
    daypartContext
  )
  
  // SLOT C: Occasion (flexible - may use menu or just situation)
  const adjacentDaypart = getAdjacentDaypart(currentDaypart, currentTime)
  const slotC = createOccasionSlot(
    'C',
    adjacentDaypart || currentDaypart,
    menuByCategory,
    availableCategories,
    policy,
    daypartContext
  )
  
  return [slotA, slotB, slotC]
}

/**
 * Create slots for when business is CLOSED
 * Strategy: Build anticipation for next opening
 * 
 * - Slot A: "Coming Soon" menu teaser (what awaits when they open)
 * - Slot B: Vibe/ambiance reminder (keep brand top-of-mind)
 * - Slot C: "Plan Your Visit" occasion (booking/reservation nudge)
 */
function createClosedBusinessSlots(
  daypartContext: EnhancedDaypartResult,
  menuByCategory: Record<string, MenuItem[]>,
  availableCategories: string[],
  policy: BrandPolicy,
  context: GenerationContext
): [IdeaSlot, IdeaSlot, IdeaSlot] {
  
  // Determine what daypart to tease (next opening period)
  const nextDaypart = predictNextDaypart(daypartContext, context.businessProfile.opening_hours)
  
  // SLOT A: Menu teaser for next opening
  const slotA: IdeaSlot = {
    slot_id: 'A',
    idea_type: 'menu',
    daypart: nextDaypart,
    allowed_categories: availableCategories,
    must_include: {
      menu_item: availableCategories.length > 0 ? { category: availableCategories[0] } : undefined,
      time_reference: daypartContext.opensAt 
        ? `Opens at ${daypartContext.opensAt}`
        : `Opens ${daypartContext.nextOpenDay}`
    },
    must_avoid: {
      forbidden_terms: policy.forbidden_terms,
      unverified_claims: true,
      urgent_language: true  // Avoid "hurry", "now", "today"
    },
    cta_intent: 'book',
    reasoning: `Anticipation post - closed now, opens ${daypartContext.opensAt || daypartContext.nextOpenDay}`
  }
  
  // SLOT B: Ambient vibe reminder
  const slotB: IdeaSlot = {
    slot_id: 'B',
    idea_type: 'vibe',
    must_include: {
      anchors: [
        ...(policy.verified_anchors.interior || []).slice(0, 1),
        ...(policy.verified_anchors.experience || []).slice(0, 1)
      ],
      forward_looking: true  // "can't wait to welcome you", "see you soon"
    },
    must_avoid: {
      forbidden_terms: policy.forbidden_terms,
      unverified_claims: true
    },
    cta_intent: 'visit',
    reasoning: `Brand presence - keep top-of-mind while closed`
  }
  
  // SLOT C: Planning occasion
  const slotC: IdeaSlot = {
    slot_id: 'C',
    idea_type: 'occasion',
    daypart: nextDaypart,
    must_include: {
      planning_language: true,  // "planlagt", "book", "reserve"
      time_reference: daypartContext.opensAt || daypartContext.nextOpenDay
    },
    must_avoid: {
      forbidden_terms: policy.forbidden_terms,
      unverified_claims: true,
      urgent_language: true
    },
    cta_intent: 'book',
    reasoning: `Booking nudge - encourage advance planning for next opening`
  }
  
  return [slotA, slotB, slotC]
}

/**
 * Predict most relevant daypart for next opening
 */
function predictNextDaypart(
  daypartContext: EnhancedDaypartResult,
  openingHours?: import('../types.ts').WeekHours
): Daypart {
  // If we know specific opening time, infer daypart from it
  if (daypartContext.opensAt) {
    const [hours] = daypartContext.opensAt.split(':').map(Number)
    if (hours < 11) return 'breakfast'
    if (hours < 15) return 'lunch'
    if (hours < 21) return 'dinner'
    return 'lateNight'
  }
  
  // Otherwise use business type heuristics
  if (daypartContext.businessType === 'cafe') return 'breakfast'
  if (daypartContext.businessType === 'bar') return 'lateNight'
  return 'lunch'  // Default for restaurant/mixed
}

/**
 * Create Menu Spotlight slot
 */
function createMenuSlot(
  slotId: 'A' | 'B' | 'C',
  daypart: Daypart,
  menuByCategory: Record<string, MenuItem[]>,
  availableCategories: string[],
  policy: BrandPolicy,
  timing: 'current' | 'adjacent',
  daypartContext?: EnhancedDaypartResult
): IdeaSlot {
  // Get items for this daypart
  const items = getItemsForDaypart(daypart, menuByCategory)
  const categories = [...new Set(items.map(i => i.category))]
  
  // Fallback: If no categories for this daypart, use all available categories
  const finalCategories = categories.length > 0 ? categories : availableCategories
  
  // Add business context to reasoning if available
  const contextNote = daypartContext 
    ? ` [${daypartContext.businessType}, ${daypartContext.isOpen ? 'open' : 'closed'}]`
    : ''
  
  const slot: any = {
    slot_id: slotId,
    idea_type: 'menu',
    daypart,
    allowed_categories: finalCategories,
    must_include: {
      menu_item: finalCategories.length > 0 ? { category: finalCategories[0] } : undefined
    },
    must_avoid: {
      forbidden_terms: policy.forbidden_terms,
      unverified_claims: true
    },
    cta_intent: daypart === 'breakfast' || daypart === 'lunch' ? 'book' : 'book',
    reasoning: `Menu spotlight for ${timing} ${daypart} (${items.length} items across ${finalCategories.length} categories)${contextNote}`
  }
  
  // Attach actual menu items for prompt formatting
  slot._menuItems = items
  
  return slot
}

/**
 * Create Vibe/Experience slot
 */
function createVibeSlot(
  slotId: 'A' | 'B' | 'C',
  policy: BrandPolicy,
  contentPillars?: string[],
  daypartContext?: EnhancedDaypartResult
): IdeaSlot {
  const verifiedAnchors = [
    ...(policy.verified_anchors.location || []),
    ...(policy.verified_anchors.interior || []),
    ...(policy.verified_anchors.experience || [])
  ]
  
  const contextNote = daypartContext 
    ? ` [${daypartContext.businessType}]`
    : ''
  
  return {
    slot_id: slotId,
    idea_type: 'vibe',
    must_include: {
      anchors: verifiedAnchors.length > 0 ? verifiedAnchors.slice(0, 2) : undefined
    },
    must_avoid: {
      forbidden_terms: policy.forbidden_terms,
      unverified_claims: true
    },
    cta_intent: 'visit',
    reasoning: `Vibe post using verified anchors (${verifiedAnchors.length} available)${contentPillars ? `, themed around: ${contentPillars.slice(0, 2).join(', ')}` : ''}${contextNote}`
  }
}

/**
 * Create Occasion/Ritual slot
 */
function createOccasionSlot(
  slotId: 'A' | 'B' | 'C',
  daypart: Daypart,
  menuByCategory: Record<string, MenuItem[]>,
  availableCategories: string[],
  policy: BrandPolicy,
  daypartContext?: EnhancedDaypartResult
): IdeaSlot {
  // Occasion can reference menu or just situation
  const items = getItemsForDaypart(daypart, menuByCategory)
  const categories = [...new Set(items.map(i => i.category))]
  
  const contextNote = daypartContext 
    ? ` [${daypartContext.businessType}]`
    : ''
  
  return {
    slot_id: slotId,
    idea_type: 'occasion',
    daypart,
    allowed_categories: categories.length > 0 ? categories : undefined,
    must_include: {},  // Flexible - may or may not use menu
    must_avoid: {
      forbidden_terms: policy.forbidden_terms,
      unverified_claims: true
    },
    cta_intent: 'engage',
    reasoning: `Occasion/ritual post for ${daypart} (situation-rich, menu optional)${contextNote}`
  }
}

/**
 * Select the best mix of ideas based on context
 */
function selectIdeaMix(
  currentDaypart: Daypart | null,
  currentTime: string,
  menuByCategory: Record<string, MenuItem[]>,
  availableCategories: string[],
  context: GenerationContext
): GenerationPlan {
  const ideas: IdeaRequirement[] = []
  
  // Strategy 1: Prioritize current daypart + adjacent daypart + vibe
  if (currentDaypart) {
    const currentCategoryItems = getItemsForDaypart(currentDaypart, menuByCategory)
    const adjacentDaypart = getAdjacentDaypart(currentDaypart, currentTime)
    const adjacentCategoryItems = adjacentDaypart 
      ? getItemsForDaypart(adjacentDaypart, menuByCategory)
      : []
    
    // Idea 1: Current daypart (most relevant)
    if (currentCategoryItems.length > 0) {
      const category = currentCategoryItems[0].category
      ideas.push({
        type: 'menu',
        category,
        daypart: currentDaypart,
        menu_items: currentCategoryItems,
        requirement: `Create a post about a ${category} menu item. This is most relevant now (${currentDaypart} time).`
      })
    }
    
    // Idea 2: Adjacent daypart or upcoming meal
    if (adjacentCategoryItems.length > 0) {
      const category = adjacentCategoryItems[0].category
      ideas.push({
        type: 'menu',
        category,
        daypart: adjacentDaypart!,
        menu_items: adjacentCategoryItems,
        requirement: `Create a post about a ${category} menu item. This is for the ${adjacentDaypart} shift.`
      })
    } else if (currentCategoryItems.length > 0) {
      // Fallback: Use another item from current daypart
      ideas.push({
        type: 'menu',
        category: currentCategoryItems[0].category,
        daypart: currentDaypart,
        menu_items: currentCategoryItems,
        requirement: `Create a DIFFERENT post about another ${currentCategoryItems[0].category} menu item.`
      })
    }
    
    // Idea 3: Vibe/atmosphere (no menu item)
    ideas.push({
      type: 'vibe',
      requirement: 'Create an atmosphere/experience post about the venue. NO specific menu item. Focus on ambiance, service, or dining experience.'
    })
    
    return {
      ideas,
      reasoning: `Time-aware strategy: Current ${currentDaypart} (${currentCategoryItems.length} items) + Adjacent ${adjacentDaypart} (${adjacentCategoryItems.length} items) + Vibe`
    }
  }
  
  // Strategy 2: No time context - use variety from available menu
  if (availableCategories.length >= 2) {
    // Pick 2 most distinct categories
    const category1 = availableCategories[0]
    const category2 = availableCategories[Math.floor(availableCategories.length / 2)]
    
    ideas.push({
      type: 'menu',
      category: category1,
      menu_items: menuByCategory[category1],
      requirement: `Create a post about a ${category1} menu item.`
    })
    
    ideas.push({
      type: 'menu',
      category: category2,
      menu_items: menuByCategory[category2],
      requirement: `Create a post about a ${category2} menu item.`
    })
    
    ideas.push({
      type: 'vibe',
      requirement: 'Create an atmosphere/experience post. NO specific menu item.'
    })
    
    return {
      ideas,
      reasoning: `Variety strategy: ${category1} + ${category2} + Vibe`
    }
  }
  
  // Strategy 3: Limited menu - mix menu + vibe + moment
  if (availableCategories.length === 1) {
    const category = availableCategories[0]
    
    ideas.push({
      type: 'menu',
      category,
      menu_items: menuByCategory[category],
      requirement: `Create a post about a ${category} menu item.`
    })
    
    ideas.push({
      type: 'vibe',
      requirement: 'Create an atmosphere/experience post. NO specific menu item.'
    })
    
    ideas.push({
      type: 'moment',
      requirement: 'Create a timely/seasonal post tied to current weather or season. NO specific menu item.'
    })
    
    return {
      ideas,
      reasoning: `Limited menu strategy: ${category} + Vibe + Moment`
    }
  }
  
  // Strategy 4: No menu - all non-menu ideas
  ideas.push({
    type: 'vibe',
    requirement: 'Create an atmosphere/experience post about the venue.'
  })
  
  ideas.push({
    type: 'moment',
    requirement: 'Create a timely/seasonal post tied to current context.'
  })
  
  ideas.push({
    type: 'vibe',
    requirement: 'Create ANOTHER unique atmosphere post (different angle from first vibe post).'
  })
  
  return {
    ideas,
    reasoning: 'No menu strategy: All vibe/moment posts'
  }
}

/**
 * Get menu items suitable for a specific daypart
 */
function getItemsForDaypart(daypart: Daypart, menuByCategory: Record<string, MenuItem[]>): MenuItem[] {
  const items: MenuItem[] = []
  
  for (const [category, categoryItems] of Object.entries(menuByCategory)) {
    const allowedDayparts = getAllowedDayparts(category)
    if (allowedDayparts.includes(daypart)) {
      items.push(...categoryItems)
    }
  }
  
  return items
}

/**
 * Get the adjacent/next relevant daypart based on current time
 */
function getAdjacentDaypart(current: Daypart, time: string): Daypart | null {
  const hour = parseInt(time.split(':')[0])
  
  // Morning (7-10): Current=breakfast, Next=lunch
  if (current === 'breakfast' && hour >= 7 && hour < 11) {
    return 'lunch'
  }
  
  // Late morning (10-12): Current=lunch, Next=dinner
  if (current === 'lunch' && hour >= 10 && hour < 14) {
    return 'dinner'
  }
  
  // Afternoon (14-17): Current=lunch, Next=dinner
  if (current === 'lunch' && hour >= 14 && hour < 17) {
    return 'dinner'
  }
  
  // Evening (17-22): Current=dinner, Next=lateNight
  if (current === 'dinner' && hour >= 17 && hour < 22) {
    return 'lateNight'
  }
  
  // Late night: No next shift
  if (current === 'lateNight') {
    return null
  }
  
  return null
}

/**
 * Group menu items by category
 */
function groupMenuByCategory(items: MenuItem[]): Record<string, MenuItem[]> {
  const grouped: Record<string, MenuItem[]> = {}
  
  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = []
    }
    grouped[item.category].push(item)
  }
  
  return grouped
}

/**
 * Get current time in HH:MM format
 */
function getCurrentTime(): string {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Format IdeaPlan for prompt (slot-specific instructions)
 */
export function formatIdeaPlanForPrompt(plan: IdeaPlan): string {
  const sections: string[] = []
  
  sections.push('=== 3-SLOT GENERATION PLAN (MANDATORY) ===')
  sections.push(`Strategy: ${plan.strategy_reasoning}`)
  sections.push('')
  sections.push('You MUST generate exactly these 3 ideas, one for each slot:')
  sections.push('')
  
  for (const slot of plan.slots) {
    sections.push(`━━━ SLOT ${slot.slot_id}: ${slot.idea_type.toUpperCase()} ━━━`)
    sections.push(`Type: ${slot.idea_type}`)
    if (slot.daypart) {
      sections.push(`Daypart: ${slot.daypart}`)
    }
    
    // Must include
    if (slot.must_include.menu_item) {
      sections.push(``)
      sections.push(`CRITICAL: Must use EXACT menu item name from this list:`)
      sections.push(`(Choose ONE item - use its exact name, do NOT invent variations)`)
      // Show actual available menu items for this slot
      const items = (slot as any)._menuItems || []
      if (items.length > 0) {
        items.slice(0, 15).forEach((item: any) => {
          sections.push(`  • ${item.name}${item.short_desc ? ' - ' + item.short_desc : ''}`)
        })
        if (items.length > 15) {
          sections.push(`  ... and ${items.length - 15} more items`)
        }
      } else {
        sections.push(`  (Category: ${slot.must_include.menu_item.category || 'any'})`)
      }
      if (slot.allowed_categories && slot.allowed_categories.length > 0) {
        sections.push(`Allowed categories: ${slot.allowed_categories.join(', ')}`)
      }
      sections.push(``)
    }
    if (slot.must_include.anchors && slot.must_include.anchors.length > 0) {
      sections.push(`REQUIRED: Must reference at least one verified anchor:`)
      slot.must_include.anchors.forEach(anchor => sections.push(`  - ${anchor}`))
    }
    if (slot.idea_type === 'vibe' && (!slot.must_include.menu_item)) {
      sections.push(`ALLOWED OFFERINGS: ${plan.policy.offerings_allowlist.join(', ')}`)
      sections.push(`Do NOT invent other offerings or claims.`)
    }
    if (slot.idea_type === 'occasion') {
      sections.push(`Focus: Situation, ritual, or usage occasion (menu reference optional)`)
      if (plan.policy.offerings_allowlist.length > 0) {
        sections.push(`Allowed mentions: ${plan.policy.offerings_allowlist.join(', ')}`)
      }
    }
    
    // Must avoid
    if (slot.must_avoid.forbidden_terms.length > 0) {
      sections.push(`FORBIDDEN: ${slot.must_avoid.forbidden_terms.join(', ')}`)
    }
    if (slot.must_avoid.unverified_claims) {
      sections.push(`FORBIDDEN: Unverified location/interior/experience claims`)
    }
    
    sections.push(`CTA Intent: ${slot.cta_intent}`)
    sections.push(`Reasoning: ${slot.reasoning}`)
    sections.push('')
  }
  
  return sections.join('\n')
}

/**
 * DEPRECATED: Use formatIdeaPlanForPrompt instead
 */
export function formatPlanForPrompt(plan: GenerationPlan): string {
  const sections: string[] = []
  
  sections.push('=== GENERATION PLAN (REQUIRED) ===')
  sections.push(`Strategy: ${plan.reasoning}`)
  sections.push('')
  sections.push('You MUST generate these exact 3 ideas:')
  sections.push('')
  
  plan.ideas.forEach((idea, idx) => {
    sections.push(`IDEA ${idx + 1}: ${idea.requirement}`)
    
    if (idea.menu_items && idea.menu_items.length > 0) {
      sections.push(`Available ${idea.category} items to choose from:`)
      idea.menu_items.slice(0, 10).forEach(item => {
        sections.push(`  - ${item.name}${item.short_desc ? ': ' + item.short_desc : ''}`)
      })
      if (idea.menu_items.length > 10) {
        sections.push(`  ... and ${idea.menu_items.length - 10} more items`)
      }
    }
    
    sections.push('')
  })
  
  return sections.join('\n')
}
