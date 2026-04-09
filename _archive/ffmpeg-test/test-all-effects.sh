#!/bin/bash

# Test script to demonstrate all photo-to-reel effects
# This script will create sample videos with all available effects

echo "🎬 Photo to Reel - Test All Effects"
echo "====================================="
echo ""

# Check if we have a test image
TEST_IMAGE="test-image.jpg"

if [ ! -f "$TEST_IMAGE" ]; then
    echo "⚠️  No test image found. Creating a sample image..."
    
    # Create a colorful test image using ffmpeg
    ffmpeg -f lavfi -i color=c=blue:s=1920x1080:d=1 \
        -vf "drawtext=text='TEST IMAGE':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-100,drawtext=text='Photo to Reel Converter':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+50" \
        -frames:v 1 "$TEST_IMAGE" -y 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Created sample test image: $TEST_IMAGE"
    else
        echo "❌ Failed to create test image"
        echo "Please provide your own test-image.jpg"
        exit 1
    fi
fi

echo ""
echo "Using test image: $TEST_IMAGE"
echo ""
echo "Creating videos with all effects..."
echo "-----------------------------------"

# Make the main script executable
chmod +x photo-to-reel.sh

# Test each effect
DURATION=6

echo ""
echo "1️⃣  Testing STATIC effect..."
./photo-to-reel.sh "$TEST_IMAGE" "output-static.mp4" "$DURATION"

echo ""
echo "2️⃣  Testing ZOOM-IN effect..."
./photo-to-reel.sh "$TEST_IMAGE" "output-zoom-in.mp4" "$DURATION"

echo ""
echo "3️⃣  Testing ZOOM-OUT effect..."
./photo-to-reel.sh "$TEST_IMAGE" "output-zoom-out.mp4" "$DURATION"

echo ""
echo "4️⃣  Testing PAN effect..."
./photo-to-reel.sh "$TEST_IMAGE" "output-pan.mp4" "$DURATION"

echo ""
echo "5️⃣  Testing FADE+ZOOM effect (default)..."
./photo-to-reel.sh "$TEST_IMAGE" "output-fade.mp4" "$DURATION"

echo ""
echo "====================================="
echo "✨ All tests complete!"
echo ""
echo "Generated files:"
ls -lh output-*.mp4 2>/dev/null | awk '{print "  - " $9 " (" $5 ")"}'
echo ""
echo "To preview:"
echo "  open output-static.mp4"
echo "  open output-zoom-in.mp4"
echo "  open output-zoom-out.mp4"
echo "  open output-pan.mp4"
echo "  open output-fade.mp4"
echo ""
echo "Or preview all:"
echo "  open output-*.mp4"
