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

/**
 * Result of the single-gate tone_of_voice validation.
 *   'ai'         — ≥5 clean bullets + ≥2 Eksempel — AI output accepted as-is
 *   'ai_partial' — 3-4 clean bullets — accepted (no bullet padding), Eksempel padded if missing
 *   'fallback'   — <3 clean bullets — AI output discarded, full generic set used
 */
export interface ToneValidationResult {
  value: string
  source: 'ai' | 'ai_partial' | 'fallback'
  issues: string[]
  bulletCount: number
  eksempelCount: number
}

export interface FormatContext {
  locationHook: string // "ved åen i Aarhus"
  offeringTokens: string[] // ["BRUNCH", "MIDDAG", "COCKTAILS"]
  actionVerbs: string[] // ["skåler", "spiser", "hælder op"]
  menuItems: string[] // Top menu items
  ctaTokens: string[] // CTA phrases
  brandNameTokens?: string[] // ALL-CAPS brand names that must appear verbatim, e.g. ["THE FAVORIT", "THE NEW ONE"]
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
  if (typeof value !== 'string') return { value: String(value ?? ''), repairs: [], wasRepaired: false }
  let repaired = value.trim()
  const repairs: string[] = []
  const normalized = repaired.toLowerCase()

  // Check 0: Detect and remove location phrase duplication
  // Pattern: "Café ved åen i Aarhus Aarhus ved åen i Aarhus" → "Café ved åen i Aarhus"
  // Also catches: "Café ved åen i Aarhus Aarhus ved åen i Aarhus hvor..."
  if (ctx.locationHook) {
    const hook = ctx.locationHook  // e.g. "ved åen i Aarhus"
    const hookLower = hook.toLowerCase()
    const escapedHook = hookLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Remove everything between first hook end and second hook occurrence (the "garbage" words)
    // Then remove all subsequent complete hook occurrences
    const dupePattern = new RegExp(`(${escapedHook})(\\s+\\S+)*?\\s+${escapedHook}`, 'gi')
    if (dupePattern.test(repaired)) {
      repaired = repaired.replace(
        new RegExp(`(${escapedHook})((?:\\s+\\S+)*?\\s+${escapedHook})+`, 'gi'),
        hook
      )
      repairs.push(`Removed duplicate location hook: "${hook}"`)
    }
  }
  // Check 0b: Enforce verbatim ALL-CAPS brand names (e.g. "THE FAVORIT" — never "FAVORITTEN")
  // Danish grammar inflects loanwords: "THE FAVORIT" → "favoritten" (definite) or "FAVORITTEN"
  // This repair detects any inflected / paraphrased variant and restores the original brand name.
  if (ctx.brandNameTokens && ctx.brandNameTokens.length > 0) {
    for (const brandToken of ctx.brandNameTokens) {
      // Use the LAST significant word as the detection anchor
      // "THE FAVORIT" → anchor = "FAVORIT"; "THE NEW ONE" → anchor = "ONE"
      const words = brandToken.trim().split(/\s+/)
      const anchor = words[words.length - 1]
      if (!anchor || anchor.length < 3) continue

      // Build regex: anchor word + optional Danish inflection suffixes
      // Covers: FAVORIT, FAVORITTEN, FAVORITEN, FAVORITS, favorit, favoritten, etc.
      const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Danish suffixes: -ten/-ten (definite/double), -en (definite), -ne (plural def.), -s (genitive), -er (plural)
      const suffixPattern = `(?:TEN|TER|TERNE|TERS|EN|NE|ET|ERE|ERNE|S)?`
      const variantRegex = new RegExp(`\\b${escaped}${suffixPattern}\\b`, 'gi')

      const before = repaired
      repaired = repaired.replace(variantRegex, brandToken)
      if (repaired !== before) {
        repairs.push(`Restored brand name verbatim: "...${anchor}..." → "${brandToken}"`)
      }
    }
  }

  // Check 0c: Strip adjective phrases before meal category tokens
  // e.g. "den luksuriøse brunch" → "brunch", "DEN LUKSURIØSE BRUNCH" → "brunch"
  const MEAL_CATEGORIES_REPAIR = ['brunch', 'frokost', 'middag', 'morgenmad', 'aftensmad', 'lunch', 'suppe', 'salat']
  for (const cat of MEAL_CATEGORIES_REPAIR) {
    // Match: det/den/de + adjective(s) + category (case-insensitive)
    const adjPattern = new RegExp(`\\b(?:den|det|de)\\s+\\w+\\s+(${cat})\\b`, 'gi')
    const before = repaired
    repaired = repaired.replace(adjPattern, (_, captured) => captured.toLowerCase())
    if (repaired !== before) {
      repairs.push(`Stripped adjective from meal category: found before "${cat}"`)
    }
  }

  // Check 1: Location hook present? (re-evaluate after dedup)
  const hasLocationHook = repaired.toLowerCase().includes(ctx.locationHook.toLowerCase())
  
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
    repaired.toLowerCase().includes(token.toLowerCase())
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
 * Single-gate validation for tone_of_voice.value.
 *
 * Replaces the multi-pass repair chain with one clean decision:
 *   'ai'         — ≥5 clean bullets + ≥2 Eksempel → accepted as-is, no log
 *   'ai_partial' — 2-4 clean bullets → accepted as-is (bullets not padded), Eksempel padded if missing
 *   'fallback'   — <2 valid bullets → discard AI output entirely, log reason
 *
 * A bullet is "dirty" if it contains a location hook or menu item token — dirty
 * bullets are silently dropped and counted as missing before the decision.
 *
 * Normalisation runs inline (not as a separate pre-pass):
 *   - Linearised bullets reconstructed from " - " separators
 *   - Prose runs split on sentence boundaries
 */
export function validateToneOfVoice(rawValue: string, ctx: FormatContext): ToneValidationResult {
  const issues: string[] = []

  // --- Normalisation (safety net) ---
  let normalised = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '')

  // Linearised bullets: no \n but has " - " separators → reconstruct
  if (!normalised.includes('\n') && normalised.includes(' - ')) {
    normalised = normalised
      .replace(/ (Eksempel: )/g, '\n$1')
      .replace(/ (Undgå: )/g, '\n$1')
    const firstNl = normalised.indexOf('\n')
    const bulletSeg = firstNl >= 0 ? normalised.slice(0, firstNl) : normalised
    const rest = firstNl >= 0 ? normalised.slice(firstNl) : ''
    normalised = bulletSeg.split(' - ').map((p, i) => (i === 0 ? p : '- ' + p)).join('\n') + rest
  }

  // Prose run: few newlines, multiple sentence endings → split
  const nlCount = (normalised.match(/\n/g) || []).length
  const periodCount = (normalised.match(/\. /g) || []).length
  if (nlCount < 3 && periodCount >= 2) {
    normalised = normalised
      .replace(/\.\s+((?=[A-ZÆØÅ]|Eksempel))/g, '\n')
      .replace(/\.\s*$/, '')
  }

  // --- Forbidden token set (location hook + menu items) ---
  const locationHookLower = ctx.locationHook.toLowerCase()
  const locationAreaPhrase = locationHookLower.split(' i ')[0].trim()
  const forbiddenTokens = [
    locationHookLower,
    ...(locationAreaPhrase.length > 3 ? [locationAreaPhrase] : []),
    ...ctx.menuItems.map(m => m.toLowerCase())
  ].filter(t => t.length > 2)
  const isDirty = (line: string) => forbiddenTokens.some(t => line.toLowerCase().includes(t))

  // --- Tactic-rule filter ---
  // Voice rules must be sentence mechanics, not content tactics.
  // A tactic rule says WHAT to do for a goal; a voice rule says HOW sentences are formed.
  // Only the high-confidence patterns are filtered here to avoid false-positives that
  // could push clean AI output below the 3-bullet threshold and trigger the generic fallback.
  //
  // High-confidence tactic patterns (always wrong as voice rules):
  //   "Indled med spørgsmål for engagement"  → start-with-X-for-goal, always a content tactic
  //   "Brug spørgsmål for engagement"        → use-X-for-goal, content tactic
  //   "for engagement"                       → engagement is a goal metric, not a mechanic
  //
  // Deliberately NOT filtered (border cases — valid mechanics with goal explanation):
  //   "Brug nutid for at skabe nærvær"       → mechanic is nutid; goal clause is just context
  //   "Skriv i aktiv form for at..."         → mechanic is aktiv form
  const TACTIC_RULE_RX = /\bfor engagement\b|^- Indled med\b|^- Start med et sp[øo]rgsm[åa]l\b/i
  const isTacticRule = (line: string) => TACTIC_RULE_RX.test(line)

  // --- Walk lines ---
  const lines = normalised.split('\n').map(l => l.trim()).filter(Boolean)
  const validLines: string[] = []
  let bulletCount = 0
  let eksempelCount = 0

  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (isDirty(line)) {
        issues.push(`Dropped contaminated bullet: "${line.slice(0, 60)}"`)
      } else if (isTacticRule(line)) {
        issues.push(`Dropped tactic rule (not a voice mechanic): "${line.slice(0, 80)}"`)
      } else {
        validLines.push(line)
        bulletCount++
      }
    } else if (line.startsWith('Eksempel:')) {
      const normalEksempel = line.startsWith('Eksempel: ') ? line : 'Eksempel: ' + line.slice('Eksempel:'.length).trim()
      if (isDirty(normalEksempel)) {
        issues.push(`Dropped contaminated Eksempel: "${line.slice(0, 60)}"`)
      } else {
        validLines.push(normalEksempel)
        eksempelCount++
      }
    } else if (line.startsWith('Undgå: ')) {
      validLines.push(line)
    } else if (line.length > 5) {
      if (!isDirty(line)) {
        validLines.push('- ' + line)
        bulletCount++
        issues.push(`Normalised plain line to bullet: "${line.slice(0, 40)}"`)
      } else {
        issues.push(`Dropped contaminated plain line: "${line.slice(0, 60)}"`)
      }
    }
  }

  // --- Generic mechanics-only defaults ---
  const DEFAULT_BULLETS = [
    `- Brug korte, direkte sætninger (max 12 ord)`,
    `- Skriv i aktiv form — handlingsverber frem for beskrivelser`,
    `- Hold sproget jordnært og roligt`,
    `- Brug du-form og tal direkte til læseren`,
    `- Undgå adjektiver — lad handlingen beskrive stemningen`
  ]
  const DEFAULT_EKSEMPEL = [
    `Eksempel: "Tag en pause fra hverdagen"`,
    `Eksempel: "Det er tid til noget godt"`
  ]

  // --- Decision gate ---
  if (bulletCount >= 5 && eksempelCount >= 2) {
    // Full AI output clean — accept as-is
    return { value: validLines.join('\n'), source: 'ai', issues, bulletCount, eksempelCount }
  }

  if (bulletCount >= 2) {
    // Partial AI output — bullets are sufficient (2–5 is acceptable), pad Eksempel only
    // NOTE: threshold is 2, not 3 — a Path B business (no writing samples) is instructed to
    // generate 4 rules as buffer, but after tactic-rule filtering 2 solid mechanics is a
    // valid and honest voice profile. The generic 5-bullet fallback is lower quality than
    // 2 specific, evidence-derived mechanics.
    const padBullets = 0 // Never pad bullets: 2+ is valid, do not add generic fallback rules
    const padEksempel = 2 - eksempelCount
    const insertPos = validLines.findIndex(l => l.startsWith('Eksempel: '))
    const insertAt = insertPos >= 0 ? insertPos : validLines.length
    let defaultBulletIdx = 0
    for (let i = 0; i < padBullets; i++) {
      while (defaultBulletIdx < DEFAULT_BULLETS.length &&
             validLines.some(l => l === DEFAULT_BULLETS[defaultBulletIdx])) {
        defaultBulletIdx++
      }
      if (defaultBulletIdx < DEFAULT_BULLETS.length) {
        validLines.splice(insertAt + i, 0, DEFAULT_BULLETS[defaultBulletIdx])
        issues.push(`Padded bullet slot ${bulletCount + i + 1}: "${DEFAULT_BULLETS[defaultBulletIdx]}"`)
        defaultBulletIdx++
      }
    }
    for (let i = 0; i < padEksempel; i++) {
      if (i < DEFAULT_EKSEMPEL.length) {
        validLines.push(DEFAULT_EKSEMPEL[i])
        issues.push(`Padded Eksempel slot: "${DEFAULT_EKSEMPEL[i]}"`)
      }
    }
    return { value: validLines.join('\n'), source: bulletCount >= 5 ? 'ai' : 'ai_partial', issues, bulletCount, eksempelCount }
  }

  // Fewer than 2 valid bullets — discard AI output, full generic fallback
  issues.push(`Discarded AI output — only ${bulletCount} valid bullet${bulletCount === 1 ? '' : 's'} (threshold: 2)`)
  return {
    value: [...DEFAULT_BULLETS, ...DEFAULT_EKSEMPEL].join('\n'),
    source: 'fallback',
    issues,
    bulletCount,
    eksempelCount
  }
}

// Kept for backward compatibility — not called internally after v4.14
// @deprecated Use validateToneOfVoice instead
export function repairToneOfVoice(value: string, ctx: FormatContext): RepairResult {
  if (typeof value !== 'string') {
    return { value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? ''), repairs: ['Non-string tone_of_voice.value coerced to string'], wasRepaired: true }
  }
  
  // Pre-pass 1: handle linearized bullets (removeBannedWords collapses \n → space before this function runs).
  // If value has no newlines but contains " - " separators, reconstruct individual bullet lines.
  let normalized = value
  if (!normalized.includes('\n') && normalized.includes(' - ')) {
    // Move Eksempel/Undgå blocks to their own lines first
    normalized = normalized
      .replace(/ (Eksempel: )/g, '\n$1')
      .replace(/ (Undgå: )/g, '\n$1')
    // Split the bullet segment on " - " to recover individual rules
    const firstNl = normalized.indexOf('\n')
    const bulletSeg = firstNl >= 0 ? normalized.slice(0, firstNl) : normalized
    const rest = firstNl >= 0 ? normalized.slice(firstNl) : ''
    const parts = bulletSeg.split(' - ')
    const reconstructed = parts.map((p, i) => (i === 0 ? p : '- ' + p)).join('\n')
    normalized = reconstructed + rest
  }

  // Pre-pass 2: if there are very few newlines but many sentence-ending periods,
  // the AI likely ran all rules together on one prose block — split them apart
  const newlineCount = (normalized.match(/\n/g) || []).length
  const periodCount = (normalized.match(/\. /g) || []).length
  if (newlineCount < 3 && periodCount >= 2) {
    normalized = normalized
      .replace(/\.\s+((?=[A-ZÆØÅ]|Eksempel))/g, '\n')
      .replace(/\.\s*$/, '')
  }
  
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)
  const repairs: string[] = []
  
  const validLines: string[] = []
  let bulletCount = 0
  let eksempelCount = 0
  let undgåCount = 0
  
  // Filter and normalize line types
  // Build a set of forbidden tokens for bullet rules (location hooks, menu items)
  const locationHookLower = ctx.locationHook.toLowerCase()
  // Use the full hook AND the area phrase before " i " (e.g. "ved åen" from "ved åen i Aarhus")
  // but NOT the city name alone (too broad — would filter legitimate style rules)
  const locationAreaPhrase = locationHookLower.split(' i ')[0].trim()
  const forbiddenInRules = [
    locationHookLower,
    ...(locationAreaPhrase.length > 3 ? [locationAreaPhrase] : []),
    ...ctx.menuItems.map(m => m.toLowerCase())
  ].filter(t => t.length > 2)

  const isRuleForbidden = (line: string): boolean => {
    const lower = line.toLowerCase()
    return forbiddenInRules.some(token => lower.includes(token))
  }

  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (isRuleForbidden(line)) {
        repairs.push(`Removed location/menu-specific rule: "${line.substring(0, 60)}"`)
      } else {
        validLines.push(line)
        bulletCount++
      }
    } else if (line.startsWith('Eksempel: ')) {
      if (isRuleForbidden(line)) {
        repairs.push(`Removed location/menu-specific Eksempel: "${line.substring(0, 60)}"`)
      } else {
        validLines.push(line)
        eksempelCount++
      }
    } else if (line.startsWith('Undgå: ')) {
      validLines.push(line)
      undgåCount++
    } else if (line.startsWith('Eksempel:')) {
      // Normalize missing space after colon
      const normalizedEksempel = 'Eksempel: ' + line.slice('Eksempel:'.length).trim()
      if (isRuleForbidden(normalizedEksempel)) {
        repairs.push(`Removed location/menu-specific Eksempel: "${line.substring(0, 60)}"`)
      } else {
        validLines.push(normalizedEksempel)
        eksempelCount++
        repairs.push(`Normalized Eksempel line (missing space): "${line.substring(0, 40)}"`)
      }
    } else if (line.length > 5) {
      if (isRuleForbidden(line)) {
        repairs.push(`Removed location/menu-specific plain line: "${line.substring(0, 60)}"`)
      } else {
        // Normalize plain-text bullet lines (AI omitted the "- " prefix)
        validLines.push('- ' + line)
        bulletCount++
        repairs.push(`Normalized plain line to bullet: "${line.substring(0, 40)}"`)
      }
    } else {
      repairs.push(`Removed short/empty line: "${line}"`)
    }
  }
  
  // Ensure minimum counts (schema requires exactly 5 bullets + 2 Eksempel)
  const needsBullets = 5 - bulletCount
  const needsEksempel = 2 - eksempelCount
  
  if (needsBullets > 0) {
    // Add style-only defaults — NO menu items, NO location markers
    const defaults = [
      `- Brug korte, direkte sætninger (max 12 ord)`,
      `- Skriv i aktiv form — handlingsverber frem for beskrivelser`,
      `- Hold sproget jordnært og roligt`,
      `- Brug du-form og tal direkte til læseren`
    ]
    for (let i = 0; i < needsBullets && i < defaults.length; i++) {
      validLines.push(defaults[i])
      repairs.push(`Added default bullet: "${defaults[i]}"`)
    }
  }
  
  if (needsEksempel > 0) {
    // Add style-only examples — NO menu items, NO location markers
    const examples = [
      `Eksempel: "Tag en pause fra hverdagen"`,
      `Eksempel: "Det er tid til noget godt"`
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
  if (typeof value !== 'string') return { value: String(value ?? ''), repairs: [], wasRepaired: false }
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
  
  // Validate tone_of_voice (single gate — replaces multi-pass repair chain)
  if (profile?.tone_of_voice?.value) {
    const result = validateToneOfVoice(profile.tone_of_voice.value, ctx)
    profile.tone_of_voice.value = result.value
    console.log(`📊 tone_of_voice: source=${result.source}, bullets=${result.bulletCount}, eksempel=${result.eksempelCount}`)
    if (result.source !== 'ai' && result.issues.length > 0) {
      allRepairs.push(`tone_of_voice [${result.source}]: ${result.issues.join('; ')}`)
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
