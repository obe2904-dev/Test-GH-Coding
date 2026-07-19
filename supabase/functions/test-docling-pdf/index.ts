// =====================================================
// Test Docling PDF Extraction
// =====================================================
// Purpose: Proxy PDF extraction requests to the Docling Cloud Run service

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TestDoclingRequest = {
  url?: string;
  pdfBase64?: string;
  imageBase64?: string;
  fileName?: string;
  mimeType?: string;
};

function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function detectKindFromBytes(bytes: Uint8Array): 'pdf' | 'image' | 'unknown' {
  if (bytes.length >= 4) {
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  }

  if (bytes.length >= 3) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image';
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
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (riff === 'RIFF' && webp === 'WEBP') return 'image';
  }

  if (bytes.length >= 6) {
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
    if (header === 'GIF87a' || header === 'GIF89a') return 'image';
  }

  return 'unknown';
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function guessFileNameFromUrl(rawUrl: string, fallback: string): string {
  try {
    const parsed = new URL(rawUrl);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || fallback;
    return lastSegment.includes('.') ? lastSegment : `${lastSegment}.pdf`;
  } catch {
    return fallback;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const doclingUrl = Deno.env.get('DOCLING_SERVICE_URL');
    if (!doclingUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'DOCLING_SERVICE_URL is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body: TestDoclingRequest = await req.json();

    if (body.url) {
      const proxyResponse = await fetch(body.url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TestDoclingProxy/1.0)',
          'Accept': 'application/pdf,image/*;q=0.9,*/*;q=0.8',
        },
      });

      if (!proxyResponse.ok) {
        const proxyText = await proxyResponse.text().catch(() => 'unknown error');
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch URL: ${proxyResponse.status} ${proxyText}` }),
          { status: proxyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const contentType = (proxyResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const buffer = await proxyResponse.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const detectedKind = detectKindFromBytes(bytes);
      const urlKind = contentType.startsWith('image/') ? 'image' : contentType.includes('pdf') ? 'pdf' : detectedKind;
      const mimeType = contentType || (urlKind === 'pdf' ? 'application/pdf' : 'application/octet-stream');

      if (urlKind === 'image') {
        return new Response(
          JSON.stringify({
            success: true,
            kind: 'image',
            mimeType,
            imageBase64: base64FromArrayBuffer(buffer),
            fileName: body.fileName || 'image-from-url',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (urlKind !== 'pdf') {
        return new Response(
          JSON.stringify({
            success: false,
            error: `The URL did not resolve to a PDF or image. Content-Type: ${contentType || 'unknown'}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([buffer], { type: mimeType || 'application/pdf' }),
        guessFileNameFromUrl(body.url, body.fileName || 'url.pdf'),
      );

      const response = await fetch(`${doclingUrl}/extract-pdf-file`, {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      return new Response(responseText, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.pdfBase64) {
      const bytes = base64ToUint8Array(body.pdfBase64);
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([bytes], { type: body.mimeType || 'application/pdf' }),
        body.fileName || 'upload.pdf',
      );

      const response = await fetch(`${doclingUrl}/extract-pdf-file`, {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      return new Response(responseText, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: 'url or pdfBase64 is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('❌ test-docling-pdf error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
