/**
 * Prompt A - Internal Analysis (COMPACT)
 *
 * Goal: Extract only the minimal, high-signal steering JSON for Prompt B.
 * This version is intentionally short to reduce latency and prevent drift.
 */

import type { DataSources, LanguageConfig } from '../types.ts'
import { extractStructuredWebsiteData } from '../signal-extractor.ts'
import { renderLocationPhrase } from './prompt-builder.ts'
import { buildMenuTypeSummary, buildSocialSummary } from '../data-gatherer.ts'
import { buildGeoContextBlock } from '../location-intelligence.ts'

export function buildPromptA(
  dataSources: DataSources,
  language: LanguageConfig,
  allowThirdParty: boolean = false
): string {
  const { business, location, profile, menu, images, websiteAnalysis, socialAccounts, menuSummaries,
          menuSignalProgrammes, openingHoursRows, existingBusinessCharacter } = dataSources

  // Use AI helicopter summaries when available; fall back to code-generated type summary
  const menuSummary = menuSummaries && menuSummaries.length > 0
    ? menuSummaries.map(m => `[${m.title}]\n${m.summary}`).join('\n\n')
    : buildMenuTypeSummary(menu)

  const imagesSummary =
    images?.length
      ? images.slice(0, 8).map(img => {
          const labels = img.ai_labels ? Object.values(img.ai_labels).flat().slice(0, 4).join(', ') : ''
          const tags = img.category_tags?.slice(0, 3).join(', ') || ''
          return `- ${img.type}${img.is_hero ? ' (hero)' : ''}${labels ? `: ${labels}` : ''}${tags ? ` [${tags}]` : ''}`
        }).join('\n')
      : 'No images'

  const socialSummary = buildSocialSummary(socialAccounts)

  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis, business)
  const websiteAboutSnippets = structuredWebsite.aboutSnippets?.filter(Boolean).slice(0, 2) || []
  const websiteRawExcerpt = structuredWebsite.rawExcerpt?.trim() || ''
  const websiteCompact = websiteAnalysis ? `
WEBSITE (compact):
- Hero: ${structuredWebsite.heroTexts?.slice(0, 2).join(' | ') || '—'}
- Headers: ${structuredWebsite.headers?.slice(0, 6).join(' | ') || '—'}
- CTA: ${structuredWebsite.ctaTexts?.slice(0, 6).join(', ') || '—'}
- Value phrases: ${structuredWebsite.valuePhrases?.slice(0, 2).join(' | ') || '—'}
- Menu categories mentioned: ${structuredWebsite.menuCategoriesMentioned?.slice(0, 8).join(', ') || '—'}${websiteAboutSnippets.length ? `
- About copy: ${websiteAboutSnippets.join(' / ')}` : ''}${websiteRawExcerpt ? `
- Raw excerpt: ${websiteRawExcerpt.slice(0, 300)}` : ''}
` : 'WEBSITE: none'

  const areaType = location?.enrichment?.micro?.area_type
  const nearbySignal = location?.enrichment?.micro?.nearby_signals?.[0]
  const langCode = language.code || 'da'
  const locationPhrase = renderLocationPhrase(areaType, langCode, nearbySignal)
  const city = location?.enrichment?.macro?.city || business?.city || 'Unknown'

  const geoContextBlock = buildGeoContextBlock(location, city, areaType, locationPhrase || '')

  // WP1: Build operational programmes block for Prompt A injection
  let operationalProgrammesBlock = ''
  if ((menuSignalProgrammes && menuSignalProgrammes.length > 0) || (openingHoursRows && openingHoursRows.length > 0)) {
    const lines: string[] = ['OPERATIONAL PROGRAMMES:']
    if (menuSignalProgrammes && menuSignalProgrammes.length > 0) {
      for (const p of menuSignalProgrammes) {
        const timeCtx = p.timeContext ? ` (${p.timeContext})` : ''
        const itemList = p.items?.length > 0 ? `: ${p.items.slice(0, 6).join(', ')}` : ''
        lines.push(`- ${p.role}${timeCtx}${itemList}`)
      }
    }
    if (openingHoursRows && openingHoursRows.length > 0) {
      const lateRows = openingHoursRows.filter(r => {
        const h = parseInt((r.close_time || '00:00').split(':')[0], 10)
        return h >= 0 && h < 6
      })
      const allRows = [...openingHoursRows].sort((a, b) => {
        const ha = parseInt((a.close_time || '00:00').split(':')[0], 10)
        const hb = parseInt((b.close_time || '00:00').split(':')[0], 10)
        return hb - ha
      })
      const latestRow = allRows[0]
      if (lateRows.length > 0) {
        lines.push(`- late_night_venue=true (closes after midnight on: ${lateRows.map(r => r.weekday).join(', ')})`)
      }
      if (latestRow) {
        lines.push(`- latest_closing_time=${latestRow.close_time} (${latestRow.weekday})`)
      }
    }
    operationalProgrammesBlock = lines.join('\n')
  }

  const deterministicLocation = location?.enrichment ? `
LOCATION ENRICHMENT (deterministic):
- city=${location.enrichment.macro.city}
- country=${location.enrichment.macro.country}
- city_tier=${location.enrichment.macro.city_tier}
- micro_area_type=${location.enrichment.micro.area_type}
- nearby_signals=${location.enrichment.micro.nearby_signals.slice(0, 6).join(', ')}
- confidence=${location.enrichment.micro.confidence}
- canonical_location_phrase=${locationPhrase || '—'}${geoContextBlock}
` : 'LOCATION ENRICHMENT: none'

  return `${language.instructionsPromptA}

You are an internal signal extractor. Output JSON ONLY. No markdown.

CONSTRAINTS (hard):
- Use ONLY provided data.
- No invented demographic personas. Always banned: familier, børnefamilier, par, venner, lokale, unge, voksne, seniorer.
- Score-gated exception: if LOCATION ENRICHMENT shows micro_area_type as tourist/destination/waterfront, you MAY use "besøgende" in usage_occasions as a confirmed behavioral occasion (with evidence). Still avoid "turister" as a persona label.
- Each extracted item MUST include an evidence quote/snippet from the input.
- If you cannot find evidence, omit the item (use []).

SIZE LIMITS (hard):
- distinctive_hooks: max 4
- micro_location_context: max 2
- usage_occasions: max 3
- tone_markers_from_text: max 8 — concrete sentence-rhythm observations from the ACTUAL TEXT.
  Describe what you observe. Format: pattern name + optional example from the actual text.
  Good examples of format: "du-form throughout", "short imperative sentences", "no punctuation after exclamations", "sentence fragments used for rhythm", "present tense only — no future promises", "scene-setting before offer: [quote from actual text]", "commands without softening: [quote from actual text]", "ellipsis or dash used for pause effect".
  Do NOT copy the bracketed placeholders above — replace them with real quotes from the website/menu text.
  Do NOT use abstract adjectives (e.g. NOT: 'friendly', 'warm', 'casual', 'authentic', 'informal phrasing', 'direct address').
  REQUIRED: describe the grammatical/structural pattern, not the emotional tone.
- must_use_phrases.brand_essence: max 3
- must_use_phrases.cta: max 3
- evidence snippets: max 140 chars each

INPUT (priority):
TIER 1 (internal):
- name=${business?.name || 'Unknown'}
- vertical=${business?.vertical || 'Unknown'}
- city=${business?.city || 'Unknown'}
- address=${business?.address || '—'}
- country=${business?.country || '—'}

${deterministicLocation}

User Profile:
${profile?.short_description ? `- short_description=${profile.short_description}` : ''}
${profile?.long_description ? `- long_description=${profile.long_description}` : ''}
${profile?.target_audience ? `- target_audience=${profile.target_audience}` : ''}
${profile?.price_level ? `- price_level=${profile.price_level}` : ''}
${existingBusinessCharacter ? `- existing_business_character: ${existingBusinessCharacter}` : ''}

${operationalProgrammesBlock ? operationalProgrammesBlock + '\n' : ''}
Menu (type summary):
${menuSummary}

Images:
${imagesSummary}

TIER 2 (supporting):
${websiteCompact}

Social (bios if any):
${socialSummary}

${allowThirdParty ? `
TIER 3 (controlled third-party) is ENABLED.
Rules:
- Only recurring patterns (2+), low confidence.
- Must use hedging language in the *evidence* label only (not in hooks text).
- Never extract sentiment hype words.

Third-party evidence snapshot:
- google_maps_photos_count=${dataSources.thirdPartyEvidence?.googleMaps?.photos?.length || 0}
- google_maps_review_patterns_count=${dataSources.thirdPartyEvidence?.googleMaps?.reviews?.length || 0}
- instagram_business_posts_count=${dataSources.thirdPartyEvidence?.instagram?.businessPosts?.length || 0}
` : `
TIER 3 is DISABLED. Ignore third-party.
`}

TASK:
Return JSON with EXACTLY this shape (keys must exist; arrays may be empty):

{
  "business_id": string,
  "analysis_version": "compact-1.0",
  "distinctive_hooks": [
    { "hook": string, "evidence": string, "source": string, "confidence": "high"|"medium"|"low" }
  ],
  "micro_location_context": [
    { "cue_type": string, "description": string, "evidence": string, "source": string, "confidence": "high"|"medium"|"low" }
  ],
  "usage_occasions": [
    {
      "id": string,
      "name": string,
      "when": string,
      "behavior": string,
      "job_to_be_done": string,
      "evidence": [ { "quote": string, "source": string, "confidence": "high"|"medium"|"low" } ],
      "confidence": "high"|"medium"|"low"
    }
  ],
  "tone_markers_from_text": [string],
  "must_use_phrases": {
    "brand_essence": [string],
    "cta": [string]
  },
  "voice_context_signals": {
    "has_kids_menu": boolean,
    "has_english_menu": boolean,
    "price_register": "budget" | "mid" | "premium",
    "location_atmosphere": [string]
  }
}

For voice_context_signals:
- has_kids_menu: true if any menu section name or item contains 'børn', 'kids', 'children', 'mini' OR website text references child/family offerings.
- has_english_menu: true if the menu has English section names or item descriptions, OR the website has English-language content sections.
- price_register: derive from menu price distribution — 'budget' (<80 DKK avg main), 'mid' (80-180 DKK), 'premium' (>180 DKK). If no prices available, infer from business type + location.
- location_atmosphere: array of tags from this set only: ['waterfront', 'outdoor_seating', 'city_centre', 'neighbourhood', 'shopping_street', 'harbour', 'park_adjacent']. Use address + nearby_signals + operations data. May be empty [].

IMPORTANT:
- micro_location_context must use deterministic location phrase when available: "${locationPhrase || ''}"
- usage_occasions must be agentless/behavioral. Do NOT invent demographic personas (familier, par, venner, lokale, unge). Exception: if micro_area_type = tourist/destination/waterfront (see LOCATION ENRICHMENT above), "besøgende" is a confirmed occasion and may appear with evidence.
`
}
