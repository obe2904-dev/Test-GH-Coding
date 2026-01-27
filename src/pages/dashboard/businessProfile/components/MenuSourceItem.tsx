import type { MenuUrlState, MenuType } from './MenuOfferingsPanel'
import { MenuStatusCard } from '@/components/menu/MenuStatusCard'
import type { MenuSourceStatus } from '@/lib/menu/statusUi'

/**
 * Extract a readable menu name from URL path - patterns ordered specific to generic
 */
function extractMenuNameFromUrl(url: string): string {
  const urlLower = url.toLowerCase()
  const pathMatch = urlLower.match(/\/([^\/]+)\/?$/)
  const path = pathMatch?.[1] || ''
  
  // Ordered: specific patterns first (julefrokost before frokost, etc.)
  const patterns: Array<[string, string]> = [
    ['julefrokost', 'Julefrokost'], ['aftensmad', 'Aftenmenu'], ['take-away', 'Takeaway'],
    ['a-la-carte', 'À la carte'], ['menukort', 'Menukort'], ['vinmenu', 'Vinkort'],
    ['morgenmad', 'Morgenmad'], ['brunch', 'Brunch'], ['frokost', 'Frokost'], ['lunch', 'Frokost'],
    ['middag', 'Middag'], ['dinner', 'Middag'], ['aften', 'Aftenmenu'], ['evening', 'Aftenmenu'],
    ['cocktails', 'Cocktails'], ['cocktail', 'Cocktails'], ['drikkevarer', 'Drikkevarer'],
    ['drinks', 'Drinks'], ['vine', 'Vinkort'], ['wine', 'Vinkort'], ['vin', 'Vinkort'],
    ['beer', 'Ølkort'], ['bar', 'Barmenu'], ['ol', 'Ølkort'],
    ['desserter', 'Desserter'], ['dessert', 'Desserter'], ['forretter', 'Forretter'],
    ['hovedretter', 'Hovedretter'], ['burgers', 'Burgere'], ['burger', 'Burgere'],
    ['sandwich', 'Sandwich'], ['pizza', 'Pizza'], ['sushi', 'Sushi'], ['tapas', 'Tapas'],
    ['takeaway', 'Takeaway'], ['catering', 'Catering'], ['christmas', 'Julemenu'], ['jul', 'Julemenu'],
    ['menu', 'Menukort'], ['kort', 'Menukort']
  ]
  
  for (const [pattern, label] of patterns) {
    if (path.includes(pattern) || urlLower.includes(`/${pattern}/`)) {
      return label
    }
  }
  
  return 'Menukort'
}

/**
 * Map internal menu status to standardized status for UI mapping
 */
function mapMenuStatusToUIStatus(status: MenuUrlState['status']): MenuSourceStatus {
  switch (status) {
    case 'pending':
      return 'pending'
    case 'extracting':
      return 'processing'
    case 'extracted':
      return 'completed'
    case 'error':
      return 'failed'
    default:
      return 'pending'
  }
}

interface MenuSourceItemProps {
  menu: MenuUrlState
  onMenuTypeChange: (url: string, newType: MenuType) => void
  onExtract: (url: string) => void
  onUndoDelete: (url: string) => void
  onInitiateDelete: (url: string) => void
}

export function MenuSourceItem({
  menu,
  onMenuTypeChange,
  onExtract,
  onUndoDelete,
  onInitiateDelete,
}: MenuSourceItemProps) {
  const extractionSource = (menu as any)?.extractedData?._meta?.source
  const isGpt52Vision = extractionSource === 'gpt-5.2-vision'

  return (
    <div className={`transition-all ${menu.isDeleting ? 'bg-gray-100' : 'bg-white'}`}>
      {menu.isDeleting ? (
        // Inline delete state
        <div className="px-3 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Menu-kilde fjernet</p>
              <p className="text-xs text-gray-600 mt-1">Denne menu bruges ikke længere af AI</p>
            </div>
            <button
              onClick={() => onUndoDelete(menu.url)}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Fortryd
            </button>
          </div>
        </div>
      ) : (
        // Normal row
        <div className="flex items-center gap-3 px-3 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">

          {/* Icon + Name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base flex-shrink-0">{menu.fileName ? '📄' : '🔗'}</span>
            <div className="flex flex-col min-w-0">
              {/* Show label if available, otherwise extract from URL */}
              <span className="text-sm font-medium text-gray-900">
                {(menu as any).label || menu.fileName || extractMenuNameFromUrl(menu.url)}
              </span>
              <span className="text-xs text-gray-500 truncate" title={menu.url}>
                {menu.url.replace(/^https?:\/\/(www\.)?/, '')}
              </span>
            </div>
          </div>

          {/* Type Dropdown - Fixed width for alignment */}
          <div className="w-36 flex-shrink-0">
            <select
              value={menu.menuType}
              onChange={(e) => onMenuTypeChange(menu.url, e.target.value as MenuType)}
              disabled={menu.status === 'extracting'}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white hover:border-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium text-gray-700"
            >
              <option value="standard">Standardmenu</option>
              <option value="special">Midlertidig menu</option>
            </select>
          </div>

          {/* Status Card - User-friendly, no technical jargon */}
          <div className="flex-1">
            <MenuStatusCard
              status={mapMenuStatusToUIStatus(menu.status)}
              sourceType={menu.fileName ? 'pdf' : 'url'}
              menuLabel={(menu as any).label || menu.fileName || extractMenuNameFromUrl(menu.url)}
              onRetry={() => onExtract(menu.url)}
              compact
            />
          </div>

          {/* Extraction Method Badge */}
          {isGpt52Vision && (
            <div className="px-2.5 py-1.5 text-xs font-medium border rounded-full whitespace-nowrap bg-indigo-50 text-indigo-700 border-indigo-200">
              AI-scannet
            </div>
          )}

          {/* Delete Button - Fixed width for alignment */}
          <div className="w-16 flex-shrink-0">
            <button
              onClick={() => onInitiateDelete(menu.url)}
              className="w-full px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            >
              Slet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
