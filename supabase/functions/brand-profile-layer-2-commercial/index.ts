/**
 * Layer 2: Commercial Orientation Standalone Edge Function
 * 
 * Purpose: Determine commercial orientation (baseline/growth/conversion) for a single programme.
 * Called independently for testing or by V5 generator for production use.
 * 
 * Option C Implementation:
 * - Accepts programme + location + business + menu data via HTTP
 * - Returns commercial orientation + reasoning
 * - Enables independent testing and faster iteration
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateCommercialOrientation } from "../_shared/brand-profile/commercial-orientation.ts";

// Type definitions (must match commercial-orientation.ts)
interface ProgrammeData {
  name: string;
  type: "morning" | "lunch" | "dinner" | "bar";
  timeWindow: { start: string; end: string };
  operatingDays: string[];
  confidence: "high" | "medium" | "low";
  languageVariants?: string[];
}

interface BusinessContext {
  name: string;
  category: string;
  price_level?: number;
  establishment_type?: string;
}

interface LocationContext {
  area_type?: string;
  neighborhood?: string;
  nearby_hospitality?: {
    density_label?: string;
    total_count?: number;
    radius_meters?: number;
    breakdown?: {
      restaurant?: number;
      cafe?: number;
      bar?: number;
    };
  };
}

interface MenuContext {
  price_range?: string;
  item_count?: number;
  categories?: string[];
}

interface Layer2Request {
  programme: ProgrammeData;
  location?: LocationContext;
  business: BusinessContext;
  menu?: MenuContext;
}

interface Layer2Response {
  success: boolean;
  data?: {
    baseline_goal_split: string;
    commercial_reasoning: string;
  };
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: Layer2Request = await req.json();

    // Validate required fields
    if (!requestData.programme || !requestData.business) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: programme, business",
        } as Layer2Response),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Layer 2] Processing programme: ${requestData.programme.name} (${requestData.programme.type})`);
    console.log(`[Layer 2] Business: ${requestData.business.name}`);
    console.log(`[Layer 2] Location: ${requestData.location?.area_type || 'unknown'}`);
    if (requestData.location?.nearby_hospitality) {
      console.log(
        `[Layer 2] Competition: ${requestData.location.nearby_hospitality.density_label} ` +
        `(${requestData.location.nearby_hospitality.total_count} within ` +
        `${requestData.location.nearby_hospitality.radius_meters || 300}m)`
      );
    }

    // Call commercial orientation logic
    const result = await generateCommercialOrientation(
      requestData.programme,
      requestData.business,
      requestData.location || {},
      requestData.menu || {}
    );

    console.log(`[Layer 2] Result: ${result.baseline_goal_split}`);
    console.log(`[Layer 2] Reasoning length: ${result.reasoning?.length || 0} characters`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          baseline_goal_split: result.baseline_goal_split,
          commercial_reasoning: result.reasoning,
        },
      } as Layer2Response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Layer 2] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as Layer2Response),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
