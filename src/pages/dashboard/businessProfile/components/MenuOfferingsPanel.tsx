import React from 'react'
import { AnalyzeIcon } from '../../BusinessProfileIcons'
import { TFunction } from 'i18next'
import type { BusinessOfferingsProfile } from '../../../../types/businessOfferings'
import { MenuSourceItem } from './MenuSourceItem'
import { MenuExtractionCard } from './MenuExtractionCard'
import { supabase } from '../../../../lib/supabase'
import { 
  useMenuSources, 
  useMenuExtractions, 
  useMenuHandlers,
  type MenuType,
  type MenuExtraction,
  type MenuUrlState
} from './hooks'

// Re-export types for other components
export type { MenuType, MenuExtraction, MenuUrlState }

// Menu Signal interface (matches backend MenuSignalResult)
interface MenuSignalResult {
  hasMenu: boolean
  menuDescription: string | null
  menuCategories: string[] | null
  signatureItems: string[] | null
  rawExtract: string | null
}

/**
 * Detect menu type from URL path and common patterns
 * Returns a descriptive name instead of just 'standard'
 * Patterns are sorted by length (longest first) to match specific terms before generic ones
 */
function detectMenuTypeFromUrl(url: string): { type: MenuType; label: string } {
  const urlLower = url.toLowerCase()
  const pathMatch = urlLower.match(/\/([^\/]+)\/?$/) // Get last path segment
  const path = pathMatch?.[1] || ''
  
  // Danish menu type patterns - ordered from most specific to least specific
  const patterns: Array<[string, string]> = [
    // Compound/specific patterns FIRST (before their base words)
    ['julefrokost', 'Julefrokost'],
    ['aftensmad', 'Aftenmenu'],
    ['take-away', 'Takeaway'],
    ['a-la-carte', 'À la carte'],
    ['alacarte', 'À la carte'],
    ['vinmenu', 'Vinkort'],
    ['menukort', 'Menukort'],
    
    // Time-based
    ['morgenmad', 'Morgenmad'],
    ['brunch', 'Brunch'],
    ['frokost', 'Frokost'],
    ['lunch', 'Frokost'],
    ['middag', 'Middag'],
    ['dinner', 'Middag'],
    ['aften', 'Aftenmenu'],
    ['evening', 'Aftenmenu'],
    
    // Drink menus
    ['cocktails', 'Cocktails'],
    ['cocktail', 'Cocktails'],
    ['drikkevarer', 'Drikkevarer'],
    ['drinks', 'Drinks'],
    ['vine', 'Vinkort'],
    ['wine', 'Vinkort'],
    ['vin', 'Vinkort'],
    ['beer', 'Ølkort'],
    ['bar', 'Barmenu'],
    ['ol', 'Ølkort'],
    
    // Food types
    ['desserter', 'Desserter'],
    ['dessert', 'Desserter'],
    ['forretter', 'Forretter'],
    ['starters', 'Forretter'],
    ['hovedretter', 'Hovedretter'],
    ['mains', 'Hovedretter'],
    ['burgers', 'Burgere'],
    ['burger', 'Burgere'],
    ['sandwich', 'Sandwich'],
    ['pizza', 'Pizza'],
    ['sushi', 'Sushi'],
    ['tapas', 'Tapas'],
    
    // Special menus
    ['takeaway', 'Takeaway'],
    ['catering', 'Catering'],
    ['selskab', 'Selskabsmenu'],
    ['event', 'Eventmenu'],
    ['christmas', 'Julemenu'],
    ['jul', 'Julemenu'],
    ['easter', 'Påskemenu'],
    ['paske', 'Påskemenu'],
    ['weekend', 'Weekendmenu'],
    ['sæson', 'Sæsonmenu'],
    ['season', 'Sæsonmenu'],
    
    // Generic (last)
    ['menu', 'Menukort'],
    ['kort', 'Menukort']
  ]
  
  // Check patterns in order (specific first)
  for (const [pattern, label] of patterns) {
    if (path.includes(pattern) || urlLower.includes(`/${pattern}/`) || urlLower.includes(`/${pattern}.`)) {
      return { type: 'standard', label }
    }
  }
  
  // Default to generic menu
  return { type: 'standard', label: 'Menukort' }
}

interface MenuOfferingsPanelProps {
  t: TFunction
  menuDescription: string
  onMenuDescriptionChange: (value: string) => void
  businessOfferings?: BusinessOfferingsProfile
  detectedMenuUrls?: string[]
  analysisComplete?: boolean
  businessId: string
  userId?: string
  websiteUrl?: string
}

export function MenuOfferingsPanel({
  t: _t,
  menuDescription,
  onMenuDescriptionChange,
  businessOfferings,
  detectedMenuUrls: _detectedMenuUrls = [],
  analysisComplete = false,
  businessId,
  userId,
  websiteUrl
}: MenuOfferingsPanelProps) {
  const [isDetectingMenus, setIsDetectingMenus] = React.useState(false)
  const [menuSignal, setMenuSignal] = React.useState<MenuSignalResult | null>(null)
  
  // Load menu_signal from business_profile
  React.useEffect(() => {
    if (!businessId) return
    
    const loadMenuSignal = async () => {
      const { data, error } = await supabase
        .from('business_profile')
        .select('menu_signal')
        .eq('business_id', businessId)
        .single()
      
      if (error) {
        console.error('Error loading menu_signal:', error)
        return
      }
      
      if (data?.menu_signal) {
        setMenuSignal(data.menu_signal as MenuSignalResult)
        console.log('📋 Loaded menu_signal:', data.menu_signal)
      }
    }
    
    loadMenuSignal()
  }, [businessId])
  
  // Initialize all hooks
  const menuSources = useMenuSources(businessId, userId)
  const menuExtractions = useMenuExtractions(businessId, userId)
  const menuHandlers = useMenuHandlers({
    menuDescription,
    onMenuDescriptionChangeCallback: onMenuDescriptionChange,
    businessId,
    userId,
    setMenuExtractions: menuExtractions.setMenuExtractions,
    setExpandedMenus: menuExtractions.setExpandedMenus,
    menuExtractions: menuExtractions.menuExtractions,
    expandedMenus: menuExtractions.expandedMenus,
    loadMenuExtractions: menuExtractions.loadMenuExtractions,
    updateMenuUrl: menuSources.updateMenuUrl,
    extractMenuNameFromSource: menuSources.extractMenuNameFromSource,
    menuUrls: menuSources.menuUrls,
    newMenuInput: menuSources.newMenuInput,
    setNewMenuInput: menuSources.setNewMenuInput,
    saveMenuSourceToDB: menuSources.saveMenuSourceToDB
  })

  const handleDetectNewMenus = async () => {
    if (!websiteUrl) {
      menuHandlers.setProcessingError('Ingen hjemmeside angivet')
      return
    }

    setIsDetectingMenus(true)
    menuHandlers.setProcessingError('')

    try {
      console.log('🔍 Detecting new menu URLs from:', websiteUrl)
      
      // Import supabase
      const { supabase } = await import('../../../../lib/supabase')
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token

      // Call analyze-website Edge Function
      const endpoint = import.meta.env.VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE as string
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          url: websiteUrl,
          businessId
        })
      })

      if (!response.ok) {
        throw new Error('Vi kunne ikke analysere hjemmesiden. Tjek at linket virker.')
      }

      const result = await response.json()

      const persistenceDebugEnabled =
        String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase() === 'true' ||
        String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase() === '1' ||
        String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase() === 'yes' ||
        String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase() === 'on' ||
        String(import.meta.env.VITE_BUSINESS_PROFILER_DEBUG || '').toLowerCase() === 'true' ||
        String(import.meta.env.VITE_BUSINESS_PROFILER_DEBUG || '').toLowerCase() === '1' ||
        String(import.meta.env.VITE_BUSINESS_PROFILER_DEBUG || '').toLowerCase() === 'yes' ||
        String(import.meta.env.VITE_BUSINESS_PROFILER_DEBUG || '').toLowerCase() === 'on'

      if (persistenceDebugEnabled) {
        console.debug('🧾 analyze-website _persistence (detect menus):', (result as any)?._persistence)
      }
      const newMenuUrls = result.detectedMenuUrls || result.allMenuUrls || []

      console.log('✅ Detected menu URLs:', newMenuUrls)

      if (newMenuUrls.length === 0) {
        menuHandlers.setProcessingError('Vi fandt ingen menukort på hjemmesiden. Prøv at tilføje linket manuelt eller upload en PDF.')
        setIsDetectingMenus(false)
        return
      }

      // Get existing menu sources
      const { data: existingSources } = await supabase
        .from('menu_sources')
        .select('source_url')
        .eq('business_id', businessId)

      const existingUrls = new Set(existingSources?.map(s => s.source_url) || [])
      const urlsToAdd = newMenuUrls.filter((url: string) => !existingUrls.has(url))

      if (urlsToAdd.length === 0) {
        menuHandlers.setProcessingError('Dine menukort er allerede tilføjet ✅')
        setIsDetectingMenus(false)
        return
      }

      // Add new URLs to menu_sources with smart type detection
      const menuSourcesToInsert = urlsToAdd.map((url: string) => {
        const detected = detectMenuTypeFromUrl(url)
        console.log(`🍽️ Detected menu type for ${url}: ${detected.label}`)
        return {
          business_id: businessId,
          source_url: url,
          source_type: 'url' as const,
          source_origin: 'ai_detected' as const,
          status: 'pending' as const,
          menu_type: detected.type,
          label: detected.label,
          created_by: userId,
          created_at: new Date().toISOString()
        }
      })

      const { error } = await supabase
        .from('menu_sources')
        .insert(menuSourcesToInsert)

      if (error) {
        throw new Error('Vi kunne ikke gemme menukortet. Prøv igen om lidt.')
      }

      console.log(`✅ Added ${urlsToAdd.length} new menu URLs`)

      // Reload menu sources to get the new records
      await menuSources.loadMenuSources()

      // Auto-trigger extraction for each newly added URL
      console.log('🚀 Auto-triggering extraction for newly added URLs...')
      for (const url of urlsToAdd) {
        try {
          await menuHandlers.extractMenuFromUrl(url)
          console.log(`✅ Triggered extraction for: ${url}`)
        } catch (err) {
          console.error(`❌ Failed to trigger extraction for ${url}:`, err)
        }
      }

      setIsDetectingMenus(false)
    } catch (error) {
      console.error('Error detecting menus:', error)
      menuHandlers.setProcessingError((error as Error).message)
      setIsDetectingMenus(false)
    }
  }

  // Filter URLs by source and status
  const aiFoundUrls = menuSources.menuUrls.filter(m => m.source === 'ai' && m.status !== 'ignored')
  const manualUrls = menuSources.menuUrls.filter(m => m.source === 'manual' && m.status !== 'ignored')
  void menuDescription

  return (
    <div className="space-y-8">
      {/* AI MENU PREVIEW - Shows what website analysis found (Free tier) */}
      {menuSignal?.hasMenu && (
        <div className="bg-gradient-to-r from-blue-50 to-cta-surface border border-blue-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🍽️</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-semibold text-blue-900">AI Menu Oversigt</h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-200 text-blue-800 rounded-full">Fra website analyse</span>
              </div>
              {menuSignal.menuDescription && (
                <p className="text-sm text-blue-800 mb-3 leading-relaxed">
                  {menuSignal.menuDescription}
                </p>
              )}
              {menuSignal.signatureItems && menuSignal.signatureItems.length > 0 && (
                <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-900 mb-2">🌟 Signaturetter fundet:</p>
                  <div className="flex flex-wrap gap-2">
                    {menuSignal.signatureItems.map((item, idx) => (
                      <span 
                        key={idx}
                        className="px-2.5 py-1 bg-white text-blue-800 text-xs font-medium rounded-full border border-blue-200"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {menuSignal.menuCategories && menuSignal.menuCategories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {menuSignal.menuCategories.map((cat: string, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 text-xs bg-surface-alt border border-border text-text-secondary rounded">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-600">
                  💡 <span className="font-medium">Tips:</span> Dette er en hurtig oversigt. For at få fuld menu-udtrækning med priser og beskrivelser, tilføj menulinks eller upload PDF nedenfor.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MENU SOURCES SECTION - Always visible for user input */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 px-5 pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Menu-kilder</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Hvor kommer mine menuer fra?
                </p>
              </div>
              {/* Find New Menu Links Button */}
              {websiteUrl && (
                <button
                  onClick={handleDetectNewMenus}
                  disabled={isDetectingMenus}
                  className="px-4 py-2 text-sm font-medium text-cta bg-white border border-cta rounded-lg hover:bg-cta-surface transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDetectingMenus ? 'Søger...' : 'Find nye menu-links'}
                </button>
              )}
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* AI-FOUND SOURCES */}
            {aiFoundUrls.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <span>🧠</span>
                  <span>Fundet af AI</span>
                </div>
                <div className="space-y-2">
                  {aiFoundUrls.map((menu) => (
                    <MenuSourceItem
                      key={menu.url}
                      menu={menu}
                      onMenuTypeChange={menuSources.handleMenuTypeChange}
                      onExtract={menuHandlers.extractMenuFromUrl}
                      onUndoDelete={menuSources.undoDelete}
                      onInitiateDelete={menuSources.initiateDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* MANUAL SOURCES */}
            {manualUrls.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <span>➕</span>
                  <span>Tilføjet af dig</span>
                </div>
                <div className="space-y-2">
                  {manualUrls.map((menu) => (
                    <MenuSourceItem
                      key={menu.url}
                      menu={menu}
                      onMenuTypeChange={menuSources.handleMenuTypeChange}
                      onExtract={menuHandlers.extractMenuFromUrl}
                      onUndoDelete={menuSources.undoDelete}
                      onInitiateDelete={menuSources.initiateDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ADD MENU SECTION - Always visible */}
            <div className="pt-2 border-t border-gray-200">
              {!menuSources.showAddMenu && (
                <button
                  onClick={() => menuSources.setShowAddMenu(true)}
                  className="flex items-center gap-2 text-sm font-medium text-cta hover:text-cta-text transition-colors"
                >
                  <span>+</span>
                  <span>Tilføj menu</span>
                </button>
              )}

              {menuSources.showAddMenu && !menuSources.addMenuMode && (
                <div className="space-y-2">
                  <button
                    onClick={() => menuSources.setAddMenuMode('link')}
                    className="flex items-center gap-2 text-sm font-medium text-cta hover:text-cta-text transition-colors"
                  >
                    <span>🔗</span>
                    <span>Indsæt link</span>
                  </button>
                  <button
                    onClick={() => menuSources.setAddMenuMode('text')}
                    className="flex items-center gap-2 text-sm font-medium text-cta hover:text-cta-text transition-colors"
                  >
                    <span>✍️</span>
                    <span>Indtast menu selv</span>
                  </button>
                  <button
                    onClick={() => {
                      menuSources.setShowAddMenu(false)
                      menuSources.setAddMenuMode(null)
                    }}
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors mt-2"
                  >
                    <span>✕</span>
                    <span>Luk</span>
                  </button>
                </div>
              )}

              {/* Link input mode */}
              {menuSources.showAddMenu && menuSources.addMenuMode === 'link' && (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={menuSources.newMenuInput}
                    onChange={(e) => menuSources.setNewMenuInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        try {
                          menuSources.addManualMenu(menuSources.newMenuInput)
                          menuSources.setAddMenuMode(null)
                        } catch (err) {
                          menuHandlers.setProcessingError((err as Error).message)
                        }
                      } else if (e.key === 'Escape') {
                        menuSources.setAddMenuMode(null)
                        menuSources.setNewMenuInput('')
                      }
                    }}
                    placeholder="https://eksempel.dk/menu"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cta focus:border-transparent"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        try {
                          menuSources.addManualMenu(menuSources.newMenuInput)
                          menuSources.setAddMenuMode(null)
                        } catch (err) {
                          menuHandlers.setProcessingError((err as Error).message)
                        }
                      }}
                      disabled={!menuSources.newMenuInput.trim()}
                      className="px-3 py-2 text-sm font-medium text-white bg-cta rounded hover:bg-cta-hover transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Tilføj
                    </button>
                    <button
                      onClick={() => {
                        menuSources.setAddMenuMode(null)
                        menuSources.setNewMenuInput('')
                      }}
                      className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      Annuller
                    </button>
                  </div>
                </div>
              )}

              {/* Text input mode */}
              {menuSources.showAddMenu && menuSources.addMenuMode === 'text' && (
                <div className="space-y-2">
                  <textarea
                    placeholder={_t('ui.menu.placeholder.example_list')}
                    value={menuSources.newMenuInput}
                    onChange={(e) => menuSources.setNewMenuInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        menuSources.setAddMenuMode(null)
                        menuSources.setNewMenuInput('')
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cta focus:border-transparent resize-vertical min-h-[120px]"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (menuSources.newMenuInput.trim()) {
                          menuHandlers.handleManualMenuEntry()
                          menuSources.setAddMenuMode(null)
                          menuSources.setNewMenuInput('')
                        }
                      }}
                      disabled={!menuSources.newMenuInput.trim()}
                      className="px-3 py-2 text-sm font-medium text-white bg-cta rounded hover:bg-cta-hover transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Analysér menu
                    </button>
                    <button
                      onClick={() => {
                        menuSources.setAddMenuMode(null)
                        menuSources.setNewMenuInput('')
                      }}
                      className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      Annuller
                    </button>
                  </div>
                </div>
              )}
            </div>

            {menuHandlers.processingError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {menuHandlers.processingError}
              </div>
            )}
          </div>
        </div>

      {/* Replace Standard Menu Confirmation */}
      {menuSources.replaceStandardMenuId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Erstat nuværende standardmenu?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Du har allerede en standardmenu. Kun én standardmenu er tilladt. Vil du erstatte den med denne?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => menuSources.setReplaceStandardMenuId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fortryd
              </button>
              <button
                onClick={menuSources.confirmReplaceStandardMenu}
                className="px-4 py-2 text-sm font-medium text-white bg-cta rounded-lg hover:bg-cta-hover transition-colors"
              >
                Erstat
              </button>
            </div>
          </div>
        </div>
      )}

      {(!businessOfferings || !businessOfferings.categories || businessOfferings.categories.length === 0) && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-amber-900 mb-1">
                  Vi kunne ikke finde din menu
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed mb-2">
                  AI'en har scannet din hjemmeside, men kunne ikke identificere en struktureret menu. Dette kan skyldes:
                </p>
                <ul className="text-xs text-amber-800 space-y-1 ml-4 mb-3">
                  <li className="flex gap-1.5">
                    <span>•</span>
                    <span>Menuen er i et PDF eller billede (ikke som tekst)</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span>•</span>
                    <span>Menuen er beskyttet eller kræver login</span>
                  </li>
                  <li className="flex gap-1.5">
                    <span>•</span>
                    <span>Hjemmesiden har ikke en dedikeret menuside</span>
                  </li>
                </ul>
                <p className="text-xs text-amber-700 font-medium">
                  💡 Prøv at indsætte et direkte link til en PDF eller menuside, eller beskriv din menu nedenfor.
                </p>
              </div>
            </div>
          </div>

          {/* Options: URL or Text */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">Tilføj din menu</h4>

            {/* Option 1: Menu URL */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Direkte link til PDF eller menuside</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://eksempel.dk/menu eller https://eksempel.dk/menu.pdf"
                  value={menuHandlers.menuUrl}
                  onChange={(e) => menuHandlers.setMenuUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  disabled={menuHandlers.isProcessing}
                />
                <button
                  onClick={menuHandlers.handleFetchMenuUrl}
                  disabled={menuHandlers.isProcessing || !menuHandlers.menuUrl.trim()}
                  className="px-4 py-2 bg-cta text-white rounded-lg text-sm font-medium hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {menuHandlers.isProcessing ? 'Henter...' : 'Hent'}
                </button>
              </div>
            </div>

            {/* Option 2: Manual Menu Entry */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Indtast menu selv</label>
              <div className="space-y-2">
                <textarea
                  placeholder="Skriv menunavn på første linje, derefter hver menuret på en ny linje.&#10;&#10;Eksempel:&#10;Frokostmenu&#10;Smørrebrød med røget laks&#10;Fiskefrikadeller&#10;Salat med kylling"
                  value={menuHandlers.manualMenuText}
                  onChange={(e) => {
                    const text = e.target.value
                    if (text.length <= 5000) {
                      menuHandlers.setManualMenuText(text)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical min-h-[100px] disabled:opacity-50"
                  disabled={menuHandlers.isProcessing}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {menuHandlers.manualMenuText.length} / 5000 tegn
                  </span>
                  <button
                    onClick={menuHandlers.handleManualMenuEntry}
                    disabled={menuHandlers.isProcessing || !menuHandlers.manualMenuText.trim()}
                    className="px-4 py-2 bg-cta text-white rounded-lg text-sm font-medium hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <AnalyzeIcon className={menuHandlers.isProcessing ? 'w-4 h-4 animate-spin motion-reduce:animate-none' : 'w-4 h-4'} />
                    <span>{menuHandlers.isProcessing ? 'Analyserer...' : 'Analysér menu'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Processing indicator */}
            {menuHandlers.isProcessing && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <AnalyzeIcon className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                <span>Behandler...</span>
              </div>
            )}

            {/* Error message */}
            {menuHandlers.processingError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {menuHandlers.processingError}
              </div>
            )}

          </div>
        </div>
      )}

      {/* AI forstået Menu Section - Dynamic collapsible menus */}
      {analysisComplete && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 pt-4 pb-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              📋 AI forstået Menu
            </h3>
            <p className="text-xs text-gray-600">
              Hentede menuer grupperet efter type. Klik for at udvide og rediger menunavn.
            </p>
          </div>

          {menuExtractions.menuExtractions.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">
                Ingen menuer hentet endnu. Indsæt et link i sektionen ovenfor.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Group by menu_type: Standard → Midlertidig → Custom names */}
              {(['standard', 'special'] as MenuType[]).map(type => {
                const itemsOfType = menuExtractions.menuExtractions.filter(m => m.menu_type === type)
                if (itemsOfType.length === 0) return null

                return (
                  <div key={`type-${type}`} className="space-y-2">
                    {itemsOfType.map((extraction, idx) => {
                        const isExpanded = menuExtractions.expandedMenus.has(extraction.id)
                        const isEditing = menuExtractions.editingMenuId === extraction.id

                        return (
                          <div key={`extraction-${type}-${idx}-${extraction.id}`}>
                            <MenuExtractionCard
                              extraction={extraction}
                            isExpanded={isExpanded}
                          isEditingName={isEditing}
                          editingNameValue={menuExtractions.editingMenuName}
                          editingMenuItemsMode={menuExtractions.editingMenuItemsMode}
                          editingItemId={menuExtractions.editingItemId}
                          editingItemName={menuExtractions.editingItemName}
                          editingItemDesc={menuExtractions.editingItemDesc}
                          onToggleExpand={() => {
                            const next = new Set(menuExtractions.expandedMenus)
                            if (next.has(extraction.id)) {
                              next.delete(extraction.id)
                            } else {
                              next.add(extraction.id)
                            }
                            menuExtractions.setExpandedMenus(next)
                          }}
                          onStartEditName={(name) => {
                            menuExtractions.setEditingMenuId(extraction.id)
                            menuExtractions.setEditingMenuName(name)
                          }}
                          onUpdateName={menuExtractions.setEditingMenuName}
                          onEndEditName={() => menuExtractions.setEditingMenuId(null)}
                          onToggleItemsEditMode={() => menuExtractions.setEditingMenuItemsMode(extraction.id)}
                          onSaveItems={() => menuExtractions.saveMenuItems(extraction.id, menuExtractions.menuExtractions.find(m => m.id === extraction.id)!)}
                          onCancelItemsEdit={() => {
                            menuExtractions.setEditingMenuItemsMode(null)
                            menuExtractions.loadMenuExtractions()
                          }}
                          onStartEditItem={(itemKey, name, desc) => {
                            menuExtractions.setEditingItemId(itemKey)
                            menuExtractions.setEditingItemName(name)
                            menuExtractions.setEditingItemDesc(desc)
                          }}
                          onUpdateItemName={menuExtractions.setEditingItemName}
                          onUpdateItemDesc={menuExtractions.setEditingItemDesc}
                          onSaveItem={(catIdx, itemIdx, name, desc) => {
                            menuExtractions.updateMenuItem(extraction.id, catIdx, itemIdx, {
                              name,
                              short_desc: desc
                            })
                            menuExtractions.setEditingItemId(null)
                          }}
                          onCancelItemEdit={() => menuExtractions.setEditingItemId(null)}
                          onDeleteItem={(catIdx, itemIdx) => {
                            const updated = JSON.parse(JSON.stringify(extraction)) as MenuExtraction
                            updated.extracted_data.categories[catIdx].items.splice(itemIdx, 1)
                            menuExtractions.setMenuExtractions(menuExtractions.menuExtractions.map(m => m.id === extraction.id ? updated : m))
                            menuExtractions.saveMenuItemsToDatabase(updated)
                          }}
                          onDeleteExtraction={menuExtractions.deleteMenuExtraction}
                          onUpdateExtractionName={menuExtractions.updateMenuExtractionName}
                            />
                          </div>
                        )
                      })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
