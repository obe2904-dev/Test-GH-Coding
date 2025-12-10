import { useTranslation } from 'react-i18next'

export function CalendarPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.calendar')}</h2>
        <p className="text-gray-600">
          Content calendar will be built here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Monthly/weekly calendar view</li>
          <li>Scheduled posts visualization</li>
          <li>Drag-and-drop rescheduling</li>
          <li>Content planning tools</li>
        </ul>
      </div>
    </div>
  )
}