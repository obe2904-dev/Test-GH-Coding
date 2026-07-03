import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getDateFormatLocale, setDateFormat, getDateFormatDisplayName, type DateFormat } from '../lib/userPreferences'

const Globe = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

export function DateFormatSwitcher() {
  const { t } = useTranslation()
  const [currentFormat, setCurrentFormat] = useState<DateFormat>(getDateFormatLocale())
  const [isOpen, setIsOpen] = useState(false)

  const formats: DateFormat[] = ['en-US', 'en-GB']

  const handleFormatChange = (format: DateFormat) => {
    setDateFormat(format)
    setCurrentFormat(format)
    setIsOpen(false)
    // Trigger a page refresh to update all date displays
    window.location.reload()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.date-format-switcher')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative date-format-switcher">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors text-sm font-medium text-slate-700"
        title="Change date format"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{getDateFormatDisplayName(currentFormat).split(' ')[0]}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-2 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-600 uppercase">{t('dateFormat.title', 'Date Format')}</p>
          </div>
          
          {formats.map((format) => (
            <button
              key={format}
              onClick={() => handleFormatChange(format)}
              className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between ${
                currentFormat === format ? 'bg-cta-surface text-cta-text' : 'text-slate-700'
              }`}
            >
              <div>
                <div className="font-medium text-sm">{getDateFormatDisplayName(format)}</div>
                <div className="text-xs text-slate-500">
                  {format === 'en-US' && t('dateFormat.usDesc', 'American format')}
                  {format === 'en-GB' && t('dateFormat.ukDesc', 'European format')}
                </div>
              </div>
              {currentFormat === format && (
                <span className="text-cta">✓</span>
              )}
            </button>
          ))}
          
          <div className="p-2 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              {t('dateFormat.example', 'Example')}: {new Date().toLocaleDateString(currentFormat, { 
                day: 'numeric', 
                month: 'numeric', 
                year: 'numeric' 
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
