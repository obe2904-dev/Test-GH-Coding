import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type AsyncJobResponse = {
  job_id: string;
  status: 'pending' | 'scraping' | 'extracting' | 'completed' | 'failed';
  progress_percent?: number;
  estimated_duration_ms?: number;
  progress_url?: string;
};

type JobStatusResponse = {
  job_id: string;
  business_id: string;
  url: string;
  status: 'pending' | 'scraping' | 'extracting' | 'completed' | 'failed';
  progress_percent: number;
  current_step?: string;
  pages_crawled?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  estimated_completion_at?: string;
  duration_ms?: number;
  error_message?: string;
  elapsed_ms?: number;
  estimated_time_remaining_ms?: number;
  scrape_result?: {
    content_quality?: string;
    menu_source?: string;
    extraction_summary?: {
      basics?: Record<string, unknown>;
      menu?: Record<string, unknown>;
      operations?: Record<string, unknown>;
    };
  };
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
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);

  // Poll for job status
  useEffect(() => {
    if (!jobId) return;
    if (status?.status === 'completed' || status?.status === 'failed') return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(
          `https://oadwluspjlsnxhgakral.supabase.co/functions/v1/scrape-status/${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get status: ${response.status}`);
        }

        const statusData = await response.json() as JobStatusResponse;
        setStatus(statusData);

        if (statusData.status === 'completed' && statusData.scrape_result) {
          setExtractionResult(statusData.scrape_result.extraction_summary || null);
          clearInterval(pollInterval);
        }

        if (statusData.status === 'failed') {
          setError(statusData.error_message || 'Scraping failed');
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, status?.status]);

  const handleAnalyze = async () => {
    if (!websiteUrl.trim()) return;

    setLoading(true);
    setError('');
    setJobId(null);
    setStatus(null);
    setExtractionResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in first.');
      }

      // Call the async analyze endpoint
      const response = await fetch(
        'https://oadwluspjlsnxhgakral.supabase.co/functions/v1/analyze-website-async',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: websiteUrl.trim() }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as AsyncJobResponse;
      setJobId(data.job_id);
      setStatus({
        job_id: data.job_id,
        business_id: '',
        url: websiteUrl.trim(),
        status: data.status,
        progress_percent: data.progress_percent || 0,
        created_at: new Date().toISOString(),
      });
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-green-50 border-green-200';
      case 'failed': return 'text-red-700 bg-red-50 border-red-200';
      case 'scraping': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'extracting': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'pending': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-3">Website Analysis Test (Async)</h1>
        <p className="mb-8 text-sm text-gray-600">
          This page tests the new <strong>async scraping infrastructure</strong>. It calls{' '}
          <code className="bg-gray-100 px-1 rounded">/analyze-website-async</code> to start a job,
          then polls <code className="bg-gray-100 px-1 rounded">/scrape-status</code> for real-time progress.
          No more IDLE_TIMEOUT errors! 🎉
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
              disabled={loading || !websiteUrl.trim() || (status?.status === 'scraping' || status?.status === 'extracting' || status?.status === 'pending')}
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

        {/* Status Display */}
        {status && (
          <div className={`border rounded-lg p-6 mb-6 ${getStatusColor(status.status)}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Status: {status.status?.toUpperCase() || 'UNKNOWN'}
              </h2>
              <div className="text-sm font-mono">{status.progress_percent || 0}%</div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${status.progress_percent || 0}%` }}
              />
            </div>

            {/* Status Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-semibold">Job ID:</span>{' '}
                <code className="bg-white/50 px-1 rounded text-xs">{status.job_id?.slice(0, 8) || 'N/A'}...</code>
              </div>
              <div>
                <span className="font-semibold">URL:</span>{' '}
                <span className="truncate block">{status.url || 'N/A'}</span>
              </div>
              {status.current_step && (
                <div className="col-span-2">
                  <span className="font-semibold">Current Step:</span> {status.current_step}
                </div>
              )}
              {status.pages_crawled !== undefined && (
                <div>
                  <span className="font-semibold">Pages Crawled:</span> {status.pages_crawled}
                </div>
              )}
              {status.elapsed_ms !== undefined && (
                <div>
                  <span className="font-semibold">Elapsed:</span> {formatDuration(status.elapsed_ms)}
                </div>
              )}
              {status.estimated_time_remaining_ms !== undefined && status.status !== 'completed' && (
                <div>
                  <span className="font-semibold">Est. Time Remaining:</span>{' '}
                  {formatDuration(status.estimated_time_remaining_ms)}
                </div>
              )}
              {status.duration_ms !== undefined && status.status === 'completed' && (
                <div>
                  <span className="font-semibold">Total Duration:</span> {formatDuration(status.duration_ms)}
                </div>
              )}
              {status.scrape_result?.content_quality && (
                <div>
                  <span className="font-semibold">Content Quality:</span> {status.scrape_result.content_quality}
                </div>
              )}
              {status.scrape_result?.menu_source && (
                <div>
                  <span className="font-semibold">Menu Source:</span> {status.scrape_result.menu_source}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Extraction Results */}
        {extractionResult && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Extraction Results</h2>

            {/* Basics */}
            {extractionResult.basics && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">📋 Basics</h3>
                <div className="bg-gray-50 rounded p-4 space-y-2 text-sm">
                  {extractionResult.basics.name && (
                    <div>
                      <span className="font-semibold">Name:</span> {extractionResult.basics.name}
                    </div>
                  )}
                  {extractionResult.basics.description && (
                    <div>
                      <span className="font-semibold">Description:</span>{' '}
                      <p className="mt-1 text-gray-700">{extractionResult.basics.description}</p>
                    </div>
                  )}
                  {extractionResult.basics.cuisine_types && extractionResult.basics.cuisine_types.length > 0 && (
                    <div>
                      <span className="font-semibold">Cuisine Types:</span>{' '}
                      {extractionResult.basics.cuisine_types.join(', ')}
                    </div>
                  )}
                  {extractionResult.basics.phone && (
                    <div>
                      <span className="font-semibold">Phone:</span> {extractionResult.basics.phone}
                    </div>
                  )}
                  {extractionResult.basics.email && (
                    <div>
                      <span className="font-semibold">Email:</span> {extractionResult.basics.email}
                    </div>
                  )}
                  {extractionResult.basics.booking_url && (
                    <div>
                      <span className="font-semibold">Booking URL:</span>{' '}
                      <a
                        href={extractionResult.basics.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {extractionResult.basics.booking_url}
                      </a>
                    </div>
                  )}
                  {extractionResult.basics.social_media && Object.keys(extractionResult.basics.social_media).length > 0 && (
                    <div>
                      <span className="font-semibold">Social Media:</span>
                      <div className="ml-4 mt-1">
                        {Object.entries(extractionResult.basics.social_media).map(([platform, url]) => (
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
            {extractionResult.menu && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">🍽️ Menu</h3>
                <div className="bg-gray-50 rounded p-4 space-y-3 text-sm">
                  {extractionResult.menu.sections && extractionResult.menu.sections.length > 0 && (
                    <div>
                      <span className="font-semibold">Sections ({extractionResult.menu.sections.length}):</span>
                      <div className="ml-4 mt-2 space-y-3">
                        {extractionResult.menu.sections.slice(0, 3).map((section, idx) => (
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
                        {extractionResult.menu.sections.length > 3 && (
                          <div className="text-gray-500 text-xs">...and {extractionResult.menu.sections.length - 3} more sections</div>
                        )}
                      </div>
                    </div>
                  )}
                  {extractionResult.menu.highlights && extractionResult.menu.highlights.length > 0 && (
                    <div>
                      <span className="font-semibold">Highlights:</span>
                      <ul className="ml-4 mt-1 list-disc list-inside">
                        {extractionResult.menu.highlights.map((highlight, idx) => (
                          <li key={idx} className="text-gray-700">{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Operations */}
            {extractionResult.operations && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">🕐 Operations</h3>
                <div className="bg-gray-50 rounded p-4 space-y-2 text-sm">
                  {extractionResult.operations.opening_hours && extractionResult.operations.opening_hours.length > 0 && (
                    <div>
                      <span className="font-semibold">Opening Hours:</span>
                      <div className="ml-4 mt-1">
                        {extractionResult.operations.opening_hours.map((hours, idx) => (
                          <div key={idx}>
                            {hours.day}: {hours.open} - {hours.close}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {extractionResult.operations.delivery_available !== undefined && (
                    <div>
                      <span className="font-semibold">Delivery:</span>{' '}
                      {extractionResult.operations.delivery_available ? 'Yes' : 'No'}
                    </div>
                  )}
                  {extractionResult.operations.takeaway_available !== undefined && (
                    <div>
                      <span className="font-semibold">Takeaway:</span>{' '}
                      {extractionResult.operations.takeaway_available ? 'Yes' : 'No'}
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
                {JSON.stringify(extractionResult, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-2 text-blue-900">How This Works</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>You enter a URL and click "Analyze"</li>
            <li>Frontend calls <code className="bg-blue-100 px-1 rounded">/analyze-website-async</code></li>
            <li>Edge Function creates a job and returns immediately (&lt;5s) ✅</li>
            <li>Cloud Run scraper runs in background (40% → 70% → 85%)</li>
            <li>Frontend polls <code className="bg-blue-100 px-1 rounded">/scrape-status</code> every 3s</li>
            <li>When done, Cloud Run calls webhook → extraction runs → job marked complete (100%)</li>
            <li>Frontend displays extracted results</li>
          </ol>
          <p className="mt-3 text-sm text-blue-700">
            <strong>No more IDLE_TIMEOUT!</strong> The old sync endpoint waited 150s+ and failed.
            This async flow returns immediately and shows real-time progress.
          </p>
        </div>
      </div>
    </div>
  );
}
