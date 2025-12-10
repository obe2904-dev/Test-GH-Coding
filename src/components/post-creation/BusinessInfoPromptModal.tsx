import { useTranslation } from 'react-i18next'
import { Sparkles } from '../icons/PostCreationIcons'

interface BusinessInfoPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onManualInput: () => void
  onWebsiteLink: () => void
}

export function BusinessInfoPromptModal({ 
  isOpen, 
  onClose, 
  onManualInput, 
  onWebsiteLink 
}: BusinessInfoPromptModalProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost.generate' })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          {/* Header with icon */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-indigo-600" />
            </div>
          </div>

          {/* Title and description */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3">
              {t('businessInfoTitle', 'For at jeg kan hjælpe dig bedst muligt, skal jeg vide lidt om din forretning.')}
            </h2>
            <p className="text-sm text-slate-600 mb-2">
              {t('businessInfoDesc1', 'Du kan taste det ind selv eller lade mig kigge på din hjemmeside.')}
            </p>
            <p className="text-xs text-slate-500">
              {t('businessInfoDesc2', 'Det kan altid ændres senere.')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {/* Primary option - Website link (more prominent) */}
            <button
              onClick={onWebsiteLink}
              className="w-full px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-bold text-base shadow-lg flex items-center justify-center gap-2 transform hover:scale-[1.02]"
            >
              <span className="text-xl">🔗</span>
              <span>{t('websiteLink', 'Link til hjemmeside')}</span>
            </button>

            {/* Secondary option - Manual input (less prominent) */}
            <button
              onClick={onManualInput}
              className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all font-medium text-sm flex items-center justify-center gap-2"
            >
              <span>✍️</span>
              <span>{t('manualInput', 'Tast Selv')}</span>
            </button>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors font-medium text-sm"
            >
              {t('cancel', 'Annuller')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
