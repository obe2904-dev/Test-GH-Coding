import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function DashboardLayout() {
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