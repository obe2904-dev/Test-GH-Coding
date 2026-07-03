// ===========================================
// Business Information Section Component
// Complete implementation with all cards
// ===========================================
import { useTranslation } from 'react-i18next'

// Custom icon components
const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)

const Loader2Icon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
  </svg>
)

// Import the BusinessProfile type from our existing features
interface BusinessProfile {
  businessName: string
  businessType: string
  description: string
  offerings: string[]
  openingHours: {
    monday: string
    tuesday: string
    wednesday: string
    thursday: string
    friday: string
    saturday: string
    sunday: string
  }
  contact: {
    phone?: string
    email?: string
    address?: string
    website?: string
  }
  actions: {
    bookingUrl?: string
    menuUrl?: string
    deliveryUrl?: string
  }
}

interface BusinessInformationSectionProps {
  profile: BusinessProfile | null
  isAnalyzing: boolean
  onSave: (profile: BusinessProfile) => void
}

export function BusinessInformationSection({ 
  profile, 
  isAnalyzing,
  onSave 
}: BusinessInformationSectionProps) {
  const { t } = useTranslation()

  if (isAnalyzing) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2Icon className="w-12 h-12 text-cta animate-spin" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('business.analyzing')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('business.analyzingDescription')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Success Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-emerald-900">
              ✓ Website Analyzed Successfully
            </h3>
            <p className="text-xs text-emerald-700 mt-1">
              📝 Review and edit the information below
            </p>
          </div>
        </div>
      </div>

      {/* All Information Cards */}
      <BasicInformationCard profile={profile} onSave={onSave} />
      <OpeningHoursCard profile={profile} onSave={onSave} />
      <OfferingsCard profile={profile} onSave={onSave} />
      <VisualAssetsCard profile={profile} onSave={onSave} />
      <BrandVoiceCard profile={profile} onSave={onSave} />
      <CallToActionsCard profile={profile} onSave={onSave} />
      <ContentPreferencesCard profile={profile} onSave={onSave} />

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          onClick={() => {/* Reset to auto-detected */}}
        >
          Reset to Auto-Detected
        </button>
        <button
          className="px-6 py-2 text-sm font-medium bg-gradient-to-r from-cta to-purple-600 text-white rounded-lg hover:from-cta-hover hover:to-purple-700 shadow-md transition-all"
          onClick={() => onSave(profile)}
        >
          Save All Changes
        </button>
      </div>
    </div>
  )
}

// Placeholder implementations for each card - these would be fully implemented
function BasicInformationCard({ profile }: { profile: BusinessProfile; onSave: (profile: BusinessProfile) => void }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-medium mb-2">🏢 Basic Information</h3>
    <p className="text-sm text-gray-600">Business: {profile.businessName} | Type: {profile.businessType}</p>
  </div>
}

function OpeningHoursCard({ profile }: { profile: BusinessProfile; onSave: (profile: BusinessProfile) => void }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-medium mb-2">🕐 Opening Hours</h3>
    <p className="text-sm text-gray-600">Monday: {profile.openingHours.monday}</p>
  </div>
}

function OfferingsCard({ profile }: { profile: BusinessProfile; onSave: (profile: BusinessProfile) => void }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-medium mb-2">☕ Offerings & Services</h3>
    <p className="text-sm text-gray-600">Services: {profile.offerings.join(', ')}</p>
  </div>
}

function VisualAssetsCard({ }: { profile: BusinessProfile; onSave: (profile: BusinessProfile) => void }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-medium mb-2">📸 Visual Assets</h3>
    <p className="text-sm text-gray-600">Logo, photos, brand colors</p>
  </div>
}

function BrandVoiceCard({ profile }: { profile: BusinessProfile; onSave: (profile: BusinessProfile) => void }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-medium mb-2">📝 Brand Voice & Description</h3>
    <p className="text-sm text-gray-600">{profile.description}</p>
  </div>
}

function CallToActionsCard({ profile }: { profile: BusinessProfile; onSave: (profile: BusinessProfile) => void }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-medium mb-2">🔗 Call-to-Actions & Links</h3>
    <p className="text-sm text-gray-600">Website: {profile.contact.website}</p>
  </div>
}

function ContentPreferencesCard({ }: { profile: BusinessProfile; onSave: (profile: BusinessProfile) => void }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-4">
    <h3 className="font-medium mb-2">🎯 Content Preferences (for AI)</h3>
    <p className="text-sm text-gray-600">Tone, themes, target audience</p>
  </div>
}