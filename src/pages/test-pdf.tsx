import { useState } from 'react';

export function TestPdfPage() {
  const [pdfUrl, setPdfUrl] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setExtractedText('');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/test-pdf-extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to extract: ${response.statusText}`);
      }

      const data = await response.json();
      setExtractedText(data.text || 'No text extracted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlExtract = async () => {
    if (!pdfUrl.trim()) return;

    setLoading(true);
    setError('');
    setExtractedText('');

    try {
      const response = await fetch('/api/test-pdf-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pdfUrl }),
      });

      if (!response.ok) {
        throw new Error(`Failed to extract: ${response.statusText}`);
      }

      const data = await response.json();
      setExtractedText(data.text || 'No text extracted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">PDF Text Extraction Test</h1>

          {/* File Upload Section */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload PDF File</h2>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>

          {/* URL Input Section */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Extract from URL</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://example.com/menu.pdf"
                className="flex-1 px-4 py-2 border rounded"
              />
              <button
                onClick={handleUrlExtract}
                disabled={loading || !pdfUrl.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                Extract
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800">Extracting text from PDF...</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 font-semibold">Error:</p>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Extracted Text Display */}
          {extractedText && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Extracted Text</h2>
              <div className="bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {extractedText}
                </pre>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Character count: {extractedText.length}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
