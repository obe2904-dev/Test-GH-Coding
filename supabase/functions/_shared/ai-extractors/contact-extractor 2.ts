/**
 * Contact Information Extractor
 * 
 * Extracts contact details using OpenAI.
 * This includes: phone, email, and complete address.
 * 
 * Language-aware: Supports Danish, Norwegian, Swedish, German, and English
 * with country-specific address formats and phone codes.
 */

import { AI_TASKS, CONTENT_LIMITS, getLanguageCode, type LanguageCode } from '../ai-config.ts'

export interface ContactInfo {
  phone: string | null
  email: string | null
  address: {
    street: string | null
    city: string | null
    postalCode: string | null
    country: string | null
  } | null
}

// ============================================================================
// LANGUAGE/COUNTRY CONFIGURATION
// Easy to add new countries - just add an entry to this object
// ============================================================================

type LanguageCode = 'da' | 'no' | 'sv' | 'de' | 'en'

interface CountryConfig {
  countryName: string
  phoneCode: string
  postalCodeFormat: string
  postalCodeDigits: string
  defaultCountry: string
  contactLabels: string[]
  phoneLabels: string[]
  emailLabels: string[]
}

const COUNTRY_CONFIGS: Record<LanguageCode, CountryConfig> = {
  da: {
    countryName: 'Denmark',
    phoneCode: '+45',
    postalCodeFormat: '4-digit Danish postal code (e.g., "8000")',
    postalCodeDigits: '4',
    defaultCountry: 'Danmark',
    contactLabels: ['Kontakt', 'Kontakt os', 'Find os', 'Ring til os', 'Skriv til os', 'Adresse'],
    phoneLabels: ['tlf', 'tel', 'telefon', 'ring', 'phone'],
    emailLabels: ['email', 'e-mail', 'skriv', 'mail']
  },
  no: {
    countryName: 'Norway',
    phoneCode: '+47',
    postalCodeFormat: '4-digit Norwegian postal code (e.g., "0150")',
    postalCodeDigits: '4',
    defaultCountry: 'Norge',
    contactLabels: ['Kontakt', 'Kontakt oss', 'Finn oss', 'Ring oss', 'Skriv til oss', 'Adresse'],
    phoneLabels: ['tlf', 'tel', 'telefon', 'ring', 'phone'],
    emailLabels: ['e-post', 'epost', 'email', 'mail']
  },
  sv: {
    countryName: 'Sweden',
    phoneCode: '+46',
    postalCodeFormat: '5-digit Swedish postal code with space (e.g., "111 22" or "11122")',
    postalCodeDigits: '5',
    defaultCountry: 'Sverige',
    contactLabels: ['Kontakt', 'Kontakta oss', 'Hitta oss', 'Ring oss', 'Skriv till oss', 'Adress'],
    phoneLabels: ['tel', 'telefon', 'ring', 'phone'],
    emailLabels: ['e-post', 'epost', 'email', 'mail']
  },
  de: {
    countryName: 'Germany',
    phoneCode: '+49',
    postalCodeFormat: '5-digit German postal code (e.g., "10115")',
    postalCodeDigits: '5',
    defaultCountry: 'Deutschland',
    contactLabels: ['Kontakt', 'Kontaktieren Sie uns', 'Finden Sie uns', 'Rufen Sie uns an', 'Schreiben Sie uns', 'Adresse', 'Impressum'],
    phoneLabels: ['tel', 'telefon', 'anrufen', 'phone', 'fon'],
    emailLabels: ['e-mail', 'email', 'mail', 'schreiben']
  },
  en: {
    countryName: 'United Kingdom/International',
    phoneCode: '+44',
    postalCodeFormat: 'postal code in local format',
    postalCodeDigits: 'varies',
    defaultCountry: 'United Kingdom',
    contactLabels: ['Contact', 'Contact us', 'Find us', 'Call us', 'Write to us', 'Address', 'Get in touch'],
    phoneLabels: ['tel', 'telephone', 'call', 'phone'],
    emailLabels: ['email', 'e-mail', 'mail', 'write']
  }
}

function getCountryConfig(langCode: string | null | undefined): CountryConfig {
  const code = getLanguageCode(langCode, 'da')
  return COUNTRY_CONFIGS[code]
}

export async function extractContact(
  content: string,
  structuredData: any[],
  openaiApiKey: string,
  languageHint?: string | null
): Promise<ContactInfo> {
  const config = getCountryConfig(languageHint)
  
  const prompt = `Extract contact information from this website content.

${structuredData.length > 0 ? `Structured data available: ${structuredData.length} blocks\n` : ''}
IMPORTANT: Look for contact information in ALL languages.
Common labels in ${config.countryName}: ${config.contactLabels.join(', ')}
Common sections: footer, contact page, about, header

Content (first 8000 chars to increase chance of finding contact info):
${content.slice(0, 8000)}

Extract phone, email, and address with these rules:
1. phone: Phone number with country code if visible
   - Expected country code: ${config.phoneCode}
   - Look for: ${config.phoneLabels.map(l => `"${l}"`).join(', ')}, href="tel:"
   
2. email: Contact email address
   - Look for: ${config.emailLabels.map(l => `"${l}"`).join(', ')}, href="mailto:"
   
3. address: Complete physical address
   - street: Street name + number
   - city: City name
   - postalCode: ${config.postalCodeFormat}
   - country: If not specified, assume "${config.defaultCountry}"

If contact info is not found, return null for that field.

Return ONLY valid JSON:
{
  "phone": "phone with country code or null",
  "email": "email or null",
  "address": {
    "street": "street address",
    "city": "city",
    "postalCode": "postal code",
    "country": "country"
  }
}`

  const taskConfig = AI_TASKS.contact
  
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
          { role: 'system', content: 'You are a contact information extractor specializing in European business websites. Extract phone, email, and address accurately. Return only valid JSON with found data or null for missing fields.' },
          { role: 'user', content: prompt }
        ],
        temperature: taskConfig.temperature,
        max_tokens: taskConfig.maxTokens,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error('❌ Contact extraction failed:', response.status)
      return {
        phone: null,
        email: null,
        address: null
      }
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    console.log('✅ Contact info extracted:', result.phone || 'no phone', result.email || 'no email')
    return result

  } catch (error) {
    console.error('❌ Error in contact extraction:', error)
    return {
      phone: null,
      email: null,
      address: null
    }
  }
}
