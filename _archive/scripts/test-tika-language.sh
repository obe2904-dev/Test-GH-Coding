#!/bin/bash
# Test if Tika endpoint supports X-Tika-OCRLanguage header

echo "🧪 Testing Tika Language Support"
echo "=================================="
echo ""

TIKA_ENDPOINT="https://tika-processor-361705281766.europe-west1.run.app/tika"

# Create a simple test PDF with Danish text (base64 encoded)
# This is a minimal PDF with Danish text
PDF_BASE64="JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PmVu
ZG9iCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9i
CjMgMCBvYmo8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9S
ZXNvdXJjZXM8PC9Gb250PDwvRjE8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9B
cmllbD4+Pj4+Pj4vQ29udGVudHMgNCAwIFI+PmVuZG9iCjQgMCBvYmo8PC9MZW5ndGggNDMvRmls
dGVyW1vAYGhFVBdvdGV4dCA4IDAgVGogMCAwIFRkIChIZWxsbywgdGhpcyBpcyBEYW5pc2g6IOul5u
es+HkpIFRqIEVUCmVuZG9iCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA0OSAZ
IDAwMDAwIG4gCjAwMDAwMDA5MyAwMDAwMCBuIAowMDAwMDAxNDggMDAwMDAgbiAKMDAwMDAwMzExIDAw
MDAwIG4gCnRyYWlsZXI8PC9TaXplIDUvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo0NTYKYSVFT0Y="

# Decode base64 to binary
echo "$PDF_BASE64" | base64 -d > /tmp/test_danish.pdf

echo "📄 Test file created: /tmp/test_danish.pdf"
echo ""

# Test WITHOUT language header
echo "❌ Test 1: WITHOUT X-Tika-OCRLanguage header"
echo "Command: curl -X PUT '$TIKA_ENDPOINT' -H 'Accept: text/plain' --data-binary '@/tmp/test_danish.pdf'"
echo ""
curl -s -X PUT "$TIKA_ENDPOINT" \
  -H "Accept: text/plain" \
  --data-binary "@/tmp/test_danish.pdf" | head -5
echo ""
echo ""

# Test WITH language header
echo "✅ Test 2: WITH X-Tika-OCRLanguage: dan header"
echo "Command: curl -X PUT '$TIKA_ENDPOINT' -H 'Accept: text/plain' -H 'X-Tika-OCRLanguage: dan' --data-binary '@/tmp/test_danish.pdf'"
echo ""
curl -s -X PUT "$TIKA_ENDPOINT" \
  -H "Accept: text/plain" \
  -H "X-Tika-OCRLanguage: dan" \
  --data-binary "@/tmp/test_danish.pdf" | head -5
echo ""
echo ""

# Clean up
rm /tmp/test_danish.pdf

echo "✅ Test complete"
