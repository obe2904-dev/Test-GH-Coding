// Validators for content quality with graceful degradation
import { 
  PostIdea, 
  BusinessProfile, 
  MenuCatalog, 
  ValidationError, 
  ValidationResult,
  IdeaWithMetadata,
  IdeaPlan, 
  BrandPolicy, 
  PreviousPost, 
  PostFingerprint 
} from '../types.ts'
import { validateMenuItemInContext } from '../policies/menu-rules.ts'
import { isAllowedOffering, isVerifiedAnchor } from '../policies/brand-policy-compiler.ts'
import { 
  isNovel, 
  extractPreviousPostsFingerprints,
  getNoveltyReport 
} from './novelty-checker.ts'
import { generateFallbackIdea } from './fallback-generator.ts'
import { detectEnglishLeakage, detectEnglishPhrases } from './language-validator.ts'

/**
 * Validate suggestions with graceful degradation
 * Returns ideas with metadata instead of throwing on errors
 * @returns Array of ideas with validation metadata - never empty if input is not empty
 */
export function validateSuggestionsWithMetadata(
  ideas: PostIdea[],
  businessProfile: BusinessProfile,
  menuCatalog: MenuCatalog,
  ideaPlan?: IdeaPlan,
  previousPosts?: PreviousPost[]
): IdeaWithMetadata[] {
  // Extract fingerprints from previous posts for novelty checking
  const previousFingerprints: PostFingerprint[] = previousPosts && ideaPlan?.policy
    ? extractPreviousPostsFingerprints(previousPosts, ideaPlan.policy)
    : []

  const results: IdeaWithMetadata[] = []

  for (const idea of ideas) {
    const validation = validateSingleIdea(
      idea,
      businessProfile,
      menuCatalog,
      ideaPlan,
      previousFingerprints
    )

    // Classify severity
    const severity = classifyValidationSeverity(validation.errors)

    if (severity === 'critical') {
      // Generate fallback template
      if (!ideaPlan || !idea.slot_id) {
        console.error('❌ Cannot generate fallback without IdeaPlan and slot_id')
        continue  // Skip this idea entirely
      }

      console.log(`⚠️  Critical validation errors for ${idea.slot_id}, generating fallback template`)
      const fallbackIdea = generateFallbackIdea(idea.slot_id, ideaPlan, businessProfile)
      
      results.push({
        idea: fallbackIdea,
        metadata: {
          source: 'fallback_template',
          quality: 'standard',
          validation_status: 'fallback',
          template_type: idea.idea_type === 'menu' ? 'menu_spotlight' 
            : idea.idea_type === 'vibe' ? 'vibe_reminder'
            : 'occasion_prompt',
          original_error: validation.errors.map(e => e.message).join('; '),
          warnings: []
        }
      })
    } else if (severity === 'fixable') {
      // Auto-fix the idea
      const fixedIdea = applyAutoFixes(idea, validation)
      
      results.push({
        idea: fixedIdea,
        metadata: {
          source: 'auto_fixed',
          quality: 'high',
          validation_status: 'auto_fixed',
          fixes_applied: validation.errors.map(e => ({
            type: e.field,
            description: e.message
          })),
          warnings: validation.warnings.map(w => w.message)
        }
      })
    } else {
      // Valid or warnings only
      results.push({
        idea,
        metadata: {
          source: 'ai',
          quality: 'high',
          validation_status: validation.warnings.length > 0 ? 'valid_with_warnings' : 'valid',
          warnings: validation.warnings.map(w => w.message)
        }
      })
    }
  }

  return results
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use validateSuggestionsWithMetadata instead
 */
export function validateSuggestions(
  ideas: PostIdea[],
  businessProfile: BusinessProfile,
  menuCatalog: MenuCatalog,
  ideaPlan?: IdeaPlan,
  previousPosts?: PreviousPost[]
): ValidationError[] {
  const errors: ValidationError[] = []

  // Extract fingerprints from previous posts for novelty checking
  const previousFingerprints: PostFingerprint[] = previousPosts && ideaPlan?.policy
    ? extractPreviousPostsFingerprints(previousPosts, ideaPlan.policy)
    : []

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    const prefix = `Idea ${i + 1}`
    
    const validation = validateSingleIdea(idea, businessProfile, menuCatalog, ideaPlan, previousFingerprints, prefix)
    errors.push(...validation.errors)
    errors.push(...validation.warnings)
  }

  // Validate diversity across ideas
  const diversityErrors = validateDiversity(ideas)
  errors.push(...diversityErrors)

  return errors
}

/**
 * Validate a single idea and return structured result
 */
function validateSingleIdea(
  idea: PostIdea,
  businessProfile: BusinessProfile,
  menuCatalog: MenuCatalog,
  ideaPlan: IdeaPlan | undefined,
  previousFingerprints: PostFingerprint[],
  prefix: string = 'Idea'
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
    
    // If using IdeaPlan, validate slot compliance
    if (ideaPlan && idea.slot_id) {
      const slot = ideaPlan.slots.find(s => s.slot_id === idea.slot_id)
      if (slot) {
        const slotValidation = validateSlotCompliance(idea, slot, ideaPlan.policy, menuCatalog, prefix)
        errors.push(...slotValidation.errors)
        warnings.push(...slotValidation.warnings)
      }
    }

    // NOVELTY CHECK: Ensure idea differs from previous posts on at least 2 dimensions
    if (previousFingerprints.length > 0) {
      const noveltyCheck = isNovel(idea, previousFingerprints, 2)
      
      if (!noveltyCheck.novel) {
        // Get detailed report for debugging
        const report = getNoveltyReport(idea, previousFingerprints)
        
        console.log(`⚠️  Novelty check failed for ${prefix}:`, {
          reason: noveltyCheck.reason,
          fingerprint: report.fingerprint,
          comparisonDetails: report.comparisonDetails
        })
        
        warnings.push({
          field: `${prefix}.novelty`,
          message: `Content too similar to recent posts. ${noveltyCheck.reason}`,
          severity: 'warning'  // Warning, not error - AI can still be creative
        })
      } else {
        console.log(`✅ Novelty check passed for ${prefix}`)
      }
    }

    // Required fields
    if (!idea.hook || idea.hook.trim().length === 0) {
      errors.push({
        field: `${prefix}.hook`,
        message: 'Hook is required',
        severity: 'error'
      })
    }

    if (!idea.caption_base || idea.caption_base.trim().length === 0) {
      errors.push({
        field: `${prefix}.caption_base`,
        message: 'Caption base is required',
        severity: 'error'
      })
    }

    if (!idea.photo_suggestion || idea.photo_suggestion.trim().length === 0) {
      errors.push({
        field: `${prefix}.photo_suggestion`,
        message: 'Photo suggestion is required',
        severity: 'error'
      })
    }

    // LANGUAGE VALIDATION: Detect English leakage in non-English content
    if (ideaPlan?.policy) {
      const language = ideaPlan.policy.language
      const fullText = `${idea.hook} ${idea.caption_base}`
      
      // Token-level detection
      const tokenLeakage = detectEnglishLeakage(fullText, language)
      if (tokenLeakage.hasLeakage) {
        const severity = tokenLeakage.severity === 'major' ? 'error' : 'warning'
        
        errors.push({
          field: `${prefix}.language`,
          message: `English leakage detected (${tokenLeakage.severity}): ${tokenLeakage.englishTokens.join(', ')}. ${tokenLeakage.recommendation}`,
          severity
        })
        
        console.log(`🚨 Language leakage in ${prefix}:`, {
          severity: tokenLeakage.severity,
          tokens: tokenLeakage.englishTokens,
          text: fullText.substring(0, 100)
        })
      }
      
      // Phrase-level detection (more specific patterns)
      const phraseLeakage = detectEnglishPhrases(fullText, language)
      if (phraseLeakage.found.length > 0) {
        errors.push({
          field: `${prefix}.language`,
          message: `English phrases detected: ${phraseLeakage.found.join(', ')}. Suggestions: ${Object.entries(phraseLeakage.suggestions).map(([en, local]) => `"${en}" → "${local}"`).join(', ')}`,
          severity: 'error'
        })
        
        console.log(`🚨 English phrases in ${prefix}:`, {
          found: phraseLeakage.found,
          suggestions: phraseLeakage.suggestions
        })
      }
    }

    // Validate impact
    if (!['low', 'medium', 'high'].includes(idea.impact)) {
      errors.push({
        field: `${prefix}.impact`,
        message: `Invalid impact value: ${idea.impact}`,
        severity: 'error'
      })
    }

    // Validate idea_type
    if (!['menu', 'vibe', 'occasion', 'moment'].includes(idea.idea_type)) {
      errors.push({
        field: `${prefix}.idea_type`,
        message: `Invalid idea_type: ${idea.idea_type}`,
        severity: 'error'
      })
    }

    // Validate cta_intent
    if (!['book', 'menu', 'visit', 'engage'].includes(idea.cta_intent)) {
      errors.push({
        field: `${prefix}.cta_intent`,
        message: `Invalid cta_intent: ${idea.cta_intent}`,
        severity: 'error'
      })
    }

    // Validate caption_base length
    const captionLength = idea.caption_base.trim().length
    if (captionLength < 20) {
      errors.push({
        field: `${prefix}.caption_base`,
        message: `Caption too short: ${captionLength} characters (minimum 20)`,
        severity: 'error'
      })
    }
    if (captionLength > 500) {
      warnings.push({
        field: `${prefix}.caption_base`,
        message: `Caption too long: ${captionLength} characters (maximum 500)`,
        severity: 'warning'
      })
    }

    // TONE VALIDATION: Check if content matches specified tone
    if (ideaPlan?.policy?.voice_rules?.tone && ideaPlan.policy.voice_rules.tone.length > 0) {
      const fullText = `${idea.hook} ${idea.caption_base}`.toLowerCase()
      const toneKeywords = ideaPlan.policy.voice_rules.tone.map(t => t.toLowerCase())
      
      // Check if ANY tone keyword appears in the text
      const matchingTones = toneKeywords.filter(tone => fullText.includes(tone))
      
      // If no tone keywords found, it might not match the brand voice
      if (matchingTones.length === 0) {
        warnings.push({
          field: `${prefix}.tone`,
          message: `Tone may not match brand voice. Expected tone keywords: ${toneKeywords.join(', ')}. Consider if content captures the ${toneKeywords[0]} feeling.`,
          severity: 'warning'
        })
        
        console.log(`⚠️  Tone check for ${prefix}:`, {
          expectedTones: toneKeywords,
          matchingTones: matchingTones,
          textSample: fullText.substring(0, 100)
        })
      } else {
        console.log(`✅ Tone check passed for ${prefix}: matched ${matchingTones.join(', ')}`)
      }
    }

    // Validate forbidden terms
    if (businessProfile.forbidden_terms && businessProfile.forbidden_terms.length > 0) {
      const captionLower = idea.caption_base.toLowerCase()
      const hookLower = idea.hook.toLowerCase()
      
      for (const term of businessProfile.forbidden_terms) {
        const termLower = term.toLowerCase()
        if (captionLower.includes(termLower) || hookLower.includes(termLower)) {
          errors.push({
            field: `${prefix}.caption_base`,
            message: `Contains forbidden term: "${term}"`,
            severity: 'error'
          })
        }
      }
    }

    // Validate menu item if specified - use catalog and policy validation
    if (idea.menu_item && idea.menu_item.name && idea.menu_item.name.trim().length > 0) {
      // 1. Check if item exists in catalog
      const menuItem = menuCatalog.items.find(item => 
        item.name.toLowerCase() === idea.menu_item!.name.toLowerCase() ||
        item.raw_line.toLowerCase().includes(idea.menu_item!.name.toLowerCase())
      )
      
      if (!menuItem) {
        // Provide helpful warning with available items (not blocking)
        const availableItems = menuCatalog.items.map(i => i.name).slice(0, 10).join(', ')
        warnings.push({
          field: `${prefix}.menu_item`,
          message: `Menu item "${idea.menu_item.name}" not found in catalog. Available: ${availableItems}${menuCatalog.items.length > 10 ? '...' : ''}`,
          severity: 'warning'
        })
      } else {
        // 2. Use policy to validate daypart match
        const validation = validateMenuItemInContext(
          menuItem,
          idea.best_time,
          idea.caption_base,
          businessProfile.primary_language,
          businessProfile.country || 'DK'
        )
        
        if (!validation.valid) {
          warnings.push({
            field: `${prefix}.menu_item`,
            message: validation.reason || `Invalid menu item for context`,
            severity: 'warning'
          })
          
          // Add suggested fix if available
          if (validation.suggestedFix) {
            warnings.push({
              field: `${prefix}.menu_item`,
              message: `Suggestion: ${validation.suggestedFix}`,
              severity: 'warning'
            })
          }
        }
      }
    }

    // Validate language compliance (basic checks)
    const languageValidation = validateLanguageCompliance(
      idea,
      businessProfile.primary_language,
      prefix
    )
    errors.push(...languageValidation.errors)
    warnings.push(...languageValidation.warnings)

  // Determine validity and fixability
  const valid = errors.length === 0
  const severity = classifyValidationSeverity(errors)
  const fixable = severity === 'fixable'

  return {
    valid,
    severity,
    errors,
    warnings,
    fixable,
    fixes: fixable ? errors.map(e => ({ type: e.field, description: e.message })) : undefined
  }
}

/**
 * Classify validation errors by severity
 * - critical: Must use fallback template (forbidden terms, missing required fields)
 * - fixable: Can auto-fix (capitalization, minor formatting)
 * - warning: Non-blocking issues (suggestions, optimizations)
 */
function classifyValidationSeverity(errors: ValidationError[]): 'critical' | 'fixable' | 'warning' {
  if (errors.length === 0) return 'warning'

  // Critical errors that require fallback
  const criticalFields = ['hook', 'caption_base', 'photo_suggestion', 'idea_type', 'cta_intent', 'impact']
  const hasCriticalError = errors.some(e => 
    criticalFields.some(field => e.field.includes(field)) ||
    e.message.includes('forbidden term') ||
    e.message.includes('required')
  )

  if (hasCriticalError) return 'critical'

  // Fixable errors (mostly warnings)
  return 'fixable'
}

/**
 * Apply automatic fixes to an idea
 */
function applyAutoFixes(idea: PostIdea, validation: ValidationResult): PostIdea {
  const fixed = { ...idea }

  // Apply fixes based on error types
  for (const error of validation.errors) {
    // Length fixes
    if (error.message.includes('too long')) {
      if (error.field.includes('caption_base')) {
        fixed.caption_base = fixed.caption_base.substring(0, 497) + '...'
      }
    }
  }

  return fixed
}

/**
 * Validate diversity across multiple ideas
 */
function validateDiversity(ideas: PostIdea[]): ValidationError[] {
  const errors: ValidationError[] = []

  if (ideas.length < 2) return errors

  // Check for near-identical hooks
  for (let i = 0; i < ideas.length; i++) {
    for (let j = i + 1; j < ideas.length; j++) {
      const similarity = calculateSimilarity(
        ideas[i].hook,
        ideas[j].hook
      )
      
      if (similarity > 0.7) {
        errors.push({
          field: `ideas.diversity`,
          message: `Ideas ${i + 1} and ${j + 1} have very similar hooks`,
          severity: 'warning'
        })
      }
    }
  }

  // Check if all ideas use same menu item (if menu exists)
  const menuItems = ideas
    .map(i => i.menu_item?.name)
    .filter(item => item && item.trim().length > 0)
  
  if (menuItems.length > 1) {
    const allSame = menuItems.every(item => item === menuItems[0])
    if (allSame) {
      errors.push({
        field: 'ideas.diversity',
        message: 'All ideas feature the same menu item - lacks diversity',
        severity: 'warning'
      })
    }
  }

  return errors
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/)
  const words2 = str2.toLowerCase().split(/\s+/)
  
  const common = words1.filter(word => words2.includes(word)).length
  const total = Math.max(words1.length, words2.length)
  
  return common / total
}

/**
 * Validate language compliance
 */
function validateLanguageCompliance(
  idea: PostIdea,
  language: string,
  prefix: string
): { errors: ValidationError[], warnings: ValidationError[] } {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const caption = idea.caption_base.toLowerCase()
  const hook = idea.hook.toLowerCase()

  // Danish-specific validation
  if (language === 'da' || language === 'danish' || language === 'dansk') {
    // Check for obvious English phrases that indicate translation errors
    // Focus on phrases that would never appear naturally in Danish text
    const problematicPhrases = [
      { english: 'by the river', danish: 'ved åen' },
      { english: 'at the', danish: 'ved/på' },
      { english: 'in the', danish: 'i' },
      { english: 'on the', danish: 'på' },
      { english: 'with our', danish: 'med vores' },
      { english: 'for you', danish: 'til dig' },
      { english: 'come and', danish: 'kom og' },
      { english: 'try our', danish: 'prøv vores' }
    ]
    
    for (const phrase of problematicPhrases) {
      if (caption.includes(phrase.english) || hook.includes(phrase.english)) {
        errors.push({
          field: `${prefix}.caption_base`,
          message: `Contains English phrase "${phrase.english}" - should use Danish "${phrase.danish}"`,
          severity: 'error'
        })
      }
    }

    // Check for standalone English article "the" at start of phrases (very obvious error)
    if (caption.match(/\bthe\s+\w+/i) || hook.match(/\bthe\s+\w+/i)) {
      warnings.push({
        field: `${prefix}.caption_base`,
        message: `Contains English article "the" - should use Danish`,
        severity: 'warning'
      })
    }

    // Warn about excessive exclamation points (not Danish style)
    const exclamationCount = (caption.match(/!/g) || []).length
    if (exclamationCount > 1) {
      warnings.push({
        field: `${prefix}.caption_base`,
        message: `Too many exclamation points (${exclamationCount}) - not typical Danish style`,
        severity: 'warning'
      })
    }
  }

  return { errors, warnings }
}

/**
 * Validate slot-specific compliance
 * Checks if PostIdea meets the constraints of its assigned IdeaSlot
 */
function validateSlotCompliance(
  idea: PostIdea,
  slot: IdeaPlan['slots'][0],
  policy: BrandPolicy,
  menuCatalog: MenuCatalog,
  prefix: string
): { errors: ValidationError[], warnings: ValidationError[] } {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  
  // Check idea_type matches slot (WARNING - not blocking)
  if (idea.idea_type !== slot.idea_type) {
    warnings.push({
      field: `${prefix}.idea_type`,
      message: `Slot ${slot.slot_id} expects idea_type='${slot.idea_type}', got '${idea.idea_type}'`,
      severity: 'warning'
    })
  }
  
  // Check menu item requirement
  if (slot.must_include.menu_item) {
    if (!idea.menu_item || !idea.menu_item.name) {
      warnings.push({
        field: `${prefix}.menu_item`,
        message: `Slot ${slot.slot_id} expects a menu item but none provided`,
        severity: 'warning'
      })
    } else {
      // Verify menu item exists in catalog
      const menuItem = menuCatalog.items.find(item => 
        item.name.toLowerCase() === idea.menu_item!.name.toLowerCase()
      )
      
      if (!menuItem) {
        warnings.push({
          field: `${prefix}.menu_item`,
          message: `Menu item "${idea.menu_item.name}" not found in catalog (slot ${slot.slot_id})`,
          severity: 'warning'
        })
      }
      
      // Check category restriction (WARNING - not blocking)
      if (menuItem && slot.allowed_categories && slot.allowed_categories.length > 0) {
        if (!slot.allowed_categories.includes(menuItem.category)) {
          warnings.push({
            field: `${prefix}.menu_item.category`,
            message: `Slot ${slot.slot_id} prefers categories [${slot.allowed_categories.join(', ')}], got '${menuItem.category}'`,
            severity: 'warning'
          })
        }
      }
      
      // Check daypart match if specified (WARNING - only if daypart_tags exist)
      if (slot.daypart && menuItem && menuItem.daypart_tags && menuItem.daypart_tags.length > 0) {
        if (!menuItem.daypart_tags.includes(slot.daypart)) {
          warnings.push({
            field: `${prefix}.menu_item`,
            message: `Menu item "${menuItem.name}" may not be ideal for ${slot.daypart} (slot ${slot.slot_id})`,
            severity: 'warning'
          })
        }
      }
    }
  }
  
  // Check offerings allowlist for non-menu posts (WARNING - not blocking)
  if (slot.must_avoid.unverified_claims && slot.idea_type !== 'menu') {
    const content = `${idea.hook} ${idea.caption_base}`.toLowerCase()
    
    // Extract potential offering mentions (simple keyword check)
    const suspiciousTerms = [
      'cocktail', 'vin', 'wine', 'øl', 'beer', 'drinks',
      'dessert', 'kage', 'cake'
    ]
    
    for (const term of suspiciousTerms) {
      if (content.includes(term)) {
        if (!isAllowedOffering(term, policy)) {
          warnings.push({
            field: `${prefix}.caption_base`,
            message: `Mentions "${term}" which may not be in verified offerings (slot ${slot.slot_id})`,
            severity: 'warning'
          })
        }
      }
    }
  }
  
  // Check verified anchors requirement (WARNING - not blocking)
  if (slot.must_include.anchors && slot.must_include.anchors.length > 0) {
    const content = `${idea.hook} ${idea.caption_base}`.toLowerCase()
    let foundAnchor = false
    
    for (const anchor of slot.must_include.anchors) {
      if (content.includes(anchor.toLowerCase())) {
        foundAnchor = true
        break
      }
    }
    
    if (!foundAnchor) {
      warnings.push({
        field: `${prefix}.caption_base`,
        message: `Slot ${slot.slot_id} expected a verified anchor: ${slot.must_include.anchors.slice(0, 2).join(', ')}`,
        severity: 'warning'
      })
    }
  }
  
  // ANCHOR PROVENANCE CHECK: Ensure no generic anchors are used
  // Check for generic phrases that should NOT be treated as verified
  const content = `${idea.hook} ${idea.caption_base}`.toLowerCase()
  const genericPhrases = [
    'hyggelig atmosfære', 'cozy atmosphere', 'nice atmosphere',
    'god stemning', 'good vibes', 'great atmosphere',
    'hyggelig', 'cozy', 'nice', 'lovely'  // Solo generic adjectives
  ]
  
  for (const genericPhrase of genericPhrases) {
    if (content.includes(genericPhrase.toLowerCase())) {
      warnings.push({
        field: `${prefix}.anchors`,
        message: `Generic phrase "${genericPhrase}" used - too generic to be considered verified. Use specific verified anchors only.`,
        severity: 'warning'
      })
      
      console.log(`⚠️  Generic anchor detected in ${prefix}: "${genericPhrase}"`)
    }
  }
  
  // If policy has new VerifiedAnchors structure, validate provenance
  if (policy.verified_anchors && Array.isArray(policy.verified_anchors.location)) {
    // Check that any location/interior/experience claims are from high-confidence, non-generic sources
    const allAnchors = [
      ...(policy.verified_anchors.location || []),
      ...(policy.verified_anchors.interior || []),
      ...(policy.verified_anchors.experience || [])
    ]
    
    // Check for use of low-confidence or generic anchors
    for (const anchor of allAnchors) {
      if (anchor.source === 'generic' || anchor.confidence === 'low') {
        if (content.includes(anchor.text.toLowerCase())) {
          errors.push({
            field: `${prefix}.anchors`,
            message: `Using generic/unverified anchor "${anchor.text}" (source: ${anchor.source}, confidence: ${anchor.confidence}). Only use high-confidence verified anchors.`,
            severity: 'error'
          })
          
          console.log(`🚨 Generic anchor used in ${prefix}:`, {
            text: anchor.text,
            source: anchor.source,
            confidence: anchor.confidence
          })
        }
      }
    }
  }
  
  return { errors, warnings }
