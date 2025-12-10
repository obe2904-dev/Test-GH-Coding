import { useTranslation } from 'react-i18next'

export function PrivacyPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.privacy')}</h2>
        <p className="text-gray-600">
          Privacy policy will be displayed here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Data collection practices</li>
          <li>Privacy rights and controls</li>
          <li>Cookie usage</li>
          <li>Data security measures</li>
        </ul>
      </div>
    </div>
  )
}