import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createClient } from '@supabase/supabase-js'
import { useConnectionsStore } from '../../../stores/connectionsStore'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

interface FreeBusinessProfileProps {
  onUpgrade: () => void
}

export function FreeBusinessProfile({ onUpgrade }: FreeBusinessProfileProps) {
  const { t } = useTranslation()
  const loadPlatformsFromDatabase = useConnectionsStore((state) => state.loadPlatformsFromDatabase)

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [hasTableSeating, setHasTableSeating] = useState(false)
  const [menus, setMenus] = useState<string[]>([])
  const [serviceModel, setServiceModel] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const defaultCountry = t('ui.country.default_name')
  const [country, setCountry] = useState(defaultCountry)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [isFetchingCity, setIsFetchingCity] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get user's business
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('id, name, vertical, has_table_seating, menus, service_model')
          .eq('owner_id', user.id)
          .maybeSingle()

        console.log('🏢 Business data fetched:', { business, businessError })

        if (businessError) {
          console.error('❌ Error fetching business:', businessError)
        }

        if (business) {
          setBusinessId(business.id as string)
          setBusinessName((business.name as string) || '')
            setBusinessType((business.vertical as string) || '')
            setHasTableSeating(Boolean((business as any).has_table_seating))
            setMenus((business as any).menus || [])
            setServiceModel((business as any).service_model || '')

          // Get location data
          const { data: location } = await supabase
            .from('business_locations')
            .select('postal_code, city, country')
            .eq('business_id', business.id)
            .maybeSingle()

          console.log('📍 Location data fetched:', location)

          if (location) {
            const postal = (location.postal_code as string) || ''
            const cityName = (location.city as string) || ''
            const countryName = (location.country as string) || defaultCountry
            
            console.log('📍 Setting location:', { postal, cityName, countryName })
            
            setPostalCode(postal)
            setCity(cityName)
            setCountry(countryName)
          } else {
            console.warn('⚠️ No location data found for business:', business.id)
          }

          // Get profile data for phone/email
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone, email')
            .eq('id', user.id)
            .maybeSingle()

          if (profile) {
            setPhone((profile.phone as string) || '')
            setEmail((profile.email as string) || '')
          }
        }
      } catch (error) {
        console.error('Error fetching business data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBusinessData()
  }, [])

  // Auto-lookup city from postal code
  useEffect(() => {
    const sanitizedPostalCode = postalCode.trim()
    if (sanitizedPostalCode.length !== 4) {
      setIsFetchingCity(false)
      return
    }

    let isActive = true
    const lookupCity = async () => {
      setIsFetchingCity(true)
      try {
        const response = await fetch(`https://api.dataforsyningen.dk/postnumre/${sanitizedPostalCode}`)
        if (!response.ok) throw new Error('Postal lookup failed')
        const data = await response.json()
        if (isActive && data?.navn) {
          setCity(data.navn)
        }
      } catch (error) {
        console.error('Postal code lookup error:', error)
      } finally {
        if (isActive) setIsFetchingCity(false)
      }
    }

    lookupCity()
    return () => { isActive = false }
  }, [postalCode])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveMessage(null)
    setIsSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      if (!businessId) throw new Error('Business not found')

      // Update business
      const { error: businessError } = await supabase
        .from('businesses')
        .update({
          name: businessName.trim(),
          vertical: businessType,
          has_table_seating: hasTableSeating,
          menus: menus && menus.length > 0 ? menus : null,
          service_model: serviceModel || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId)

      if (businessError) throw businessError

      // Update location - check if primary exists first, then update or insert
      const { data: existingLocation } = await supabase
        .from('business_locations')
        .select('id')
        .eq('business_id', businessId)
        .eq('is_primary', true)
        .maybeSingle()
      
      let locationError
      if (existingLocation) {
        // Update existing primary location
        const result = await supabase
          .from('business_locations')
          .update({
            postal_code: postalCode.trim(),
            city: city.trim(),
            country: country.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('business_id', businessId)
          .eq('is_primary', true)
        locationError = result.error
      } else {
        // Insert new primary location
        const result = await supabase
          .from('business_locations')
          .insert({
            business_id: businessId,
            is_primary: true,
            postal_code: postalCode.trim(),
            city: city.trim(),
            country: country.trim(),
            updated_at: new Date().toISOString()
          })
        locationError = result.error
      }

      if (locationError) throw locationError

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          phone: phone.trim(),
          email: email.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (profileError) throw profileError

      setSaveMessage({ type: 'success', text: t('businessProfile.saveSuccess') })
    } catch (error) {
      console.error('Error saving business data:', error)
      setSaveMessage({ type: 'error', text: t('businessProfile.saveError') })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-slate-600">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('navigation.businessProfile')}</h1>
        <p className="text-sm text-slate-600 mt-1">{t('businessProfile.freeSubtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Information Card */}
        <div className="bg-white rounded-lg shadow border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">{t('businessProfile.basicInfo')}</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Business Name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-slate-700 mb-1">
                {t('businessProfile.businessName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={t('businessProfile.businessNamePlaceholder')}
                required
              />
            </div>

            {/* Business Type */}
            <div>
              <label htmlFor="businessType" className="block text-sm font-medium text-slate-700 mb-1">
                {t('businessProfile.businessType')}
              </label>
              <select
                id="businessType"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select type</option>
                <option value="café">Café/Restaurant</option>
                <option value="retail">Retail</option>
                <option value="service">Service</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Capabilities (table seating, menus, service model) */}
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-3">
                <input id="hasTableSeating" type="checkbox" checked={hasTableSeating} onChange={(e) => setHasTableSeating(e.target.checked)} className="h-4 w-4" />
                <label htmlFor="hasTableSeating" className="text-sm text-slate-700">Table seating available</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Menus</label>
                <div className="flex flex-wrap gap-2">
                  {['food','drinks','coffee','snacks','sandwich'].map((m) => (
                    <label key={m} className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 rounded-md text-sm">
                      <input type="checkbox" checked={menus.includes(m)} onChange={(e) => {
                        if (e.target.checked) setMenus(prev => Array.from(new Set([...prev, m])))
                        else setMenus(prev => prev.filter(x => x !== m))
                      }} />
                      <span className="capitalize">{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="serviceModel" className="block text-sm font-medium text-slate-700 mb-1">Service Model</label>
                <select id="serviceModel" value={serviceModel} onChange={(e) => setServiceModel(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="">Select</option>
                  <option value="full_service">Full service</option>
                  <option value="limited_service">Limited service</option>
                  <option value="counter">Counter / Grab-and-go</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('businessProfile.postalCode')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="postalCode"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="2300"
                  maxLength={4}
                  required
                />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('businessProfile.city')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
                  placeholder={isFetchingCity ? 'Looking up...' : 'Copenhagen'}
                  readOnly={isFetchingCity}
                  required
                />
              </div>
            </div>

            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-slate-700 mb-1">
                {t('businessProfile.country')}
              </label>
              <input
                id="country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Contact Information Card */}
        <div className="bg-white rounded-lg shadow border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">{t('businessProfile.contactInfo')}</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                {t('businessProfile.phone')}
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="+45 12 34 56 78"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                {t('businessProfile.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="info@business.dk"
              />
            </div>
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`p-4 rounded-lg ${
            saveMessage.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* Save Button */}
        <div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>

      {/* Upgrade CTA */}
      <div className="mt-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <StarIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {t('businessProfile.unlockMore')}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {t('businessProfile.upgradeDescription')}
            </p>
            <ul className="space-y-2 mb-4">
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <LockIcon className="w-4 h-4 mt-0.5 text-purple-600 flex-shrink-0" />
                <span>{t('businessProfile.feature.website')}</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <LockIcon className="w-4 h-4 mt-0.5 text-purple-600 flex-shrink-0" />
                <span>{t('businessProfile.feature.hours')}</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <LockIcon className="w-4 h-4 mt-0.5 text-purple-600 flex-shrink-0" />
                <span>{t('businessProfile.feature.description')}</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <LockIcon className="w-4 h-4 mt-0.5 text-purple-600 flex-shrink-0" />
                <span>{t('businessProfile.feature.offerings')}</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <LockIcon className="w-4 h-4 mt-0.5 text-purple-600 flex-shrink-0" />
                <span>{t('businessProfile.feature.keywords')}</span>
              </li>
            </ul>
            <button
              onClick={onUpgrade}
              className="px-6 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              {t('navigation.upgrade')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
