/**
 * Tone of Voice Extractor (GPT-4o-mini for Free, GPT-4o for Paid)
 * 
 * Extracts communication style and brand voice from website content
 * Returns structured JSONB for business_brand_profile.tone_of_voice
 * 
 * Purpose:
 * - Auto-populate brand voice parameters for AI content generation
 * - Identify do's and don'ts from actual website language
 * - Extract example phrases that demonstrate the brand's style
 * 
 * Usage:
 * const tone = await extractToneOfVoice(content, model, openai, context)
 */

import OpenAI from 'https://esm.sh/openai@4.68.4'

export interface ToneOfVoiceResult {
  overallTone: string          // "Professionel og venlig"
  characteristics: string[]    // ["Høflig", "Inkluderende", "Moderne"]
  dosList: string[]           // Things to do: ["Brug aktive verber", "Vær specifik"]
  dontsList: string[]         // Things to avoid: ["Undgå jargon", "Ikke for formelt"]
  examplePhrases: string[]    // Brand-specific phrases from site
  confidence: 'high' | 'medium' | 'low'
}

export interface ToneOfVoiceContext {
  businessName?: string | null
  businessType?: string | null
  languageHint?: string | null
}

/**
 * Extract tone of voice from website content using OpenAI
 * 
 * @param content - Raw HTML content or cleaned text from website
 * @param model - OpenAI model to use (gpt-4o-mini or gpt-4o)
 * @param openai - OpenAI client instance
 * @param context - Business context for better extraction
 * @returns ToneOfVoiceResult with structured brand voice data or null
 */
export async function extractToneOfVoice(
  content: string,
  model: string,
  openai: OpenAI,
  context: ToneOfVoiceContext
): Promise<ToneOfVoiceResult | null> {
  if (!content || content.trim().length < 200) {
    console.log('⏭️ Content too short for tone of voice extraction')
    return null
  }

  const language = context.languageHint || 'da'
  const businessType = context.businessType || 'unknown'
  const businessName = context.businessName || 'Unknown'

  // Language-specific prompt text
  const languageInstructions: Record<string, string> = {
    'da': 'på dansk',
    'no': 'på norsk',
    'sv': 'på svensk',
    'de': 'på tysk',
    'en': 'in English'
  }
  const langInstruction = languageInstructions[language] || 'på dansk'

  const systemPrompt = `Du er ekspert i at analysere brand voice og kommunikationsstil fra hjemmesideindhold.

Udtræk tone of voice fra følgende hjemmeside-indhold.

Virksomhed: ${businessName}
Type: ${businessType}
Sprog: ${language}

Analyser:
1. Overordnet tone (formel/uformel, venlig/professionel, osv.)
2. Nøglekarakteristika (3-5 adjektiver)
3. Kommunikationsretningslinjer (do's and don'ts)
4. Eksempel-fraser fra sitet der demonstrerer tonen

Returner JSON med denne struktur:
{
  "overallTone": "Kort beskrivelse ${langInstruction}",
  "characteristics": ["Adjektiv1", "Adjektiv2", "Adjektiv3"],
  "dosList": ["Gør dette", "Brug denne stil"],
  "dontsList": ["Undgå dette", "Brug ikke"],
  "examplePhrases": ["Faktisk sætning fra sitet", "Anden sætning"],
  "confidence": "high|medium|low"
}

Bemærk:
- examplePhrases skal være FAKTISKE citater fra indholdet (ikke opfundet)
- characteristics skal være korte adjektiver
- confidence baseret på hvor tydeligt tonen fremgår`

  try {
    console.log(`🔍 Extracting tone of voice with ${model} (${content.length} chars)...`)
    
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content.slice(0, 6000) }
      ]
    })

    const text = response.choices[0]?.message?.content
    
    if (!text) {
      console.warn('⚠️ Empty response from OpenAI')
      return null
    }

    console.log(`✅ OpenAI response received (${text.length} chars)`)

    const parsed = JSON.parse(text)
    
    // Validate and normalize structure
    const result: ToneOfVoiceResult = {
      overallTone: String(parsed.overallTone || '').trim(),
      characteristics: normalizeStringArray(parsed.characteristics),
      dosList: normalizeStringArray(parsed.dosList),
      dontsList: normalizeStringArray(parsed.dontsList),
      examplePhrases: normalizeStringArray(parsed.examplePhrases),
      confidence: validateConfidence(parsed.confidence)
    }

    // Validate minimum data quality
    if (!result.overallTone || result.characteristics.length === 0) {
      console.warn('⚠️ Insufficient data in tone extraction')
      return null
    }

    console.log(`📊 Tone extraction result:`, {
      tone: result.overallTone.slice(0, 50) + '...',
      characteristicsCount: result.characteristics.length,
      dosCount: result.dosList.length,
      dontsCount: result.dontsList.length,
      examplesCount: result.examplePhrases.length,
      confidence: result.confidence
    })

    return result

  } catch (error) {
    console.error('❌ Tone of voice extraction failed:', error)
    return null
  }
}

/**
 * Normalize array of strings (filter empty, trim, limit length)
 */
function normalizeStringArray(value: any): string[] {
  if (!Array.isArray(value)) return []
  
  return value
    .filter(item => typeof item === 'string' && item.trim().length > 0)
    .map(item => String(item).trim().slice(0, 200))
    .slice(0, 10) // Max 10 items per array
}

/**
 * Validate confidence level
 */
function validateConfidence(value: any): 'high' | 'medium' | 'low' {
  const valid = ['high', 'medium', 'low']
  return valid.includes(value) ? value : 'medium'
}

/**
 * Convert ToneOfVoiceResult to human-readable TEXT format
 * (for storing in business_brand_profile.tone_of_voice as TEXT)
 */
export function formatToneAsText(tone: ToneOfVoiceResult): string {
  const lines: string[] = []
  
  lines.push(tone.overallTone)
  lines.push('')
  
  if (tone.characteristics.length > 0) {
    lines.push(`Karakteristika: ${tone.characteristics.join(', ')}`)
    lines.push('')
  }
  
  if (tone.dosList.length > 0) {
    lines.push('Gør:')
    tone.dosList.forEach(item => lines.push(`- ${item}`))
    lines.push('')
  }
  
  if (tone.dontsList.length > 0) {
    lines.push('Undgå:')
    tone.dontsList.forEach(item => lines.push(`- ${item}`))
    lines.push('')
  }
  
  if (tone.examplePhrases.length > 0) {
    lines.push('Eksempel-fraser:')
    tone.examplePhrases.forEach(item => lines.push(`- "${item}"`))
  }
  
  return lines.join('\n')
}
