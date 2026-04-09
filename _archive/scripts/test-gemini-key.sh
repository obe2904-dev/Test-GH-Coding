#!/bin/bash

# Get the GEMINI_API_KEY from Supabase
echo "Testing Gemini API key..."

# Call a simple Gemini endpoint to test the key
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$(supabase secrets list --project-ref kvqdkohdpvmdylqgujpn 2>/dev/null | grep GEMINI_API_KEY | awk '{print $NF}')" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Say hello in one word"
      }]
    }]
  }' | jq .

echo ""
echo "If you see an error about API key, it needs to be updated."
echo "If you see a response with 'candidates', the key is valid."
