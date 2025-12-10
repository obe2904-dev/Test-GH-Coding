import { useTranslation } from 'react-i18next'

export function TermsPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.terms')}</h2>
        <p className="text-gray-600">
          Terms of service will be displayed here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Service usage terms</li>
          <li>User responsibilities</li>
          <li>Limitation of liability</li>
          <li>Dispute resolution</li>
        </ul>
      </div>
    </div>
  )
}