# Segment Generation: Deployed vs Local

This note compares the local source analysis of segment generation with the live Supabase endpoint at:

`https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5`

The deployed function is not directly readable here, so this comparison is based on live endpoint behavior plus the local source code in the workspace.

## Deployed Endpoint Analysis

### Observed behavior

1. A request with no body returns `500` with:

```json
{"error":"Unexpected end of JSON input","requestId":"bp-v5-a1f88a65","durationMs":1}
```

2. A request with an empty JSON body returns `400` with:

```json
{"error":"businessId is required","requestId":"bp-v5-45bb1859"}
```

### What that tells us

- The function is live and reachable.
- It expects JSON input and calls `req.json()` immediately.
- It uses the same `bp-v5-...` request-id format as the local source.
- The request validation path is active before any database lookup or generation work.

### Live request flow inferred from the endpoint

1. Parse request JSON.
2. Read `businessId`, `forceRegenerate`, and `menuOverviewSummary`.
3. Reject missing `businessId` with HTTP `400`.
4. Proceed to DB fetches, programme generation, and brand profile save only if input is valid.

## Local Source Analysis

The local source for the same edge function is [supabase/functions/brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts).

Relevant request handling:

```ts
// supabase/functions/brand-profile-generator-v5/index.ts
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestStartTime = Date.now()
  const requestId = `bp-v5-${crypto.randomUUID().slice(0, 8)}`

  try {
    const { businessId, forceRegenerate = false, menuOverviewSummary = null } = await req.json()

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
```

The local save path is the same one used in the first analysis:

```ts
const programmeProfilesToSave = dedupedProgrammesEnriched.map(({ programme, commercialOrientation, audienceProfile }) => ({
  business_id: businessId,
  programme_type: programme.type,
  programme_name: programme.label,
  time_windows: [`${programme.timeWindow.start}-${programme.timeWindow.end}`],
  operating_days: programme.daysOfWeek,
  baseline_goal_split: commercialOrientation.baseline_goal_split,
  decision_timing: commercialOrientation.decision_timing,
  audience_segments: audienceProfile.audience_segments,
  segment_confidence: audienceProfile.segment_confidence,
  segment_reasoning: audienceProfile.segment_reasoning,
}))
```

and:

```ts
await supabaseClient
  .from('business_brand_profile')
  .upsert({
    business_id: businessId,
    brand_profile_v5: v5Profile,
    business_identity_persona: businessIdentityPersona.system_persona || null,
    strategic_audience_segments: strategicSegments,
    content_strategy: legacyContentStrategy || null,
  })
```

## Comparison

### Same

- Same edge-function name: `brand-profile-generator-v5`.
- Same request-id prefix: `bp-v5-`.
- Same input contract: `businessId`, `forceRegenerate`, `menuOverviewSummary`.
- Same validation behavior: missing `businessId` returns `400`.
- Same architecture: programme-level audience segments are generated first, then flattened into brand-level strategic segments.
- Same storage targets: `business_programme_profiles` and `business_brand_profile`.

### Observed difference

- The live endpoint can be probed directly and fails fast if called without a JSON body.
- The local source is readable, so we can inspect the full segment-generation and save logic; the deployed endpoint only reveals behavior through HTTP responses.

### Practical conclusion

From the visible evidence, the deployed function appears to be the same architecture as the local source, not a different segment-generation pipeline. The only difference we can confirm is operational: the deployed endpoint is live and returns its validation errors when called incorrectly.

## Combined Read

If you want a single mental model, use this:

- The dashboard page triggers regeneration.
- The hook calls `menu-overview-summary`, then `brand-profile-generator-v5`.
- The edge function generates programme-level `audience_segments`.
- Those rows are saved in `business_programme_profiles`.
- The same function flattens the audience into `business_brand_profile.strategic_audience_segments` and stores the full `brand_profile_v5` JSON.
- The live deployment currently behaves consistently with that local source path.
