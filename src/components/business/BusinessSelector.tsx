import { useTranslation } from 'react-i18next'
import { BuildingOffice2Icon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useBusinessStore } from '../../stores/businessStore'

interface Business {
  id: string
  business_name: string
  owner_id: string
  created_at?: string
}

interface BusinessSelectorProps {
  businesses: Business[]
  onSelect: (businessId: string) => void
}

/**
 * Business Selector Component
 * 
 * Shown when multiple businesses are detected for a single account.
 * Allows user to choose which business to work with.
 * 
 * Note: Currently, Post2Grow supports one business per account.
 * This selector handles edge cases where AI detects or user creates multiple businesses.
 * Future enterprise tier will fully support multiple businesses.
 */
export function BusinessSelector({ businesses, onSelect }: BusinessSelectorProps) {
  const { t } = useTranslation()
  const { selectedBusinessId } = useBusinessStore()

  const handleSelect = (businessId: string) => {
    onSelect(businessId)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <BuildingOffice2Icon className="h-8 w-8 text-[#076B4E]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Vælg din virksomhed
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Vi har fundet flere virksomheder på din konto. Vælg hvilken du vil arbejde med.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {businesses.map((business) => {
              const isSelected = selectedBusinessId === business.id
              
              return (
                <button
                  key={business.id}
                  onClick={() => handleSelect(business.id)}
                  className={`
                    w-full p-4 rounded-lg border-2 transition-all text-left
                    ${isSelected 
                      ? 'border-[#076B4E] bg-[#076B4E]/5' 
                      : 'border-gray-200 hover:border-[#076B4E]/50 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <BuildingOffice2Icon className={`h-6 w-6 ${isSelected ? 'text-[#076B4E]' : 'text-gray-400'}`} />
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {business.business_name || 'Unavngivet virksomhed'}
                          </h3>
                          {business.created_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              Oprettet {new Date(business.created_at).toLocaleDateString('da-DK', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="flex-shrink-0 ml-4">
                        <CheckCircleIcon className="h-6 w-6 text-[#076B4E]" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Kun én virksomhed per konto
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  Post2Grow understøtter i øjeblikket én virksomhed per konto. Hvis du har behov for at håndtere flere virksomheder, kontakt os for information om vores kommende Enterprise plan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
