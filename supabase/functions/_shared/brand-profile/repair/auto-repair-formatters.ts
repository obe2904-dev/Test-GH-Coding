/**
 * Auto-Repair Formatters (v4.10.0 Phase 1 - Full Spec)
 * 
 * Instead of replacing entire fields with templates, these formatters
 * INJECT missing required components into AI-generated content to fix
 * contract violations while preserving creative output.
 */

export interface RepairResult {
  value: string
  repairs: string[]
  wasRepaired: boolean
}

export interface FormatContext {
  locationHook: string // "ved åen i Aarhus"
  offeringTokens: string[] // ["BRUNCH", "MIDDAG", "COCKTAILS"]
  actionVerbs: string[] // ["skåler", "spiser", "hælder op"]
  menuItems: string[] // Top menu items
  ctaTokens: string[] // CTA phrases
}

/**
 * Auto-repair brand_essence by injecting missing components
 * 
 * Contract:
 * - MUST contain location hook (e.g., "ved åen i Aarhus")
 * - MUST contain exactly one offering token from whitelist
 * 
 * Instead of replacing, we inject missing parts into existing value.
 */
export function repairBrandEssence(value: string, ctx: FormatContext): RepairResult {
  let repaired = value.trim()
  const repairs: string[] = []
  const normalized = repaired.toLowerCase()
  
  // Check 1: Location hook present?
  const hasLocationHook = normalized.includes(ctx.locationHook.toLowerCase())
  
  if (!hasLocationHook && ctx.locationHook) {
    // Inject location hook after venue type or at start
    const venueMatch = repaired.match(/^(Café|Restaurant|Butik|Bar)/i)
    if (venueMatch) {
      repaired = repaired.replace(
        venueMatch[0],
        `${venueMatch[0]} ${ctx.locationHook}`
      )
      repairs.push(`Injected location hook: "${ctx.locationHook}"`)
    } else {
      repaired = `${ctx.locationHook} ${repaired}`
      repairs.push(`Prepended location hook: "${ctx.locationHook}"`)
    }
  }
  
  // Check 2: Offering token present?
  const hasOffering = ctx.offeringTokens.some(token => 
    normalized.includes(token.toLowerCase())
  )
  
  if (!hasOffering && ctx.offeringTokens.length > 0) {
    // Inject best offering token (prefer BRUNCH > MIDDAG > COCKTAILS)
    const bestOffering = ctx.offeringTokens[0].toLowerCase()
    
    // Find good injection point (after "hvor" if present, else before behavioral hook)
    const hvorMatch = repaired.match(/\bhvor\b/i)
    if (hvorMatch && hvorMatch.index !== undefined) {
      const beforeHvor = repaired.substring(0, hvorMatch.index + 4)
      const afterHvor = repaired.substring(hvorMatch.index + 4)
      repaired = `${beforeHvor} ${bestOffering}${afterHvor}`
      repairs.push(`Injected offering after "hvor": "${bestOffering}"`)
    } else {
      // Inject before tempo/behavioral phrases
      const tempoMatch = repaired.match(/\b(i roligt tempo|kan nydes|glide|bliver siddende)/i)
      if (tempoMatch && tempoMatch.index !== undefined) {
        const before = repaired.substring(0, tempoMatch.index)
        const after = repaired.substring(tempoMatch.index)
        repaired = `${before}${bestOffering} ${after}`
        repairs.push(`Injected offering before behavioral hook: "${bestOffering}"`)
      } else {
        // Last resort: append before final period
        repaired = repaired.replace(/\.$/, ` med ${bestOffering}.`)
        repairs.push(`Appended offering: "${bestOffering}"`)
      }
    }
  }
  
  return {
    value: repaired,
    repairs,
    wasRepaired: repairs.length > 0
  }
}

/**
 * Auto-repair tone_of_voice by removing prose and ensuring bullet structure
 * 
 * Contract:
 * - ONLY lines starting with "- " (bullet lines)
 * - ONLY lines starting with "Eksempel: " (example lines)
 * - Optionally lines starting with "Undgå: " (avoid lines)
 * - At least 4 bullet lines and 2 Eksempel lines
 * 
 * Remove any leading prose or invalid lines.
 */
export function repairToneOfVoice(value: string, ctx: FormatContext): RepairResult {
  const lines = value.split('\n').map(l => l.trim()).filter(Boolean)
  const repairs: string[] = []
  
  const validLines: string[] = []
  let bulletCount = 0
  let eksempelCount = 0
  let undgåCount = 0
  
  // Filter to only valid line types
  for (const line of lines) {
    if (line.startsWith('- ')) {
      validLines.push(line)
      bulletCount++
    } else if (line.startsWith('Eksempel: ')) {
      validLines.push(line)
      eksempelCount++
    } else if (line.startsWith('Undgå: ')) {
      validLines.push(line)
      undgåCount++
    } else {
      // Invalid line - removed
      repairs.push(`Removed invalid line: "${line.substring(0, 30)}..."`)
    }
  }
  
  // Ensure minimum counts
  const needsBullets = 4 - bulletCount
  const needsEksempel = 2 - eksempelCount
  
  if (needsBullets > 0) {
    // Add minimal compliant defaults using allowed tokens
    const defaults = [
      `- Brug konkrete detaljer fra menuen (${ctx.menuItems.slice(0, 2).join(', ')})`,
      `- Nævn beliggenheden naturligt (${ctx.locationHook})`,
      `- Hold sproget jordnært og roligt`,
      `- Brug du-form og direkte tiltale`
    ]
    for (let i = 0; i < needsBullets && i < defaults.length; i++) {
      validLines.push(defaults[i])
      repairs.push(`Added default bullet: "${defaults[i]}"`)
    }
  }
  
  if (needsEksempel > 0) {
    // Add minimal examples using allowed tokens
    const offering = ctx.menuItems[0] || 'mad'
    const examples = [
      `Eksempel: "Nyd ${offering} ${ctx.locationHook}"`,
      `Eksempel: "Perfekt til lang frokost ved åen"`
    ]
    for (let i = 0; i < needsEksempel && i < examples.length; i++) {
      validLines.push(examples[i])
      repairs.push(`Added default example: "${examples[i]}"`)
    }
  }
  
  return {
    value: validLines.join('\n'),
    repairs,
    wasRepaired: repairs.length > 0
  }
}

/**
 * Auto-repair signature_shot by injecting required components
 * 
 * Contract:
 * - MUST contain location cue ("ved åen i Aarhus")
 * - MUST contain explicit action verb from whitelist
 * 
 * If missing, rewrite using slot template.
 */
export function repairSignatureShot(value: string, ctx: FormatContext): RepairResult {
  const normalized = value.toLowerCase()
  const repairs: string[] = []
  
  // Check 1: Location cue present?
  const hasLocation = normalized.includes(ctx.locationHook.toLowerCase())
  
  // Check 2: Action verb present?
  const hasAction = ctx.actionVerbs.some(verb => normalized.includes(verb.toLowerCase()))
  
  // If both missing, use slot template
  if (!hasLocation || !hasAction) {
    const action = ctx.actionVerbs[0] || 'nyder'
    const offering = ctx.menuItems[0] || 'måltidet'
    const light = normalized.includes('aften') || normalized.includes('gyldent') 
      ? 'gyldent aftenlys' 
      : 'naturligt lys'
    
    const repaired = `${ctx.locationHook}, folk ${action} ${offering} i ${light}, med ${ctx.menuItems[1] || 'retter'} på bordet.`
    
    repairs.push(`Rewrote using slot template (missing: ${!hasLocation ? 'location' : ''} ${!hasAction ? 'action' : ''})`)
    
    return {
      value: repaired,
      repairs,
      wasRepaired: true
    }
  }
  
  // Inject missing parts individually
  let repaired = value
  
  if (!hasLocation) {
    // Prepend location
    repaired = `${ctx.locationHook}, ${repaired}`
    repairs.push(`Prepended location: "${ctx.locationHook}"`)
  }
  
  if (!hasAction) {
    // Inject action verb
    const action = ctx.actionVerbs[0] || 'nyder'
    repaired = repaired.replace(/\b(folk|gæster|mennesker)\b/i, (match) => `${match} ${action}`)
    repairs.push(`Injected action verb: "${action}"`)
  }
  
  return {
    value: repaired,
    repairs,
    wasRepaired: repairs.length > 0
  }
}

/**
 * Format and repair entire profile using auto-repair formatters
 */
export function formatAndRepairProfile(
  profile: any,
  ctx: FormatContext
): { profile: any; repairs: string[]; warnings: string[] } {
  const allRepairs: string[] = []
  const warnings: string[] = []
  
  // Repair brand_essence
  if (profile?.brand_essence?.value) {
    const result = repairBrandEssence(profile.brand_essence.value, ctx)
    if (result.wasRepaired) {
      profile.brand_essence.value = result.value
      allRepairs.push(`brand_essence: ${result.repairs.join(', ')}`)
    }
  } else {
    warnings.push('brand_essence.value is missing')
  }
  
  // Repair tone_of_voice
  if (profile?.tone_of_voice?.value) {
    const result = repairToneOfVoice(profile.tone_of_voice.value, ctx)
    if (result.wasRepaired) {
      profile.tone_of_voice.value = result.value
      allRepairs.push(`tone_of_voice: ${result.repairs.join(', ')}`)
    }
  } else {
    warnings.push('tone_of_voice.value is missing')
  }
  
  // Repair signature_shot
  if (profile?.image_preferences?.signature_shot) {
    const result = repairSignatureShot(profile.image_preferences.signature_shot, ctx)
    if (result.wasRepaired) {
      profile.image_preferences.signature_shot = result.value
      allRepairs.push(`signature_shot: ${result.repairs.join(', ')}`)
    }
  } else {
    warnings.push('signature_shot is missing')
  }
  
  return { profile, repairs: allRepairs, warnings }
}
