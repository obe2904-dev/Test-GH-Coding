#!/bin/bash

# Example: Convert a real food photo into a reel
# This demonstrates the complete workflow

echo "🍔 Real-World Example: Food Photo to Reel"
echo "=========================================="
echo ""

# Download a sample food photo (or you can use your own)
echo "📸 Step 1: Preparing photo..."
echo "Note: Replace with your own photo, or use the test-image.jpg"
echo ""

if [ ! -f "food-sample.jpg" ]; then
    if [ -f "test-image.jpg" ]; then
        cp test-image.jpg food-sample.jpg
        echo "✅ Using test image as food sample"
    else
        echo "❌ No image found. Please provide food-sample.jpg"
        exit 1
    fi
fi

echo ""
echo "🎬 Step 2: Creating 6-second reel with fade+zoom effect..."
./photo-to-reel.sh food-sample.jpg food-reel-6s.mp4 6

echo ""
echo "🎬 Step 3: Creating 7-second reel with zoom-in effect..."
./photo-to-reel.sh food-sample.jpg food-reel-zoom-in-7s.mp4 7

echo ""
echo "=========================================="
echo "✨ Complete! Created 2 variations:"
echo ""
ls -lh food-reel-*.mp4 2>/dev/null | awk '{print "  📹 " $9 " - " $5}'
echo ""
echo "Preview with: open food-reel-6s.mp4"
echo ""
echo "💡 Pro tip: The fade+zoom effect (6s) works great for most food photos!"
echo "   The zoom-in effect (7s) is perfect for highlighting details."
