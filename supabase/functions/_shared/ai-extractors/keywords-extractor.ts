/**
 * Keywords Extractor
 * 
 * Generates descriptive keywords about the business using OpenAI.
 * Keywords help with search, categorization, and business understanding.
 * 
 * Language-aware: Outputs keywords in the business's native language.
 */

import { AI_TASKS, CONTENT_LIMITS, getLanguageCode, type LanguageCode } from '../ai-config.ts'

// ============================================================================
// LANGUAGE CONFIGURATION
// Keyword-specific prompts for each language
// ============================================================================

interface KeywordPromptConfig {
  systemPrompt: string
  categories: string[]
}

const LANGUAGE_PROMPTS: Record<LanguageCode, KeywordPromptConfig> = {
  da: {
    systemPrompt: 'Du er en nøgleordsgenerator for virksomheder. Generer 8-15 relevante, beskrivende nøgleord på DANSK. Returner kun gyldig JSON.',
    categories: [
      'Køkkentype eller servicekategori',
      'Stemning og stil',
      'Beliggenhed og område',
      'Specialiteter og unikke tilbud',
      'Målgruppe'
    ]
  },
  no: {
    systemPrompt: 'Du er en nøkkelordgenerator for virksomheter. Generer 8-15 relevante, beskrivende nøkkelord på NORSK. Returner kun gyldig JSON.',
    categories: [
      'Kjøkkentype eller tjenestekategori',
      'Stemning og stil',
      'Beliggenhet og område',
      'Spesialiteter og unike tilbud',
      'Målgruppe'
    ]
  },
  sv: {
    systemPrompt: 'Du är en nyckelordsgenerator för företag. Generera 8-15 relevanta, beskrivande nyckelord på SVENSKA. Returnera endast giltig JSON.',
    categories: [
      'Kökstyp eller tjänstekategori',
      'Stämning och stil',
      'Läge och område',
      'Specialiteter och unika erbjudanden',
      'Målgrupp'
    ]
  },
  de: {
    systemPrompt: 'Sie sind ein Schlüsselwort-Generator für Unternehmen. Generieren Sie 8-15 relevante, beschreibende Schlüsselwörter auf DEUTSCH. Geben Sie nur gültiges JSON zurück.',
    categories: [
      'Küchenart oder Servicekategorie',
      'Atmosphäre und Stil',
      'Lage und Umgebung',
      'Spezialitäten und einzigartige Angebote',
      'Zielgruppe'
    ]
  },
  en: {
    systemPrompt: 'You are a keyword generator for businesses. Generate 8-15 relevant, descriptive keywords in English. Return only valid JSON.',
    categories: [
      'Cuisine type or service category',
      'Atmosphere and style',
      'Location characteristics',
      'Specialties and unique offerings',
      'Target audience'
    ]
  }
}

function getKeywordConfig(langCode: string | null | undefined): KeywordPromptConfig {
  const code = getLanguageCode(langCode, 'da')
  return LANGUAGE_PROMPTS[code]
}

export async function extractKeywords(
  content: string,
  businessName: string | null,
  businessType: string | null,
  openaiApiKey: string,
  languageHint?: string | null
): Promise<string[]> {
  const langConfig = getKeywordConfig(languageHint)
  const taskConfig = AI_TASKS.keywords
  
  const prompt = `Generate 8-15 descriptive keywords for this business.

Business name: ${businessName || 'unknown'}
Business type: ${businessType || 'unknown'}

Content preview:
${content.slice(0, CONTENT_LIMITS.keywords)}

Generate keywords covering:
${langConfig.categories.map(c => `- ${c}`).join('\n')}

Return JSON:
{
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: taskConfig.model,
        messages: [
          { role: 'system', content: langConfig.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: taskConfig.temperature,
        max_tokens: taskConfig.maxTokens,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error('❌ Keywords extraction failed:', response.status)
      return []
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    const keywords = Array.isArray(result.keywords) ? result.keywords : []
    console.log('✅ Keywords extracted:', keywords.length)
    return keywords

  } catch (error) {
    console.error('❌ Error in keywords extraction:', error)
    return []
  }
}
