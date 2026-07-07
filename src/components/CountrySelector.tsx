import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_COUNTRIES } from '../lib/constants'

export function CountrySelector() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  // Derive current country by language, fallback to Denmark
  const getCurrent = () => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('selectedCountry') : null
    if (stored) {
      const found = SUPPORTED_COUNTRIES.find(c => c.code === stored)
      if (found) return found
    }
    const byLang = SUPPORTED_COUNTRIES.find(c => c.language === i18n.language)
    return byLang || SUPPORTED_COUNTRIES[0]
  }

  const [currentCountry, setCurrentCountry] = useState(getCurrent())

  useEffect(() => {
    // keep local state in sync if language changes externally
    const byLang = SUPPORTED_COUNTRIES.find(c => c.language === i18n.language)
    if (byLang && byLang.code !== currentCountry.code) {
      setCurrentCountry(byLang)
      if (typeof window !== 'undefined') localStorage.setItem('selectedCountry', byLang.code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language])

  const handleSelect = (country: (typeof SUPPORTED_COUNTRIES)[number]) => {
    i18n.changeLanguage(country.language)
    setCurrentCountry(country)
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedCountry', country.code)
      // Mark that user has manually set language preference
      localStorage.setItem('userSetLanguage', 'true')
    }
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
      >
        <span>{currentCountry.flag}</span>
        <span>{currentCountry.name}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 py-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          {SUPPORTED_COUNTRIES.map((country) => (
            <button
              key={country.code}
              onClick={() => handleSelect(country)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-3 ${
                country.code === currentCountry.code ? 'bg-cta-surface text-cta-text' : 'text-gray-700'
              }`}
            >
              <span>{country.flag}</span>
              <span>{country.name}</span>
              {country.code === currentCountry.code && (
                <svg className="w-4 h-4 ml-auto text-cta" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default CountrySelector
