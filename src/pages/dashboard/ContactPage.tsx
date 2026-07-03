import { useTranslation } from 'react-i18next'

export function ContactPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.contact')}</h2>
        <p className="text-gray-600">
          Contact information will be displayed here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Email and phone support</li>
          <li>Business hours</li>
          <li>Response time expectations</li>
          <li>Emergency contact options</li>
        </ul>
      </div>
    </div>
  )
}