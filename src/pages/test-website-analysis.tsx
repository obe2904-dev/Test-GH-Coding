import { useState } from 'react';
import { supabase } from '../lib/supabase';

type PreviewAnalysisResponse = {
  url?: string;
  businessName?: string | null;
  businessType?: string | null;
  businessTypeLabel?: string | null;
  shortDescription?: string | null;
  contact?: {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  detectedMenuUrls?: string[];
  takeaway?: boolean | null;
  delivery?: boolean | null;
  hasTableService?: boolean | null;
  reservationRequired?: boolean | null;
  outdoorSeating?: boolean | null;
  keywords?: string[];
  venueHooks?: Array<{ text?: string; hook?: string }> | string[];
  experiencePillars?: unknown;
  openingHours?: unknown;
  openingHoursReviewRequired?: boolean;
  openingHoursReviewReasons?: string[];
  kitchenCloseTime?: string | null;
  menuSignal?: unknown;
  toneOfVoice?: string | null;
  localLocationReference?: string | null;
  webAnalysisShape?: string;
  menuPreview?: string[];
  _persistence?: {
    attempted?: boolean;
    success?: boolean;
    note?: string;
    error?: string;
  };
  error?: string;
};

export function TestWebsiteAnalysisPage() {
  const [websiteUrl, setWebsiteUrl] = useState('https://restaurantvaldemar.dk/');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PreviewAnalysisResponse | null>(null);

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
        'https://oadwluspjlsnxhgakral.supabase.co/functions/v1/analyze-website',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: websiteUrl.trim(),
            previewOnly: true,
            debugMode: false,
            tier: 'free',
          }),
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

      const data = await response.json() as PreviewAnalysisResponse;
      console.log('✅ Preview analysis complete:', data);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatList = (value?: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return 'N/A';
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return String(record.text || record.hook || record.name || JSON.stringify(record));
        }
        return String(item);
      })
      .join(', ');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-3">Website Analysis Preview</h1>
        <p className="mb-8 text-sm text-gray-600">
          This page runs the analyzer in <strong>preview-only mode</strong>.
          It calls <code className="bg-gray-100 px-1 rounded">/analyze-website</code>
          with <code className="bg-gray-100 px-1 rounded">previewOnly: true</code>, so nothing is saved.
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
            <h2 className="text-xl font-semibold mb-4">Preview Findings</h2>

            <div className="mb-4 text-sm">
              <span className="font-semibold">Persistence:</span>{' '}
              {result._persistence?.note || 'preview mode'}
            </div>

            {result.businessName && (
              <div className="mb-2 text-sm"><span className="font-semibold">Business Name:</span> {result.businessName}</div>
            )}
            {result.businessTypeLabel && (
              <div className="mb-2 text-sm"><span className="font-semibold">Business Type:</span> {result.businessTypeLabel}</div>
            )}
            {result.shortDescription && (
              <div className="mb-4 text-sm">
                <span className="font-semibold">Description:</span>
                <p className="mt-1 text-gray-700">{result.shortDescription}</p>
              </div>
            )}

            {result.contact && (
              <div className="mb-6 rounded bg-gray-50 p-4 text-sm space-y-1">
                <div className="font-semibold mb-1">Contact</div>
                <div>Phone: {result.contact.phone || 'N/A'}</div>
                <div>Email: {result.contact.email || 'N/A'}</div>
                <div>Address: {result.contact.address || 'N/A'}</div>
              </div>
            )}

            <div className="mb-6 rounded bg-gray-50 p-4 text-sm space-y-1">
              <div className="font-semibold mb-1">Operations</div>
              <div>Kitchen close time: {result.kitchenCloseTime || 'N/A'}</div>
              <div>Opening hours: {JSON.stringify(result.openingHours || {})}</div>
              <div>Review required: {String(result.openingHoursReviewRequired ?? false)}</div>
              <div>Review reasons: {formatList(result.openingHoursReviewReasons)}</div>
              <div>Takeaway: {String(result.takeaway ?? 'N/A')}</div>
              <div>Delivery: {String(result.delivery ?? 'N/A')}</div>
              <div>Table service: {String(result.hasTableService ?? 'N/A')}</div>
              <div>Reservation required: {String(result.reservationRequired ?? 'N/A')}</div>
              <div>Outdoor seating: {String(result.outdoorSeating ?? 'N/A')}</div>
            </div>

            <div className="mb-6 rounded bg-gray-50 p-4 text-sm space-y-1">
              <div className="font-semibold mb-1">Brand Signals</div>
              <div>Keywords: {formatList(result.keywords)}</div>
              <div>Venue hooks: {formatList(result.venueHooks)}</div>
              <div>Experience pillars: {JSON.stringify(result.experiencePillars || {})}</div>
              <div>Tone of voice: {result.toneOfVoice || 'N/A'}</div>
              <div>Location reference: {result.localLocationReference || 'N/A'}</div>
            </div>

            <div className="mb-6 rounded bg-gray-50 p-4 text-sm space-y-1">
              <div className="font-semibold mb-1">Menu Signals</div>
              <div>Detected menu URLs: {formatList(result.detectedMenuUrls)}</div>
              <div>Menu preview: {formatList(result.menuPreview)}</div>
              <div>Web analysis shape: {result.webAnalysisShape || 'N/A'}</div>
            </div>

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
