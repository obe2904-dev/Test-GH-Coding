'use client';

import { useState } from 'react';

const SUPABASE_FUNCTION_URL = 'https://oadwluspjlsnxhgakral.supabase.co/functions/v1/test-docling-pdf';

type DoclingResponse = {
  success: boolean;
  text?: string;
  markdown?: string;
  metadata?: Record<string, unknown>;
  error?: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

async function callDocling(body: Record<string, unknown>) {
  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as DoclingResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Docling request failed: ${response.status}`);
  }

  return data;
}

export default function TestPdfPage() {
  const [pdfUrl, setPdfUrl] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [markdown, setMarkdown] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setExtractedText('');
    setSourceLabel('');
    setPageCount(null);
    setMarkdown('');

    try {
      const pdfBase64 = arrayBufferToBase64(await file.arrayBuffer());
      const data = await callDocling({
        pdfBase64,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
      });

      setExtractedText(data.text || 'No text extracted. This PDF may be image-based and require OCR.');
      setMarkdown(data.markdown || '');
      setSourceLabel('Docling Cloud Run (file upload)');
      setPageCount(typeof data.metadata?.pages === 'number' ? data.metadata.pages : null);
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
    setSourceLabel('');
    setPageCount(null);
    setMarkdown('');

    try {
      const data = await callDocling({ url: pdfUrl.trim() });
      setExtractedText(data.text || 'No text extracted. This PDF may be image-based and require OCR.');
      setMarkdown(data.markdown || '');
      setSourceLabel('Docling Cloud Run (URL)');
      setPageCount(typeof data.metadata?.pages === 'number' ? data.metadata.pages : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-3">PDF Text Extraction Test</h1>
        <p className="mb-8 text-sm text-gray-600">
          This page calls Docling running on Cloud Run through a Supabase edge function, then shows the extracted text below.
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload PDF File</h2>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

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

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800">Extracting text with Docling Cloud Run...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-semibold">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {extractedText && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Extracted Text</h2>
                {sourceLabel && <p className="text-sm text-gray-600 mt-1">Source: {sourceLabel}</p>}
              </div>
              {pageCount !== null && <div className="text-sm text-gray-600">Pages: {pageCount}</div>}
            </div>
            <div className="bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono">{extractedText}</pre>
            </div>
            {markdown && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Markdown preview</h3>
                <div className="bg-gray-50 p-4 rounded border max-h-72 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-xs font-mono">{markdown}</pre>
                </div>
              </div>
            )}
            <div className="mt-4 text-sm text-gray-600">Character count: {extractedText.length}</div>
          </div>
        )}
      </div>
    </div>
  );
}
