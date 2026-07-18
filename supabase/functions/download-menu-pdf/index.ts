// =====================================================
// Download Menu PDF
// =====================================================
// Purpose: Download PDF menus and store in Supabase Storage for extraction
// Handles: Direct PDF links, PDFs with transformation params

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DownloadRequest {
  pdfUrl: string;
  businessId: string;
  sourceId: string;
}

interface DownloadResponse {
  success: boolean;
  storagePath?: string;
  publicUrl?: string;
  sizeBytes?: number;
  contentType?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pdfUrl, businessId, sourceId }: DownloadRequest = await req.json();

    if (!pdfUrl || !businessId || !sourceId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'pdfUrl, businessId, and sourceId are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Downloading PDF: ${pdfUrl.substring(0, 80)}...`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the PDF
    let pdfData: ArrayBuffer;
    let contentType = 'application/pdf';

    try {
      const response = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'P2G-Menu-Extractor/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download PDF: HTTP ${response.status}`);
      }

      contentType = response.headers.get('content-type') || 'application/pdf';
      pdfData = await response.arrayBuffer();

      console.log(`✅ Downloaded ${pdfData.byteLength} bytes, content-type: ${contentType}`);

    } catch (error: any) {
      console.error('❌ Download failed:', error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to download PDF: ${error.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify it's actually a PDF (check magic bytes)
    const uint8Array = new Uint8Array(pdfData);
    const isPdf = uint8Array[0] === 0x25 && 
                  uint8Array[1] === 0x50 && 
                  uint8Array[2] === 0x44 && 
                  uint8Array[3] === 0x46; // %PDF

    if (!isPdf) {
      console.warn('⚠️ Downloaded file is not a valid PDF (magic bytes check failed)');
      // Continue anyway - might be an image or different format
    }

    // Generate storage path: menu-pdfs/{businessId}/{sourceId}/{timestamp}.pdf
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `menu-pdfs/${businessId}/${sourceId}/${timestamp}.pdf`;

    console.log(`💾 Uploading to storage: ${storagePath}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-files')
      .upload(storagePath, uint8Array, {
        contentType,
        upsert: false, // Create new file each time
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to upload to storage: ${uploadError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL (even if bucket is private, we use signed URLs later)
    const { data: urlData } = supabase.storage
      .from('menu-files')
      .getPublicUrl(storagePath);

    console.log(`✅ PDF stored successfully: ${storagePath}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        storagePath,
        publicUrl: urlData.publicUrl,
        sizeBytes: pdfData.byteLength,
        contentType,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in download-menu-pdf function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
