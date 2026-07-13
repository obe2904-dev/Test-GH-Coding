import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface TestResult {
  success: boolean
  url?: string
  timing?: number
  html?: string
  htmlLength?: number
  structured?: {
    about: string[]
    address: string[]
    bookingLinks: string[]
    menuLinks: string[]
    openingHours: string[]
  }
  error?: string
  cloudRunUrl?: string
  hasApiKey?: boolean
  hasServiceAccount?: boolean
  metadata?: any
}

export default function TestCloudRunPage() {
  const [url, setUrl] = useState('https://www.noma.dk')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [showRawHtml, setShowRawHtml] = useState(false)

  const handleTest = async () => {
    if (!url.trim()) {
      alert('Please enter a URL')
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token

      const endpoint = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/test-cloud-run-scraper'
      
      console.log('🚀 Testing Cloud Run scraper:', url)
      console.log('📡 Endpoint:', endpoint)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ url: url.trim() })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log('📥 Result:', data)
      setResult(data)

    } catch (error: any) {
      console.error('❌ Test failed:', error)
      setResult({
        success: false,
        error: error.message || 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🧪 Cloud Run Scraper Test
        </h1>
        <p className="text-gray-600">
          Direct test of Cloud Run Puppeteer scraping - no cache, no fallbacks
        </p>
      </div>

      {/* Test Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={isLoading || !url.trim()}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
              isLoading
                ? 'bg-gray-400 text-white cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Testing Cloud Run...
              </span>
            ) : (
              '🚀 Test Cloud Run Scraper'
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div
            className={`rounded-lg p-4 ${
              result.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {result.success ? '✅' : '❌'}
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {result.success ? 'Success!' : 'Failed'}
                </h3>
                {result.timing && (
                  <p className="text-sm text-gray-600">
                    Response time: {result.timing}ms
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Error Details */}
          {!result.success && result.error && (
            <div className="bg-white rounded-lg shadow-sm border border-red-300 p-6">
              <h3 className="text-lg font-semibold text-red-800 mb-3">Error Details</h3>
              <pre className="bg-red-50 p-4 rounded text-sm text-red-900 overflow-x-auto whitespace-pre-wrap">
                {result.error}
              </pre>
              
              {/* Configuration Debug Info */}
              <div className="mt-4 pt-4 border-t border-red-200">
                <h4 className="font-medium text-red-800 mb-2">Configuration Status:</h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <span className="font-medium">Cloud Run URL:</span>{' '}
                    {result.cloudRunUrl || '❌ Not configured'}
                  </li>
                  <li>
                    <span className="font-medium">API Key:</span>{' '}
                    {result.hasApiKey ? '✅ Present' : '❌ Missing'}
                  </li>
                  <li>
                    <span className="font-medium">Service Account:</span>{' '}
                    {result.hasServiceAccount ? '✅ Present' : '❌ Missing'}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Success Results */}
          {result.success && result.html && (
            <>
              {/* Metadata */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Metadata</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-600">URL</dt>
                    <dd className="mt-1 text-sm text-gray-900 break-all">{result.url}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">HTML Length</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {result.htmlLength?.toLocaleString()} characters
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Response Time</dt>
                    <dd className="mt-1 text-sm text-gray-900">{result.timing}ms</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Scraper</dt>
                    <dd className="mt-1 text-sm text-gray-900">Cloud Run Puppeteer</dd>
                  </div>
                </dl>
              </div>

              {/* Structured Data */}
              {result.structured && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    📋 Extracted Structured Data
                  </h3>
                  
                  <div className="space-y-6">
                    {/* About */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">📖 About</h4>
                      {result.structured.about.length > 0 ? (
                        <ul className="space-y-2">
                          {result.structured.about.map((item, idx) => (
                            <li key={idx} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No about text found</p>
                      )}
                    </div>

                    {/* Address */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">📍 Address</h4>
                      {result.structured.address.length > 0 ? (
                        <ul className="space-y-2">
                          {result.structured.address.map((item, idx) => (
                            <li key={idx} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No addresses found</p>
                      )}
                    </div>

                    {/* Booking Links */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">🔗 Booking Links</h4>
                      {result.structured.bookingLinks.length > 0 ? (
                        <ul className="space-y-2">
                          {result.structured.bookingLinks.map((item, idx) => (
                            <li key={idx} className="text-sm">
                              <a
                                href={item}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {item}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No booking links found</p>
                      )}
                    </div>

                    {/* Menu Links */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">🍽️ Menu Links</h4>
                      {result.structured.menuLinks.length > 0 ? (
                        <ul className="space-y-2">
                          {result.structured.menuLinks.map((item, idx) => (
                            <li key={idx} className="text-sm">
                              <a
                                href={item}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {item}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No menu links found</p>
                      )}
                    </div>

                    {/* Opening Hours */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">🕐 Opening Hours</h4>
                      {result.structured.openingHours.length > 0 ? (
                        <ul className="space-y-2">
                          {result.structured.openingHours.map((item, idx) => (
                            <li key={idx} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No opening hours found</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Raw HTML */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">📄 Raw HTML</h3>
                  <button
                    onClick={() => setShowRawHtml(!showRawHtml)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {showRawHtml ? 'Hide' : 'Show'} HTML
                  </button>
                </div>
                
                {showRawHtml && (
                  <textarea
                    value={result.html}
                    readOnly
                    className="w-full h-96 p-4 font-mono text-xs bg-gray-50 border border-gray-300 rounded-lg"
                    style={{ resize: 'vertical' }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      {!result && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ About This Test</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>This page tests <strong>only</strong> the Cloud Run Puppeteer scraper</li>
            <li>No caching, no simple fetch fallbacks</li>
            <li>Shows raw HTML and extracted structured data</li>
            <li>Displays detailed error messages for debugging</li>
            <li>Useful for verifying Cloud Run configuration and performance</li>
          </ul>
        </div>
      )}
    </div>
  )
}
