import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface TestResult {
  success: boolean
  url?: string
  timing?: number | { total_ms: number; scraping_ms: number }
  version?: string
  
  // v2 payload structure
  content_quality?: 'rich' | 'thin' | 'shell'
  menu_source?: 'inline' | 'link' | 'pdf' | 'none'
  
  meta?: {
    title?: string
    description?: string
    locale?: string
  }
  
  contact?: {
    email?: string
    phone?: string
    address?: string
  }
  
  links?: {
    booking?: string
    menu_url?: string
    takeaway?: string
    social?: string[]
    pdf_menus?: string[]
    raw?: Array<{ url: string; text: string }>
  }
  
  opening_hours?: {
    structured?: any[]
    text?: string
  }
  
  menu_text?: string
  about_text?: string
  full_text?: string
  
  // v2 AI-extracted fields (from analyze-website-v2)
  about?: string
  description?: string
  venue_hooks?: string[]
  keywords?: string[]
  tone_of_voice?: string
  has_menu?: boolean
  confidence_score?: number
  
  payload_size?: number
  original_size?: number
  
  error?: string
  cloudRunUrl?: string
  hasApiKey?: boolean
  hasServiceAccount?: boolean
}

export default function TestCloudRunPage() {
  const [url, setUrl] = useState('https://www.noma.dk')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [showFullText, setShowFullText] = useState(false)
  const [testMode, setTestMode] = useState<'scraper' | 'analyze' | 'two-step'>('two-step')
  const [scrapeId, setScrapeId] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState<string>('')

  // Helper to get timing value (handles both v1 number and v2 object)
  const getTiming = (timing: number | { total_ms: number; scraping_ms: number } | undefined): number | undefined => {
    if (!timing) return undefined
    return typeof timing === 'number' ? timing : timing.total_ms
  }

  const handleTest = async () => {
    if (!url.trim()) {
      alert('Please enter a URL')
      return
    }

    setIsLoading(true)
    setResult(null)
    setScrapeId(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token

      if (testMode === 'two-step') {
        // Step 1: Scrape and store
        console.log('🚀 Step 1: Scraping and storing...', url)
        
        const scrapeEndpoint = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/scrape-and-store'
        const scrapeResponse = await fetch(scrapeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ 
            business_id: businessId.trim() || undefined, // Let function auto-detect if empty
            url: url.trim(),
            force_refresh: false
          })
        })

        if (!scrapeResponse.ok) {
          const errorText = await scrapeResponse.text()
          throw new Error(`Scrape failed: ${errorText}`)
        }

        const scrapeData = await scrapeResponse.json()
        console.log('✅ Step 1 complete:', scrapeData)
        setScrapeId(scrapeData.scrape_id)

        // Step 2: Extract with AI
        console.log('🤖 Step 2: AI extraction from stored data...')
        const extractEndpoint = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/extract-from-scrape'
        const extractResponse = await fetch(extractEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ 
            scrape_id: scrapeData.scrape_id,
            force_reextract: false
          })
        })

        if (!extractResponse.ok) {
          const errorText = await extractResponse.text()
          throw new Error(`Extraction failed: ${errorText}`)
        }

        const extractData = await extractResponse.json()
        console.log('✅ Step 2 complete:', extractData)

        // Combine results
        setResult({
          success: true,
          url,
          timing: {
            total_ms: (scrapeData.scraping_ms || 0) + (extractData.extraction_ms || 0),
            scraping_ms: scrapeData.scraping_ms
          },
          content_quality: scrapeData.content_quality,
          menu_source: scrapeData.menu_source,
          about: extractData.extracted_data?.about,
          description: extractData.extracted_data?.description,
          venue_hooks: extractData.extracted_data?.venue_hooks,
          keywords: extractData.extracted_data?.keywords,
          tone_of_voice: extractData.extracted_data?.tone_of_voice,
          confidence_score: extractData.extracted_data?.confidence_score,
        })

      } else {
        // Legacy modes: scraper or analyze
        const functionName = testMode === 'scraper' ? 'test-cloud-run-scraper' : 'analyze-website-v2'
        const endpoint = import.meta.env.VITE_SUPABASE_URL + `/functions/v1/${functionName}`
        
        console.log(`🚀 Testing ${testMode} mode:`, url)
        console.log('📡 Endpoint:', endpoint)

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ 
            url: url.trim(),
            businessName: 'Test Business'
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const data = await response.json()
        console.log('📥 Result:', data)
        setResult(data)
      }

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
          🧪 Cloud Run {testMode === 'two-step' ? 'Two-Step Pipeline' : testMode === 'scraper' ? 'Scraper' : 'AI Analysis'} Test
        </h1>
        <p className="text-gray-600">
          {testMode === 'two-step'
            ? 'Test new architecture: scrape → database → AI extraction (enables re-run without re-scrape)'
            : testMode === 'scraper' 
              ? 'Direct test of Cloud Run v2 preprocessor - returns structured data'
              : 'Full AI analysis pipeline using Cloud Run v2 + Gemini 2.5 Flash (legacy one-shot)'
          }
        </p>
      </div>

      {/* Test Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Mode
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setTestMode('two-step')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  testMode === 'two-step'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                💾 Two-Step (New)
                <div className="text-xs mt-1 opacity-80">
                  Scrape → DB → Extract
                </div>
              </button>
              <button
                onClick={() => setTestMode('scraper')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  testMode === 'scraper'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🔧 Scraper Only
                <div className="text-xs mt-1 opacity-80">
                  Raw preprocessed data
                </div>
              </button>
              <button
                onClick={() => setTestMode('analyze')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  testMode === 'analyze'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🤖 AI Analysis (Legacy)
                <div className="text-xs mt-1 opacity-80">
                  One-shot extraction
                </div>
              </button>
            </div>
          </div>

          {testMode === 'two-step' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business ID (optional)
              </label>
              <input
                type="text"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder="Auto-detects your first business if empty"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-detect your business, or paste a specific UUID
              </p>
            </div>
          )}

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
              testMode === 'two-step' 
                ? '💾 Test Two-Step Pipeline' 
                : testMode === 'scraper' 
                  ? '🚀 Test Cloud Run Scraper' 
                  : '🤖 Test AI Analysis'
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
                    Response time: {getTiming(result.timing)}ms
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
          {result.success && (
            <>
              {/* Debug Panel - Show raw JSON */}
              <div className="bg-gray-900 rounded-lg shadow-sm border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🔍 Debug: Raw Response</h3>
                <pre className="text-xs text-green-400 bg-black p-4 rounded overflow-x-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>

              {/* Quality Metrics */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Quality Metrics</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Content Quality</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                        result.content_quality === 'rich' ? 'bg-green-100 text-green-800' :
                        result.content_quality === 'thin' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {result.content_quality || 'unknown'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Menu Source</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                        result.menu_source === 'inline' ? 'bg-green-100 text-green-800' :
                        result.menu_source === 'link' ? 'bg-blue-100 text-blue-800' :
                        result.menu_source === 'pdf' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {result.menu_source || 'none'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Payload Size</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {result.payload_size?.toLocaleString()} bytes
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Size Reduction</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {result.original_size && result.payload_size ? (
                        <>
                          {((1 - result.payload_size / result.original_size) * 100).toFixed(1)}%
                          <span className="text-gray-500 ml-1">
                            ({result.original_size.toLocaleString()} → {result.payload_size.toLocaleString()})
                          </span>
                        </>
                      ) : 'N/A'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Metadata */}
              {result.meta && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🏷️ Metadata</h3>
                  <dl className="space-y-3">
                    {result.meta.title && (
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Title</dt>
                        <dd className="mt-1 text-sm text-gray-900">{result.meta.title}</dd>
                      </div>
                    )}
                    {result.meta.description && (
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Description</dt>
                        <dd className="mt-1 text-sm text-gray-900">{result.meta.description}</dd>
                      </div>
                    )}
                    {result.meta.locale && (
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Locale</dt>
                        <dd className="mt-1 text-sm text-gray-900">{result.meta.locale}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Contact Info */}
              {result.contact && Object.keys(result.contact).length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📞 Contact Information</h3>
                  <dl className="space-y-3">
                    {result.contact.email && (
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Email</dt>
                        <dd className="mt-1 text-sm">
                          <a href={`mailto:${result.contact.email}`} className="text-blue-600 hover:underline">
                            {result.contact.email}
                          </a>
                        </dd>
                      </div>
                    )}
                    {result.contact.phone && (
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Phone</dt>
                        <dd className="mt-1 text-sm">
                          <a href={`tel:${result.contact.phone}`} className="text-blue-600 hover:underline">
                            {result.contact.phone}
                          </a>
                        </dd>
                      </div>
                    )}
                    {result.contact.address && (
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Address</dt>
                        <dd className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                          {result.contact.address}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Links */}
              {result.links && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🔗 Links</h3>
                  
                  <div className="space-y-4">
                    {/* Primary Links */}
                    {(result.links.booking || result.links.menu_url || result.links.takeaway) && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Primary Actions</h4>
                        <dl className="space-y-2">
                          {result.links.booking && (
                            <div className="flex items-start gap-2">
                              <dt className="text-sm font-medium text-gray-600 w-24">Booking:</dt>
                              <dd className="text-sm flex-1">
                                <a href={result.links.booking} target="_blank" rel="noopener noreferrer" 
                                   className="text-blue-600 hover:underline break-all">
                                  {result.links.booking}
                                </a>
                              </dd>
                            </div>
                          )}
                          {result.links.menu_url && (
                            <div className="flex items-start gap-2">
                              <dt className="text-sm font-medium text-gray-600 w-24">Menu:</dt>
                              <dd className="text-sm flex-1">
                                <a href={result.links.menu_url} target="_blank" rel="noopener noreferrer" 
                                   className="text-blue-600 hover:underline break-all">
                                  {result.links.menu_url}
                                </a>
                              </dd>
                            </div>
                          )}
                          {result.links.takeaway && (
                            <div className="flex items-start gap-2">
                              <dt className="text-sm font-medium text-gray-600 w-24">Takeaway:</dt>
                              <dd className="text-sm flex-1">
                                <a href={result.links.takeaway} target="_blank" rel="noopener noreferrer" 
                                   className="text-blue-600 hover:underline break-all">
                                  {result.links.takeaway}
                                </a>
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}

                    {/* Social Media */}
                    {result.links.social && result.links.social.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">
                          Social Media ({result.links.social.length})
                        </h4>
                        <ul className="space-y-1">
                          {result.links.social.map((link, idx) => (
                            <li key={idx} className="text-sm">
                              <a href={link} target="_blank" rel="noopener noreferrer"
                                 className="text-blue-600 hover:underline break-all">
                                {link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* PDF Menus */}
                    {result.links.pdf_menus && result.links.pdf_menus.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">
                          PDF Menus ({result.links.pdf_menus.length})
                        </h4>
                        <ul className="space-y-1">
                          {result.links.pdf_menus.map((link, idx) => (
                            <li key={idx} className="text-sm">
                              <a href={link} target="_blank" rel="noopener noreferrer"
                                 className="text-blue-600 hover:underline break-all">
                                📄 {link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Raw Links */}
                    {result.links.raw && result.links.raw.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">
                          All Links ({result.links.raw.length})
                        </h4>
                        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Link Text
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  URL
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {result.links.raw.map((link, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                    {link.text || <span className="text-gray-400 italic">no text</span>}
                                  </td>
                                  <td className="px-3 py-2 text-sm">
                                    <a href={link.url} target="_blank" rel="noopener noreferrer"
                                       className="text-blue-600 hover:underline break-all text-xs">
                                      {link.url}
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Opening Hours */}
              {result.opening_hours && (result.opening_hours.structured || result.opening_hours.text) && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🕐 Opening Hours</h3>
                  {result.opening_hours.structured && result.opening_hours.structured.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Structured</h4>
                      <pre className="text-sm bg-gray-50 p-3 rounded overflow-x-auto">
                        {JSON.stringify(result.opening_hours.structured, null, 2)}
                      </pre>
                    </div>
                  )}
                  {result.opening_hours.text && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Text</h4>
                      <p className="text-sm text-gray-900 whitespace-pre-line">
                        {result.opening_hours.text}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AI-Extracted Content (v2 only) */}
              {(result.about || result.description || result.venue_hooks || result.keywords) && (
                <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">🤖 AI-Extracted Content</h3>
                    {result.confidence_score !== undefined && (
                      <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                        Confidence: {(result.confidence_score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {result.about && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">About (Concise)</h4>
                        <p className="text-sm text-gray-900 leading-relaxed bg-blue-50 p-3 rounded">
                          {result.about}
                        </p>
                      </div>
                    )}
                    
                    {result.description && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Description (Detailed)</h4>
                        <p className="text-sm text-gray-900 leading-relaxed bg-blue-50 p-3 rounded">
                          {result.description}
                        </p>
                      </div>
                    )}
                    
                    {result.venue_hooks && result.venue_hooks.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Venue Hooks (USPs)</h4>
                        <ul className="space-y-2">
                          {result.venue_hooks.map((hook, idx) => (
                            <li key={idx} className="text-sm text-gray-900 bg-green-50 p-2 rounded flex items-start gap-2">
                              <span className="text-green-600 font-bold">•</span>
                              <span className="flex-1">{hook}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {result.keywords && result.keywords.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.keywords.map((keyword, idx) => (
                            <span key={idx} className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {result.tone_of_voice && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Tone of Voice</h4>
                        <p className="text-sm text-gray-900 bg-yellow-50 p-3 rounded italic">
                          "{result.tone_of_voice}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* About Text */}
              {result.about_text && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📖 About Text</h3>
                  <p className="text-sm text-gray-900 whitespace-pre-line leading-relaxed">
                    {result.about_text}
                  </p>
                </div>
              )}

              {/* Menu Text */}
              {result.menu_text && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🍽️ Menu Text</h3>
                  <p className="text-sm text-gray-900 whitespace-pre-line leading-relaxed font-mono">
                    {result.menu_text}
                  </p>
                </div>
              )}

              {/* Full Text (collapsible) */}
              {result.full_text && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">📄 Full Text</h3>
                    <button
                      onClick={() => setShowFullText(!showFullText)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {showFullText ? 'Hide' : 'Show'} Full Text
                    </button>
                  </div>
                  
                  {showFullText && (
                    <textarea
                      value={result.full_text}
                      readOnly
                      className="w-full h-96 p-4 font-mono text-xs bg-gray-50 border border-gray-300 rounded-lg"
                      style={{ resize: 'vertical' }}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      {!result && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ About This Test</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Tests the Cloud Run <strong>v2 preprocessor</strong> endpoint</li>
            <li>Returns structured, preprocessed data (not raw HTML)</li>
            <li>Shows quality metrics, contact info, and comprehensive link extraction</li>
            <li>Displays <strong>raw_links</strong> with both URLs and visible link text</li>
            <li>Reduces payload size by ~95% for AI processing</li>
            <li>Useful for validating content quality gates and extraction accuracy</li>
          </ul>
        </div>
      )}
    </div>
  )
}
