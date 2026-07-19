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
  fileName?: string;
  mimeType?: string;
};

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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
      const response = await fetch(`${doclingUrl}/extract-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: body.url }),
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
