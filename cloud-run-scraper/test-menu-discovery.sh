#!/bin/bash

# Test Menu Discovery Integration
# Phase 1a: Detection Only

echo "=========================================="
echo "Menu Discovery Test - Phase 1a"
echo "=========================================="
echo ""

# API Key
API_KEY="wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo="
ENDPOINT="https://scraper-831683741713.europe-west1.run.app/scrape-v3"

echo "Test Case 1: soukaarhus.dk (Expected: image_gallery)"
echo "---"
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://soukaarhus.dk"
  }' | jq '{
    menu_pages: .menu_pages_queued,
    menu_discovery: .menu_discovery,
    scraper_duration: .scraper_metadata.duration_ms
  }'

echo ""
echo ""
echo "Test Case 2: cafefaust.dk (Expected: inline_html or direct_pdf)"
echo "---"
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://cafefaust.dk"
  }' | jq '{
    menu_pages: .menu_pages_queued,
    menu_discovery: .menu_discovery,
    scraper_duration: .scraper_metadata.duration_ms
  }'

echo ""
echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
