import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useBusinessData } from '../../hooks/useBusinessData'
import { SUPPORTED_COUNTRIES } from '../../lib/constants'

export function DashboardLayout() {
  const { i18n } = useTranslation()
  const { location, isLoading } = useBusinessData()

  // Auto-set language based on business country (only if user hasn't manually set language)
  useEffect(() => {
    if (isLoading || !location?.country) return

    // Check if user has manually overridden language preference
    const userSetLanguage = localStorage.getItem('userSetLanguage')
    if (userSetLanguage === 'true') return

    // Map country code to language
    const countryConfig = SUPPORTED_COUNTRIES.find(c => c.code === location.country)
    if (countryConfig && countryConfig.language !== i18n.language) {
      console.log(`[DashboardLayout] Auto-setting language to ${countryConfig.language} based on business country ${location.country}`)
      i18n.changeLanguage(countryConfig.language)
    }
  }, [location?.country, isLoading, i18n])

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Vertical Sidebar - Fixed width, full height */}
      <div className="w-72 flex-shrink-0">
        <Sidebar className="w-full h-full" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar - Fixed height */}
        <TopBar className="flex-shrink-0" />

        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}