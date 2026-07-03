import type { WeekSchedule } from '../../../../types/businessProfile'
import type { BusinessSector } from '../../../../types/businessSector'

interface ProfileState {
  analysisComplete: boolean
  businessName: string
  businessSector: BusinessSector | null
  businessCategory: string
  aboutText: string
  phone: string
  email: string
  websiteUrl: string
  bookingLink: string
  address: string
  postalCode: string
  city: string
  openingHours: WeekSchedule
  aboutUsUrl: string
  openingHoursUrl: string
}

type SectionType = 'grundoplysninger' | 'kontakt' | 'adresse' | 'åbningstider' | 'links'

export function getAiSourceStatus(
  sectionType: SectionType,
  state: ProfileState
): 'found' | 'partial' | 'notfound' {
  if (!state.analysisComplete) {
    return 'notfound'
  }

  if (sectionType === 'grundoplysninger') {
    const hasName = state.businessName.trim().length > 0 && state.businessName.trim() !== 'Min Virksomhed'
    const hasSector = Boolean(state.businessSector)
    const hasCategory = state.businessCategory.trim().length > 0
    const hasAbout = state.aboutText.trim().length > 0
    
    const coreFields = [hasName, hasSector].filter(Boolean).length
    const optionalFields = [hasCategory, hasAbout].filter(Boolean).length
    const totalFilled = coreFields + optionalFields
    
    if (coreFields >= 2 && totalFilled >= 3) return 'found'
    if (coreFields >= 2 || totalFilled >= 2) return 'partial'
    return 'notfound'
  }

  if (sectionType === 'kontakt') {
    const hasPhone = state.phone.trim().length > 0
    const hasEmail = state.email.trim().length > 0
    const hasWebsite = state.websiteUrl.trim().length > 0
    const hasBooking = state.bookingLink.trim().length > 0
    
    const totalFilled = [hasPhone, hasEmail, hasWebsite, hasBooking].filter(Boolean).length
    
    if (totalFilled >= 3) return 'found'
    if (totalFilled >= 1) return 'partial'
    return 'notfound'
  }

  if (sectionType === 'adresse') {
    const hasAddress = state.address.trim().length > 0
    const hasPostal = state.postalCode.trim().length > 0
    const hasCity = state.city.trim().length > 0
    
    const totalFilled = [hasAddress, hasPostal, hasCity].filter(Boolean).length
    
    if (totalFilled >= 3) return 'found'
    if (totalFilled >= 1) return 'partial'
    return 'notfound'
  }

  if (sectionType === 'åbningstider') {
    const hasOpeningHours = Object.values(state.openingHours).some(day => day.open || day.close)
    return hasOpeningHours ? 'found' : 'notfound'
  }

  if (sectionType === 'links') {
    const hasAboutUrl = state.aboutUsUrl.trim().length > 0
    const hasOpeningHoursUrl = state.openingHoursUrl.trim().length > 0
    
    const totalFilled = [hasAboutUrl, hasOpeningHoursUrl].filter(Boolean).length
    
    if (totalFilled >= 2) return 'found'
    if (totalFilled >= 1) return 'partial'
    return 'notfound'
  }

  return 'notfound'
}
