# Vercel Environment Variables for Production

Set these in Vercel Dashboard → Settings → Environment Variables:

## Required (Critical)
```
VITE_SUPABASE_URL=https://oadwluspjlsnxhgakral.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZHdsdXNwamxzbnhoZ2FrcmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDEyMzIsImV4cCI6MjA5ODU3NzIzMn0.qYMwF75KJ7jSLonN8JdMODKWA6WI393dJwG8-YBauoQ
```

## Edge Function URLs (Use Production Project)
```
VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE=https://oadwluspjlsnxhgakral.supabase.co/functions/v1/analyze-website
VITE_SUPABASE_FUNCTION_MENU_EXTRACT=https://oadwluspjlsnxhgakral.supabase.co/functions/v1/menu-extract-v2
VITE_SUPABASE_FUNCTION_AI_ENHANCE=https://oadwluspjlsnxhgakral.supabase.co/functions/v1/ai-enhance
VITE_SUPABASE_FUNCTION_ADJUST_TEXT=https://oadwluspjlsnxhgakral.supabase.co/functions/v1/adjust-text
VITE_SUPABASE_FUNCTION_SPELLING=https://oadwluspjlsnxhgakral.supabase.co/functions/v1/spelling
```

## Optional (Weather features)
```
VITE_OPENWEATHERMAP_API_KEY=<your-api-key>
```

## Optional (Development/Debug - DON'T set in production)
```
# VITE_BUSINESS_PROFILER_USE_MOCKS=false
# VITE_BUSINESS_PROFILER_DEBUG=false
```

## Steps:
1. Go to https://vercel.com/ole-s-projects-763bcc8d/social-media-saas-c2rbutya9/settings/environment-variables
2. Add each variable above
3. Set Environment: Production (and Preview if needed)
4. Click Save
5. Redeploy the site (Deployments → Click "..." → Redeploy)

## Get Production Anon Key:
1. Go to https://supabase.com/dashboard/project/oadwluspjlsnxhgakral/settings/api
2. Copy "anon/public" key
