import { useTranslation } from 'react-i18next'

export function HelpPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.help')}</h2>
        <p className="text-gray-600">
          Help and support resources will be built here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>FAQ and documentation</li>
          <li>Video tutorials</li>
          <li>Contact support</li>
          <li>Community forums</li>
        </ul>
      </div>
    </div>
  )
}