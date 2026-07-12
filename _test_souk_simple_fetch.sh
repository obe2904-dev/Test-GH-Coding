#!/bin/bash

echo "🧪 Testing Souk Aarhus with simple fetch..."
echo ""

# Call analyze-website function for Souk
curl -s -X POST 'https://oadwluspjlsnxhgakral.supabase.co/functions/v1/analyze-website' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZHdsdXNwamxzbnhoZ2FrcmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyODc3MTEsImV4cCI6MjA0OTg2MzcxMX0.8l9n_S7fZsXumLB3DhCUb2i_oX5-p4lAMkZeP6zvmPQ" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://soukaarhus.dk/da",
    "business_id": "450c1b6a-e354-4eef-88d8-86cd2ac8d42b",
    "user_id": "db4dc976-a78c-46c6-b867-7f97beca49bd"
  }' | jq '.'

echo ""
echo "✅ Test complete - check if business_type is restaurant"
