import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Translation resources
import enTranslations from './locales/en.json'
import daTranslations from './locales/da.json'

console.log('EN translations loaded:', enTranslations)
console.log('DA translations loaded:', daTranslations)
console.log('EN generate.title:', (enTranslations as any).generate?.title)
console.log('DA generate.title:', (daTranslations as any).generate?.title)

const resources = {
  en: { translation: enTranslations },
  da: { translation: daTranslations }
}

console.log('i18n resources:', resources)

i18n
  .use(LanguageDetector) // Detects user language
  .use(initReactI18next) // Passes i18n down to react-i18next
  .init({
    resources,
    fallbackLng: 'en', // Use English if detected language is not available
    defaultNS: 'translation',
    debug: true, // Set to true for development
    
    keySeparator: '.', // Use dots to separate keys
    returnEmptyString: false, // Don't return empty strings
    returnNull: false, // Don't return null

    interpolation: {
      escapeValue: false // React already does escaping
    },

    detection: {
      // Order of language detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache user language preference
      caches: ['localStorage']
    }
  }).then(() => {
    console.log('=== i18n initialized ===')
    console.log('Language:', i18n.language)
    console.log('Has EN?', i18n.hasResourceBundle('en', 'translation'))
    const bundle = i18n.getResourceBundle('en', 'translation')
    console.log('EN bundle:', bundle)
    if (bundle) {
      console.log('Has generate?', 'generate' in bundle)
      console.log('generate object:', bundle.generate)
    }
  })

export default i18n