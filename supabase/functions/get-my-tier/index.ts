// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @ts-ignore
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase server configuration");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.slice("Bearer ".length);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(
      token,
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizePlan = (plan: string | null | undefined): 'free' | 'standardplus' | 'premium' | null => {
      if (!plan) return null;

      const normalized = plan.trim().toLowerCase();
      if (normalized === 'free' || normalized === 'standardplus') return normalized;
      if (normalized === 'premium' || normalized === 'pro') return 'premium';
      return null;
    };

    const { data: ownedBusiness, error: ownedBusinessError } = await adminClient
      .from('businesses')
      .select('id, plan')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (ownedBusinessError) throw ownedBusinessError;

    let resolvedPlan = normalizePlan(ownedBusiness?.plan);

    if (!resolvedPlan) {
      const { data: teamMember, error: teamMemberError } = await adminClient
        .from('business_team_members')
        .select('business_id')
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null)
        .maybeSingle();

      if (teamMemberError) throw teamMemberError;

      if (teamMember?.business_id) {
        const { data: teamBusiness, error: teamBusinessError } = await adminClient
          .from('businesses')
          .select('id, plan')
          .eq('id', teamMember.business_id)
          .maybeSingle();

        if (teamBusinessError) throw teamBusinessError;
        resolvedPlan = normalizePlan(teamBusiness?.plan);
      }
    }

    if (!resolvedPlan) {
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      resolvedPlan = normalizePlan(profile?.plan);
    }

    return new Response(
      JSON.stringify({
        plan: resolvedPlan ?? "free",
        profileFound: Boolean(resolvedPlan),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("get-my-tier failed:", error);
    return new Response(
      JSON.stringify({ error: "Unable to retrieve subscription plan" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
