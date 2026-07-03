import { useTranslation } from 'react-i18next'
import { DateFormatSwitcher } from '../../components/DateFormatSwitcher'
import { useAuthStore } from '../../stores/authStore'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { deleteAccount } = useAuthStore()
  const navigate = useNavigate()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDeleteAccount = async () => {
    // Check confirmation text based on current language
    const expectedText = i18n.language === 'da' ? 'slet' : 'delete'
    if (deleteConfirmText.toLowerCase() !== expectedText) {
      setDeleteError(t('settings.deleteAccount.confirmError'))
      return
    }

    setIsDeleting(true)
    setDeleteError('')

    try {
      await deleteAccount()
      // User will be redirected to login after sign out
      navigate('/login')
    } catch (error) {
      console.error('Error deleting account:', error)
      setDeleteError(t('settings.deleteAccount.error'))
      setIsDeleting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-6">{t('settings.title')}</h2>
        
        {/* Date Format Section */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('settings.dateFormat.title')}</h3>
          <div className="flex items-center gap-3">
            <DateFormatSwitcher />
            <p className="text-sm text-slate-500">{t('settings.dateFormat.description')}</p>
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-red-600 mb-3">{t('settings.deleteAccount.title')}</h3>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-900 font-medium mb-2">
                  {t('settings.deleteAccount.warning')}
                </p>
                <p className="text-sm text-red-800 mb-4">
                  {t('settings.deleteAccount.description')}
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  {t('settings.deleteAccount.button')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {t('settings.deleteAccount.modal.title')}
                </h3>
              </div>
            </div>

            <div className="mb-6">
                <p className="text-sm text-slate-700 mb-4">
                {t('settings.deleteAccount.modal.description')}
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="text-red-600">✗</span>
                  {t('settings.deleteAccount.modal.item1')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-600">✗</span>
                  {t('settings.deleteAccount.modal.item2')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-600">✗</span>
                  {t('settings.deleteAccount.modal.item3')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-600">✗</span>
                  {t('settings.deleteAccount.modal.item4')}
                </li>
              </ul>

              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-2">
                  {t('settings.deleteAccount.modal.confirmPrompt')}
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => {
                    setDeleteConfirmText(e.target.value)
                    setDeleteError('')
                  }}
                  placeholder={i18n.language === 'da' ? 'SLET' : 'DELETE'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={isDeleting}
                />
                {deleteError && (
                  <p className="text-xs text-red-600 mt-2">{deleteError}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmText('')
                  setDeleteError('')
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                disabled={isDeleting}
              >
                {t('settings.deleteAccount.modal.cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText.toLowerCase() !== (i18n.language === 'da' ? 'slet' : 'delete')}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting 
                  ? t('settings.deleteAccount.modal.deleting') 
                  : t('settings.deleteAccount.modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}