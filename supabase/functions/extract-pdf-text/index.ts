// =====================================================
// Extract PDF Text
// =====================================================
// Purpose: Extract text from stored PDF using pdf-parse (if text layer exists)
// Falls back to OCR if no text layer

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractRequest {
  storagePath: string;
}

interface ExtractResponse {
  success: boolean;
  hasTextLayer: boolean;
  text?: string;
  pageCount?: number;
  needsOCR?: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { storagePath }: ExtractRequest = await req.json();

    if (!storagePath) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'storagePath is required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📄 Extracting text from: ${storagePath}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('menu-files')
      .download(storagePath);

    if (downloadError || !pdfData) {
      console.error('❌ Failed to download PDF from storage:', downloadError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to download PDF: ${downloadError?.message || 'No data'}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arrayBuffer = await pdfData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log(`📦 Downloaded ${uint8Array.length} bytes`);

    // Try to extract text using PDF.js or similar
    // For now, we'll do a simple check for text content
    // In production, you'd use a proper PDF parser like pdf-parse or PDF.js

    // Simple heuristic: check if PDF has readable text
    // Convert to string and look for common text patterns
    const textDecoder = new TextDecoder('latin1');
    const pdfString = textDecoder.decode(uint8Array);

    // Look for text content markers in PDF structure
    const hasTextMarkers = pdfString.includes('/Type /Font') || 
                           pdfString.includes('BT') || // Begin Text
                           pdfString.includes('Tj') || // Show Text
                           pdfString.includes('TJ');   // Show Text Array

    // Extract rough text (very basic - not production quality)
    let extractedText = '';
    if (hasTextMarkers) {
      // Try to extract text between BT/ET markers (very basic)
      const btMatches = pdfString.match(/BT[\s\S]*?ET/g);
      if (btMatches) {
        extractedText = btMatches.join(' ')
          .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ') // Keep printable chars
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    const hasTextLayer = hasTextMarkers && extractedText.length > 100;

    console.log(`📊 Analysis: hasTextLayer=${hasTextLayer}, extracted=${extractedText.length} chars`);

    if (!hasTextLayer) {
      console.log('⚠️ No text layer detected - will need OCR');
      return new Response(
        JSON.stringify({ 
          success: true,
          hasTextLayer: false,
          needsOCR: true,
          text: '',
          pageCount: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return extracted text
    return new Response(
      JSON.stringify({ 
        success: true,
        hasTextLayer: true,
        needsOCR: false,
        text: extractedText.substring(0, 50000), // Limit to 50KB
        pageCount: 1, // TODO: Implement proper page counting
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in extract-pdf-text function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
