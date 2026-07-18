// =====================================================
// OCR Menu - Google Vision API Wrapper
// =====================================================
// Purpose: Extract text from menu images using Google Cloud Vision API
// Handles: Scanned PDFs, menu photos, image galleries

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRRequest {
  imageUrl: string;
}

interface OCRResponse {
  success: boolean;
  text: string;
  confidence: number;
  imageUrl: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageUrl }: OCRRequest = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'imageUrl is required',
          text: '',
          confidence: 0,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google Vision API key
    const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    
    if (!visionApiKey) {
      console.error('GOOGLE_VISION_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'OCR service not configured',
          text: '',
          confidence: 0,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Performing OCR on:', imageUrl.substring(0, 100) + '...');

    // Fetch the image
    let imageData: string;
    try {
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      imageData = base64Image;
      
    } catch (error: any) {
      console.error('Image fetch failed:', error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to fetch image: ${error.message}`,
          text: '',
          confidence: 0,
          imageUrl,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Google Vision API
    try {
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: imageData },
              features: [{
                type: 'DOCUMENT_TEXT_DETECTION',
                maxResults: 1,
              }],
              imageContext: {
                languageHints: ['da', 'en'], // Danish and English
              },
            }],
          }),
        }
      );

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error('Vision API failed:', visionResponse.status, errorText);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Vision API failed: ${visionResponse.status}`,
            text: '',
            confidence: 0,
            imageUrl,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const visionData = await visionResponse.json();
      
      // Extract text and confidence
      const textAnnotations = visionData.responses[0]?.textAnnotations;
      
      if (!textAnnotations || textAnnotations.length === 0) {
        console.log('No text detected in image');
        return new Response(
          JSON.stringify({ 
            success: true,
            text: '',
            confidence: 0,
            imageUrl,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // First annotation contains full text
      const extractedText = textAnnotations[0].description || '';
      
      // Calculate average confidence from all detections
      const confidences = textAnnotations
        .slice(1) // Skip first (it's the full text)
        .map((a: any) => a.confidence || 0)
        .filter((c: number) => c > 0);
      
      const avgConfidence = confidences.length > 0
        ? confidences.reduce((sum: number, c: number) => sum + c, 0) / confidences.length
        : 0.5;

      console.log(`OCR extracted ${extractedText.length} characters with ${(avgConfidence * 100).toFixed(1)}% confidence`);

      return new Response(
        JSON.stringify({ 
          success: true,
          text: extractedText,
          confidence: avgConfidence,
          imageUrl,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: any) {
      console.error('Vision API exception:', error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Vision API error: ${error.message}`,
          text: '',
          confidence: 0,
          imageUrl,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in ocr-menu function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        text: '',
        confidence: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
