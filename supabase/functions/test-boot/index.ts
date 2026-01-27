import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Test if brand-profile imports work
try {
  await import('../_shared/brand-profile/index.ts')
  console.log('✅ Brand profile imports OK')
} catch (e) {
  console.error('❌ Brand profile import failed:', e)
}

serve(async (req) => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
