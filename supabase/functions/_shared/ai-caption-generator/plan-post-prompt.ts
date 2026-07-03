// ============================================================================
// plan-post-prompt.ts
// Simple AI Ideer-style caption generation for Weekly Plan posts.
// Replaces the 700-line prompt-builder path to eliminate robot language.
// ============================================================================

import { getHospitalityRegisterBlock } from '../utils/hospitality-register.ts'

export interface PlanPostContext {
  businessName: string
  city: string
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok'
  subject: string
  contentType: string
  menuItemDescription?: string
  ctaInstruction: string        // e.g. "Book bord via link i bio" or "Kig forbi i weekenden 🙌"
  // Brand voice — Smart/Pro only (all fields undefined for free tier)
  brandTone?: string            // Legacy: 1-sentence from brand_essence
  brandToneRules?: string       // v5: full tone_of_voice.value (5 writing rules)
  brandWritingRules?: string[]  // v5: tone_model.writing_rules
  brandGoodExamples?: string[]  // v5: tone_model.good_examples
  brandAvoidExamples?: string[] // v5: tone_model.avoid_examples
  voiceConstraints?: string     // v5: voice_constraints.value
  thingsToAvoid?: string        // concatenated language/tone constraints
  emojiInstruction?: string     // overrides default "1-2 emojis" rule
  signaturePhrases?: string[]   // brand-specific phrases to weave in if contextually fitting
  language?: string             // ISO 639-1 code — 'da', 'no', 'sv', 'de', 'en' (defaults to 'da')
}

// Maps contentType to a specific writing directive
function getContentTypeInstruction(contentType: string): string {
  switch (contentType) {
    case 'menu_item':
      return 'Beskriv retten — nævn KUN ingredienser fra beskrivelsen nedenfor'
    case 'atmosphere':
      return 'Beskriv stemningen med ét konkret detalje (location, tidspunkt, lyd eller syn)'
    case 'behind_scenes':
      return 'Vis processen — skriv som om du fortæller det til en ven'
    case 'team_people':
      return 'Præsenter personen naturligt — hvad gør dem særlige?'
    case 'seasonal':
      return 'Knyt teksten til årstiden eller begivenheden konkret'
    case 'event':
      return 'Nævn hvad der sker, hvornår og om der kræves tilmelding'
    case 'engagement':
      return 'Stil ét konkret spørgsmål til gæsterne'
    default:
      return 'Beskriv emnet naturligt og indbydende'
  }
}

export function buildPlanPostPrompt(ctx: PlanPostContext): string {
  const typeInstruction = getContentTypeInstruction(ctx.contentType)
  const menuLine = ctx.menuItemDescription
    ? `\nBESKRIVELSE: ${ctx.menuItemDescription}`
    : ''

  // Emoji rule: respect brand profile emoji_level when available
  const emojiRule = ctx.emojiInstruction
    ? ctx.emojiInstruction
    : '1-2 emojis naturligt i teksten'

  // Build BRANDSTEMME block (paid tier only — only present when brand fields populated)
  let brandBlock = ''
  const hasBrand = ctx.brandToneRules || (ctx.brandWritingRules && ctx.brandWritingRules.length > 0) || ctx.brandTone
  if (hasBrand) {
    brandBlock += '\nBRANDSTEMME (følg denne — stil, ikke fakta):'
    if (ctx.brandToneRules) {
      brandBlock += `\n${ctx.brandToneRules}`
    } else if (ctx.brandTone) {
      brandBlock += `\n${ctx.brandTone}`
    }
    if (ctx.voiceConstraints) {
      brandBlock += `\nPrincip: ${ctx.voiceConstraints}`
    }
    if (ctx.brandWritingRules && ctx.brandWritingRules.length > 0) {
      brandBlock += `\nSkriveregler:\n${ctx.brandWritingRules.map(r => `- ${r}`).join('\n')}`
    }
    if (ctx.brandGoodExamples && ctx.brandGoodExamples.length > 0) {
      brandBlock += `\nGode eksempler (efterlign stil, ikke indhold):\n${ctx.brandGoodExamples.map(e => `- "${e}"`).join('\n')}`
    }
    if (ctx.brandAvoidExamples && ctx.brandAvoidExamples.length > 0) {
      brandBlock += `\nUndgå disse mønstre:\n${ctx.brandAvoidExamples.map(e => `- ${e}`).join('\n')}`
    }
    if (ctx.thingsToAvoid) {
      brandBlock += `\n🚫 Undgå altid: ${ctx.thingsToAvoid}`
    }
    if (ctx.signaturePhrases && ctx.signaturePhrases.length > 0) {
      brandBlock += `\nBrandets egne fraser (vævs ind hvis konteksten passer — opfind ingen nye stedsfakta): ${ctx.signaturePhrases.join(' · ')}`
    }
    brandBlock = `\n${brandBlock.trimStart()}\n`
  }

  return `Du er en dansk social media writer. Skriv teksten direkte — ingen titler, ingen forklaringer.

Forretning: ${ctx.businessName} (${ctx.platform}, ${ctx.city})
EMNE: ${ctx.subject}
TYPE: ${typeInstruction}${menuLine}

AFSLUT teksten med:
${ctx.ctaInstruction}
${brandBlock}
${getHospitalityRegisterBlock(ctx.language ?? 'da')}

KRAV:
1. Længde: 250-380 tegn (inkl. emojis og CTA)
2. Struktur: 2-3 korte sætninger. Start direkte med emnet — INGEN titel eller overskrift
3. Tone: Naturligt dansk — skriv som en dansker TALER, ikke som en oversættelse fra engelsk.
   Brug KUN ord du kan begrunde i det konkrete emne. Kan du ikke pege på, hvor et ord kommer fra, udelad det.
4. Emojis: ${emojiRule}

Skriv KUN teksten (ingen titel, ingen forklaringer, ingen hashtags):`
}

// Derive a simple CTA instruction from available context.
// No phone numbers, no over-engineered copy — just plain Danish.
export function derivePlanPostCTA(
  city: string,
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok',
  scheduleTime?: string,         // e.g. "18:00"
  bookingUrl?: string,
  ctaIntent?: string
): string {
  if (bookingUrl && ctaIntent === 'booking') {
    if (platform === 'instagram') return 'Book bord via link i bio 🔗'
    return `Book bord: ${bookingUrl}`
  }

  if (scheduleTime) {
    const hour = parseInt(scheduleTime.split(':')[0])
    if (hour >= 17 && hour <= 21) {
      return `Vi serverer fra kl. ${scheduleTime} — velkommen!`
    }
    if (hour >= 10 && hour <= 14) {
      return `Vi er åbne til frokost fra kl. ${scheduleTime} 🙂`
    }
  }

  if (platform === 'instagram') return `Kig forbi i ${city} 🙌`
  return `Kig forbi i ${city} — vi glæder os til at se dig 🙂`
}

// Simple hashtag generation: city + contentType + platform-specific tag
export function generatePlanHashtags(
  city: string,
  contentType: string,
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok'
): string[] {
  const safeCity = city.replace(/\s+/g, '').toLowerCase()
  const capitalCity = safeCity.charAt(0).toUpperCase() + safeCity.slice(1)

  const contentTagMap: Record<string, string> = {
    menu_item: 'GodMad',
    atmosphere: 'Stemning',
    behind_scenes: 'BagKulisserne',
    team_people: 'MødHoldet',
    seasonal: 'Årstid',
    event: 'Begivenhed',
    engagement: 'DinMening',
  }
  const contentTag = contentTagMap[contentType] || 'MadOgDrikke'

  if (platform === 'instagram') {
    return [`#${capitalCity}`, `#${contentTag}`, '#DanskMad']
  }
  return [`#${capitalCity}`, `#${contentTag}`]
}

export interface PlanCaptionResult {
  caption: string
  hashtags: string[]
  metadata: {
    tone: string
    emojiCount: number
    model: string
    generatedAt: string
    qualityScore?: number
  }
}

export async function generatePlanPostCaption(ctx: PlanPostContext): Promise<PlanCaptionResult> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const prompt = buildPlanPostPrompt(ctx)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Du er en erfaren dansk social media manager. Du skriver korte, naturlige tekster der lyder som ægte dansk hverdagssprog — aldrig oversættelses-dansk.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 250,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  let caption: string = data.choices?.[0]?.message?.content?.trim() || ''

  // Strip any accidental title prefix (text before first real sentence)
  // e.g. "Vores nye ret:\nBlomkål..." → remove line if it ends with ":"
  caption = caption.replace(/^[^\n]+:\n/, '')

  // Count emojis
  const emojiCount = (caption.match(/\p{Emoji_Presentation}/gu) || []).length

  const hashtags = generatePlanHashtags(ctx.city, ctx.contentType, ctx.platform)

  return {
    caption,
    hashtags,
    metadata: {
      tone: 'natural-danish',
      emojiCount,
      model: 'gpt-4o',
      generatedAt: new Date().toISOString(),
    },
  }
}
