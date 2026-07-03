import { useTranslation } from 'react-i18next'
import { Sparkles } from '../icons/PostCreationIcons'

interface BusinessSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BusinessSetupModal({ isOpen, onClose }: BusinessSetupModalProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost.generate' })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {t('setupBusinessProfile', 'Opsæt din forretningsprofil')}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {t('setupBusinessDescription', 'Tilføj grundlæggende info eller lad AI læse din hjemmeside')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          <div className="text-center py-12">
            <Sparkles className="w-16 h-16 text-cta mx-auto mb-4" />
            <p className="text-slate-600 mb-4">
              {t('redirectToProfile', 'Du vil blive sendt til din profil-side for at tilføje forretningsinfo.')}
            </p>
            <button
              onClick={() => window.location.href = '/dashboard/profile'}
              className="px-6 py-3 bg-gradient-to-r from-cta to-purple-600 text-white rounded-lg hover:from-cta-hover hover:to-purple-700 transition-all font-bold text-sm shadow-md"
            >
              {t('goToProfile', 'Gå til profil')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
