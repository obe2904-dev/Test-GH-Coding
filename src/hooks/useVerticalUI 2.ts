/**
 * useVerticalUI Hook
 * 
 * Provides UI adaptation logic based on business vertical.
 * Controls which forms/fields/features to show based on vertical capabilities.
 */

import { useMemo } from 'react'
import { 
  getVerticalConfig, 
  verticalHasCapability, 
  type BusinessVertical 
} from '../config/businessVerticals'

export interface VerticalUIConfig {
  // Data sections to show
  showMenuUpload: boolean
  showServiceList: boolean
  showPriceList: boolean
  showProductCatalog: boolean
  showBookingSystem: boolean
  showStaffProfiles: boolean
  showClassSchedule: boolean
  showInventoryManagement: boolean
  
  // Labels and terminology
  offeringLabel: string           // "Menu Items" vs "Services" vs "Products"
  offeringLabelPlural: string
  customerLabel: string           // "Guest" vs "Client" vs "Customer"
  customerLabelPlural: string
  locationLabel: string           // "Cafe" vs "Salon" vs "Studio"
  transactionLabel: string        // "Order" vs "Booking" vs "Appointment"
  
  // Content focus hints
  contentFocusPrimary: string[]
  contentFocusSeasonal: string[]
  visualStyleHints: string[]
  
  // Onboarding
  setupGuideEssential: string[]
  setupGuideOptional: string[]
  setupTip: string
}

export interface UseVerticalUIReturn {
  config: VerticalUIConfig
  vertical: BusinessVertical
  displayName: string
  category: string
  
  // Helper functions
  shouldShow: (feature: keyof VerticalUIConfig) => boolean
  getLabel: (key: 'offering' | 'customer' | 'location' | 'transaction') => string
  getSetupGuide: () => { essential: string[]; optional: string[]; tip: string }
}

/**
 * Hook to get vertical-specific UI configuration
 */
export function useVerticalUI(vertical?: BusinessVertical): UseVerticalUIReturn {
  const verticalConfig = useMemo(() => {
    if (!vertical) return null
    return getVerticalConfig(vertical)
  }, [vertical])

  const config: VerticalUIConfig = useMemo(() => {
    if (!verticalConfig) {
      // Default config if no vertical specified
      return {
        showMenuUpload: true,
        showServiceList: false,
        showPriceList: true,
        showProductCatalog: false,
        showBookingSystem: false,
        showStaffProfiles: false,
        showClassSchedule: false,
        showInventoryManagement: false,
        
        offeringLabel: 'Item',
        offeringLabelPlural: 'Items',
        customerLabel: 'Customer',
        customerLabelPlural: 'Customers',
        locationLabel: 'Business',
        transactionLabel: 'Transaction',
        
        contentFocusPrimary: [],
        contentFocusSeasonal: [],
        visualStyleHints: [],
        
        setupGuideEssential: [],
        setupGuideOptional: [],
        setupTip: ''
      }
    }

    const { dataSchema, terminology, contentFocus, setupGuide } = verticalConfig

    return {
      // Map data schema capabilities to UI features
      showMenuUpload: dataSchema.hasMenu,
      showServiceList: dataSchema.hasServiceList,
      showPriceList: dataSchema.hasPriceList,
      showProductCatalog: dataSchema.hasProductCatalog,
      showBookingSystem: dataSchema.hasBookingSystem,
      showStaffProfiles: dataSchema.hasStaffProfiles,
      showClassSchedule: dataSchema.hasClassSchedule,
      showInventoryManagement: dataSchema.hasInventory,
      
      // Terminology
      offeringLabel: terminology.offering,
      offeringLabelPlural: terminology.offeringPlural,
      customerLabel: terminology.customer,
      customerLabelPlural: terminology.customerPlural,
      locationLabel: terminology.location,
      transactionLabel: terminology.transaction,
      
      // Content focus
      contentFocusPrimary: contentFocus.primary,
      contentFocusSeasonal: contentFocus.seasonal,
      visualStyleHints: contentFocus.visualStyle,
      
      // Setup guide
      setupGuideEssential: setupGuide.essentialData,
      setupGuideOptional: setupGuide.optionalData,
      setupTip: setupGuide.tipForNewUsers
    }
  }, [verticalConfig])

  const shouldShow = (feature: keyof VerticalUIConfig): boolean => {
    const value = config[feature]
    return typeof value === 'boolean' ? value : false
  }

  const getLabel = (key: 'offering' | 'customer' | 'location' | 'transaction'): string => {
    switch (key) {
      case 'offering':
        return config.offeringLabel
      case 'customer':
        return config.customerLabel
      case 'location':
        return config.locationLabel
      case 'transaction':
        return config.transactionLabel
      default:
        return ''
    }
  }

  const getSetupGuide = () => ({
    essential: config.setupGuideEssential,
    optional: config.setupGuideOptional,
    tip: config.setupTip
  })

  return {
    config,
    vertical: vertical || 'cafe',
    displayName: verticalConfig?.displayName || 'Business',
    category: verticalConfig?.category || 'food-drink',
    shouldShow,
    getLabel,
    getSetupGuide
  }
}

/**
 * Helper: Get form sections to render based on vertical
 */
export function getVerticalFormSections(vertical: BusinessVertical): string[] {
  const sections: string[] = ['basic-info', 'location', 'hours']

  if (verticalHasCapability(vertical, 'hasMenu')) {
    sections.push('menu-upload')
  }

  if (verticalHasCapability(vertical, 'hasServiceList')) {
    sections.push('service-list')
  }

  if (verticalHasCapability(vertical, 'hasStaffProfiles')) {
    sections.push('staff-profiles')
  }

  if (verticalHasCapability(vertical, 'hasProductCatalog')) {
    sections.push('product-catalog')
  }

  if (verticalHasCapability(vertical, 'hasClassSchedule')) {
    sections.push('class-schedule')
  }

  if (verticalHasCapability(vertical, 'hasBookingSystem')) {
    sections.push('booking-settings')
  }

  sections.push('social-media')
  
  return sections
}

/**
 * Helper: Get placeholder text for offerings based on vertical
 */
export function getOfferingPlaceholder(vertical: BusinessVertical, language: 'en' | 'da' = 'en'): string {
  const config = getVerticalConfig(vertical)
  if (!config) return language === 'da' ? 'Tilføj varer...' : 'Add items...'

  const { offeringPlural } = config.terminology

  if (language === 'da') {
    return `Tilføj ${offeringPlural.toLowerCase()}...`
  }

  return `Add ${offeringPlural.toLowerCase()}...`
}

/**
 * Helper: Get empty state message for vertical
 */
export function getEmptyStateMessage(
  vertical: BusinessVertical, 
  section: 'menu' | 'services' | 'staff' | 'products' | 'classes',
  language: 'en' | 'da' = 'en'
): string {
  const config = getVerticalConfig(vertical)
  if (!config) return language === 'da' ? 'Ingen data endnu' : 'No data yet'

  const { offeringPlural } = config.terminology

  const messages = {
    en: {
      menu: `No menu items yet. Upload your menu to showcase your ${offeringPlural.toLowerCase()}.`,
      services: `No services yet. Add your ${offeringPlural.toLowerCase()} to help customers understand what you offer.`,
      staff: `No team members yet. Introduce your staff to build trust with customers.`,
      products: `No products yet. Add your product catalog to showcase what you sell.`,
      classes: `No classes scheduled yet. Add your class schedule to attract participants.`
    },
    da: {
      menu: `Ingen menupunkter endnu. Upload din menu for at vise dine ${offeringPlural.toLowerCase()}.`,
      services: `Ingen services endnu. Tilføj dine ${offeringPlural.toLowerCase()} for at hjælpe kunder med at forstå, hvad du tilbyder.`,
      staff: `Ingen teammedlemmer endnu. Præsenter dit personale for at opbygge tillid hos kunderne.`,
      products: `Ingen produkter endnu. Tilføj dit produktkatalog for at vise, hvad du sælger.`,
      classes: `Ingen hold planlagt endnu. Tilføj din holdplan for at tiltrække deltagere.`
    }
  }

  return messages[language][section] || messages.en[section]
}
