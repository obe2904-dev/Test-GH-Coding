import { useState } from 'react';
import { supabase } from '../lib/supabase';

type AnalysisResponse = {
  success?: boolean;
  cached?: boolean;
  scrape_id?: string;
  quality?: string;
  extraction_summary?: {
    basics?: Record<string, unknown>;
    menu?: Record<string, unknown>;
    operations?: Record<string, unknown>;
  };
  distribution_summary?: {
    tier1_fields?: string[];
    tier2_fields?: string[];
    tier3_fields?: string[];
    total_saved?: number;
    errors?: string[];
  };
  menu_enrichment?: string;
  duration_ms?: number;
  error?: string;
};

type ExtractionResult = {
  basics?: {
    name?: string;
    description?: string;
    cuisine_types?: string[];
    phone?: string;
    email?: string;
    booking_url?: string;
    social_media?: Record<string, string>;
  };
  menu?: {
    sections?: Array<{
      name?: string;
      items?: Array<{
        name?: string;
        description?: string;
        price?: string;
      }>;
    }>;
    highlights?: string[];
  };
  operations?: {
    opening_hours?: Array<{
      day?: string;
      open?: string;
      close?: string;
    }>;
    delivery_available?: boolean;
    takeaway_available?: boolean;
  };
};

export function TestWebsiteAnalysisPage() {
  const [websiteUrl, setWebsiteUrl] = useState('https://restaurantvaldemar.dk/');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const refreshAuthToken = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn('⚠️ Failed to refresh session before analysis:', error.message);
    }
    return data.session?.access_token ?? null;
  };

  const handleAnalyze = async () => {
    if (!websiteUrl.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      let authToken = await getAuthToken();

      if (!authToken) {
        authToken = await refreshAuthToken();
      }

      if (!authToken) {
        throw new Error('Not authenticated. Please log in first.');
      }

      const callAnalysis = (token: string) => fetch(
        'https://oadwluspjlsnxhgakral.supabase.co/functions/v1/analyze-and-distribute-website',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: websiteUrl.trim(), force_refresh: true }),
        }
      );

      let response = await callAnalysis(authToken);

      if (!response.ok) {
        const errorText = await response.text();
        const needsAuthRefresh = /invalid or expired token/i.test(errorText) || response.status === 401;

        if (needsAuthRefresh) {
          const refreshedToken = await refreshAuthToken();
          if (refreshedToken) {
            authToken = refreshedToken;
            response = await callAnalysis(authToken);
          }
        }

        if (!response.ok) {
          throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json() as AnalysisResponse;
      console.log('✅ Analysis complete:', data);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const basics = result?.extraction_summary?.basics as ExtractionResult['basics'] | undefined;
  const menu = result?.extraction_summary?.menu as ExtractionResult['menu'] | undefined;
  const operations = result?.extraction_summary?.operations as ExtractionResult['operations'] | undefined;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-3">Website Analysis Test</h1>
        <p className="mb-8 text-sm text-gray-600">
          This page tests the unified <strong>scrape → extract → distribute</strong> flow.
          It calls <code className="bg-gray-100 px-1 rounded">/analyze-and-distribute-website</code>
          and shows the response immediately.
        </p>

        {/* URL Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Analyze Website</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-4 py-2 border rounded"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !websiteUrl.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading ? 'Starting...' : 'Analyze'}
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <div>💡 <strong>Try these:</strong></div>
            <div className="pl-6">
              • Restaurant Valdemar (multi-page): <code className="bg-gray-100 px-1">https://restaurantvaldemar.dk/</code>
            </div>
            <div className="pl-6">
              • Any restaurant website with contact/menu pages
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-semibold">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>

            <div className="mb-4 text-sm">
              <span className="font-semibold">Status:</span> {result.success === false ? 'Failed' : 'Success'}
            </div>

            {result.scrape_id && (
              <div className="mb-2 text-sm">
                <span className="font-semibold">Scrape ID:</span>{' '}
                <code className="bg-gray-100 px-1 rounded text-xs">{result.scrape_id}</code>
              </div>
            )}

            {result.quality && (
              <div className="mb-2 text-sm">
                <span className="font-semibold">Quality:</span> {result.quality}
              </div>
            )}

            {result.duration_ms !== undefined && (
              <div className="mb-4 text-sm">
                <span className="font-semibold">Duration:</span> {formatDuration(result.duration_ms)}
              </div>
            )}

            {result.distribution_summary && (
              <div className="mb-6 rounded bg-gray-50 p-4 text-sm space-y-1">
                <div className="font-semibold mb-1">Distribution Summary</div>
                <div>Total saved: {result.distribution_summary.total_saved ?? 0}</div>
                <div>Tier 1 fields: {result.distribution_summary.tier1_fields?.length ?? 0}</div>
                <div>Tier 2 fields: {result.distribution_summary.tier2_fields?.length ?? 0}</div>
                <div>Tier 3 fields: {result.distribution_summary.tier3_fields?.length ?? 0}</div>
                {result.distribution_summary.errors && result.distribution_summary.errors.length > 0 && (
                  <div className="text-red-700">Errors: {result.distribution_summary.errors.join(', ')}</div>
                )}
              </div>
            )}

            {/* Basics */}
            {basics && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">📋 Basics</h3>
                <div className="bg-gray-50 rounded p-4 space-y-2 text-sm">
                  {basics.name && (
                    <div>
                      <span className="font-semibold">Name:</span> {basics.name}
                    </div>
                  )}
                  {basics.description && (
                    <div>
                      <span className="font-semibold">Description:</span>{' '}
                      <p className="mt-1 text-gray-700">{basics.description}</p>
                    </div>
                  )}
                  {basics.cuisine_types && basics.cuisine_types.length > 0 && (
                    <div>
                      <span className="font-semibold">Cuisine Types:</span>{' '}
                      {basics.cuisine_types.join(', ')}
                    </div>
                  )}
                  {basics.phone && (
                    <div>
                      <span className="font-semibold">Phone:</span> {basics.phone}
                    </div>
                  )}
                  {basics.email && (
                    <div>
                      <span className="font-semibold">Email:</span> {basics.email}
                    </div>
                  )}
                  {basics.booking_url && (
                    <div>
                      <span className="font-semibold">Booking URL:</span>{' '}
                      <a
                        href={basics.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {basics.booking_url}
                      </a>
                    </div>
                  )}
                  {basics.social_media && Object.keys(basics.social_media).length > 0 && (
                    <div>
                      <span className="font-semibold">Social Media:</span>
                      <div className="ml-4 mt-1">
                        {Object.entries(basics.social_media).map(([platform, url]) => (
                          <div key={platform}>
                            <span className="capitalize">{platform}:</span>{' '}
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {url}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Menu */}
            {menu && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">🍽️ Menu</h3>
                <div className="bg-gray-50 rounded p-4 space-y-3 text-sm">
                  {menu.sections && menu.sections.length > 0 && (
                    <div>
                      <span className="font-semibold">Sections ({menu.sections.length}):</span>
                      <div className="ml-4 mt-2 space-y-3">
                        {menu.sections.slice(0, 3).map((section, idx) => (
                          <div key={idx} className="border-l-2 border-gray-300 pl-3">
                            <div className="font-semibold text-gray-900">{section.name || 'Unnamed Section'}</div>
                            {section.items && section.items.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {section.items.slice(0, 3).map((item, itemIdx) => (
                                  <div key={itemIdx} className="text-gray-700">
                                    • {item.name} {item.price && `- ${item.price}`}
                                    {item.description && <p className="ml-3 text-xs text-gray-600">{item.description}</p>}
                                  </div>
                                ))}
                                {section.items.length > 3 && (
                                  <div className="text-gray-500 text-xs">...and {section.items.length - 3} more items</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {menu.sections.length > 3 && (
                          <div className="text-gray-500 text-xs">...and {menu.sections.length - 3} more sections</div>
                        )}
                      </div>
                    </div>
                  )}
                  {menu.highlights && menu.highlights.length > 0 && (
                    <div>
                      <span className="font-semibold">Highlights:</span>
                      <ul className="ml-4 mt-1 list-disc list-inside">
                        {menu.highlights.map((highlight, idx) => (
                          <li key={idx} className="text-gray-700">{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Operations */}
            {operations && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">🕐 Operations</h3>
                <div className="bg-gray-50 rounded p-4 space-y-2 text-sm">
                  {operations.opening_hours && operations.opening_hours.length > 0 && (
                    <div>
                      <span className="font-semibold">Opening Hours:</span>
                      <div className="ml-4 mt-1">
                        {operations.opening_hours.map((hours, idx) => (
                          <div key={idx}>
                            {hours.day}: {hours.open} - {hours.close}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {operations.delivery_available !== undefined && (
                    <div>
                      <span className="font-semibold">Delivery:</span>{' '}
                      {operations.delivery_available ? 'Yes' : 'No'}
                    </div>
                  )}
                  {operations.takeaway_available !== undefined && (
                    <div>
                      <span className="font-semibold">Takeaway:</span>{' '}
                      {operations.takeaway_available ? 'Yes' : 'No'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                Show Raw JSON
              </summary>
              <pre className="mt-3 bg-gray-900 text-gray-100 rounded p-4 text-xs overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-2 text-blue-900">How This Works</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>You enter a URL and click "Analyze"</li>
            <li>Frontend calls <code className="bg-blue-100 px-1 rounded">/analyze-and-distribute-website</code></li>
            <li>Edge Function scrapes, extracts, and distributes data in one request</li>
            <li>Frontend shows the returned summary and raw JSON</li>
            <li>If your session is missing, you need to log in first</li>
          </ol>
          <p className="mt-3 text-sm text-blue-700">
            <strong>No more wrong-endpoint mismatch.</strong> This page now tests the unified analyzer directly.
          </p>
        </div>
      </div>
    </div>
  );
}
