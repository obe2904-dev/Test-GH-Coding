import { useState } from 'react';
import { supabase } from '../lib/supabase';

type DoclingResponse = {
  success: boolean;
  kind?: 'pdf' | 'image' | 'unknown';
  text?: string;
  markdown?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  imageBase64?: string;
  mimeType?: string;
  fileName?: string;
};

type OcrResponse = {
  success: boolean;
  text?: string;
  confidence?: number;
  imageUrl?: string;
  error?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
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

function detectFileKind(buffer: ArrayBuffer): 'pdf' | 'image' | 'unknown' {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 4) {
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    if (isPdf) return 'pdf';
  }

  if (bytes.length >= 3) {
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (isJpeg) return 'image';
  }

  if (bytes.length >= 8) {
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
    if (isPng) return 'image';
  }

  if (bytes.length >= 12) {
    const signature = String.fromCharCode(
      bytes[0], bytes[1], bytes[2], bytes[3],
      bytes[8], bytes[9], bytes[10], bytes[11]
    );
    if (signature.startsWith('RIFF') && signature.endsWith('WEBP')) return 'image';
  }

  const header = new TextDecoder('latin1').decode(bytes.slice(0, 16));
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'image';

  return 'unknown';
}

async function runDoclingExtract(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<DoclingResponse>('test-docling-pdf', {
    body,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Docling extraction failed');
  }

  return data;
}

async function runImageOcr(body: Record<string, unknown>) {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }

  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  const mimeType = typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : 'image/jpeg';
  const fileName = typeof body.fileName === 'string' ? body.fileName : 'image';

  if (!imageBase64) {
    throw new Error('Image data is missing');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'This is a restaurant menu image. Transcribe EVERY visible word, line, heading, item, description, and price in reading order. Do not summarize. Do not omit small text. Preserve line breaks and spacing as closely as possible. If text is unclear, include your best reading and mark uncertain words with [?]. Return only the transcription text.',
              },
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Gemini image OCR failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || '';

  return {
    success: true,
    text,
    confidence: 0.9,
    imageUrl: fileName,
  } satisfies OcrResponse;
}

export function TestPdfPage() {
  const [pdfUrl, setPdfUrl] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [detectedKind, setDetectedKind] = useState<'pdf' | 'image' | 'unknown' | ''>('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);


  const runPdfExtract = async (file: File, fileBytes: ArrayBuffer) => {
    const pdfBase64 = arrayBufferToBase64(fileBytes);
    const data = await runDoclingExtract({
      pdfBase64,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
    });

    setExtractedText(data.text || 'No text extracted. This PDF may be image-based and require OCR.');
    setMarkdown(data.markdown || '');
    setSourceLabel('Docling Cloud Run (file upload)');
    setPageCount(typeof data.metadata?.pages === 'number' ? data.metadata.pages : null);
    setOcrConfidence(null);
  };

  const runImageExtract = async (file: File, fileBytes: ArrayBuffer) => {
    const imageBase64 = arrayBufferToBase64(fileBytes);
    const data = await runImageOcr({
      imageBase64,
      mimeType: file.type || 'image/jpeg',
      fileName: file.name,
    });

    setExtractedText(data.text || 'No text extracted from image.');
    setMarkdown('');
    setSourceLabel('Image OCR (file upload)');
    setPageCount(null);
    setOcrConfidence(typeof data.confidence === 'number' ? data.confidence : null);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setExtractedText('');
    setSourceLabel('');
    setDetectedKind('');
    setPageCount(null);
    setMarkdown('');
    setOcrConfidence(null);

    try {
      const fileBytes = await file.arrayBuffer();
      const detectedKind = detectFileKind(fileBytes);
      setDetectedKind(detectedKind);
      const isImage =
        detectedKind === 'image' ||
        file.type.startsWith('image/') ||
        /\.(jpe?g|png|webp|gif)$/i.test(file.name);

      if (isImage) {
        await runImageExtract(file, fileBytes);
      } else {
        await runPdfExtract(file, fileBytes);
      }
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
    setDetectedKind('');
    setPageCount(null);
    setMarkdown('');
    setOcrConfidence(null);

    try {
      const data = await runDoclingExtract({ url: pdfUrl.trim() });
      setDetectedKind(data.kind || 'unknown');

      if (data.kind === 'image' && data.imageBase64) {
        const imageData = await runImageOcr({
          imageBase64: data.imageBase64,
          mimeType: data.mimeType || 'image/jpeg',
          fileName: data.fileName || 'image-from-url',
        });

        setExtractedText(imageData.text || 'No text extracted from image URL.');
        setMarkdown('');
        setSourceLabel('Image OCR (URL)');
        setPageCount(null);
        setOcrConfidence(typeof imageData.confidence === 'number' ? imageData.confidence : null);
        return;
      }

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

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload PDF or Image File</h2>
          <input
            type="file"
            accept="application/pdf,.pdf,image/*,.jpg,.jpeg,.png,.webp,.gif"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          <p className="mt-3 text-sm text-gray-500">
            PDFs go through Docling. JPG, PNG, and other images go through OCR.
          </p>
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
          {detectedKind && (
            <div className="mt-3 text-sm text-gray-600">
              Detected kind: <span className="font-semibold text-gray-900">{detectedKind}</span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800">Extracting text with Docling Cloud Run...</p>
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
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Extracted Text</h2>
                {sourceLabel && <p className="text-sm text-gray-600 mt-1">Source: {sourceLabel}</p>}
              </div>
              {pageCount !== null && (
                <div className="text-sm text-gray-600">Pages: {pageCount}</div>
              )}
            </div>
            {ocrConfidence !== null && (
              <div className="mb-4 text-sm text-gray-600">
                OCR confidence: {(ocrConfidence * 100).toFixed(1)}%
              </div>
            )}
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
            <div className="mt-4 text-sm text-gray-600">
              Character count: {extractedText.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

