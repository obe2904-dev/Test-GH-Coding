#!/usr/bin/env -S deno run --allow-env --allow-net

// Delete cached strategy for week 24 to force regeneration with fixed query

const response = await fetch(
  'https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/weekly_strategies?business_id=eq.f4679fa9-3120-4a59-9506-d059b010c34a&week_start=eq.2026-06-08',
  {
    method: 'DELETE',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA4MzExNSwiZXhwIjoyMDUxNjU5MTE1fQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA4MzExNSwiZXhwIjoyMDUxNjU5MTE1fQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo',
      'Prefer': 'return=minimal'
    }
  }
);

if (response.ok) {
  console.log('✅ Cached strategy deleted successfully');
  console.log('Status:', response.status);
} else {
  console.error('❌ Failed to delete:', response.status, response.statusText);
  const text = await response.text();
  console.error('Response:', text);
}
