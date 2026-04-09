#!/bin/bash

# Photo to Reel Converter using ffmpeg
# Converts a static image into a 5-8 second video with effects

# Usage: ./photo-to-reel.sh input.jpg output.mp4 [duration]

INPUT_IMAGE="$1"
OUTPUT_VIDEO="$2"
DURATION="${3:-6}"  # Default 6 seconds if not specified

# Validate inputs
if [ -z "$INPUT_IMAGE" ] || [ -z "$OUTPUT_VIDEO" ]; then
    echo "Usage: $0 <input_image> <output_video> [duration_in_seconds]"
    echo "Example: $0 test.jpg output.mp4 7"
    exit 1
fi

if [ ! -f "$INPUT_IMAGE" ]; then
    echo "Error: Input image '$INPUT_IMAGE' not found"
    exit 1
fi

echo "Converting $INPUT_IMAGE to $OUTPUT_VIDEO (${DURATION}s)"
echo "========================================="

# Method 1: Simple static display (no effects)
create_static() {
    echo "Creating static reel..."
    ffmpeg -loop 1 -i "$INPUT_IMAGE" \
        -c:v libx264 \
        -t "$DURATION" \
        -pix_fmt yuv420p \
        -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
        -r 30 \
        "$OUTPUT_VIDEO" \
        -y
}

# Method 2: Ken Burns effect (slow zoom in)
create_zoom_in() {
    echo "Creating zoom-in reel..."
    ffmpeg -loop 1 -i "$INPUT_IMAGE" \
        -c:v libx264 \
        -t "$DURATION" \
        -pix_fmt yuv420p \
        -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.5)':d=${DURATION}*30:s=1080x1920" \
        -r 30 \
        "$OUTPUT_VIDEO" \
        -y
}

# Method 3: Ken Burns effect (zoom out)
create_zoom_out() {
    echo "Creating zoom-out reel..."
    ffmpeg -loop 1 -i "$INPUT_IMAGE" \
        -c:v libx264 \
        -t "$DURATION" \
        -pix_fmt yuv420p \
        -vf "scale=1620:2880:force_original_aspect_ratio=decrease,pad=1620:2880:(ow-iw)/2:(oh-ih)/2,zoompan=z='if(lte(zoom,1.0),1.5,max(1.0,zoom-0.0015))':d=${DURATION}*30:s=1080x1920:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'" \
        -r 30 \
        "$OUTPUT_VIDEO" \
        -y
}

# Method 4: Pan left to right
create_pan() {
    echo "Creating pan reel..."
    ffmpeg -loop 1 -i "$INPUT_IMAGE" \
        -c:v libx264 \
        -t "$DURATION" \
        -pix_fmt yuv420p \
        -vf "scale=1620:1920:force_original_aspect_ratio=decrease,pad=1620:1920:(ow-iw)/2:(oh-ih)/2,crop=1080:1920:x='t/${DURATION}*540':y=0" \
        -r 30 \
        "$OUTPUT_VIDEO" \
        -y
}

# Method 5: Fade in/out with subtle zoom
create_fade_zoom() {
    echo "Creating fade + zoom reel..."
    # Calculate fade out start time
    FADE_OUT_START=$(echo "$DURATION - 0.5" | bc)
    
    ffmpeg -loop 1 -i "$INPUT_IMAGE" \
        -c:v libx264 \
        -t "$DURATION" \
        -pix_fmt yuv420p \
        -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(1+0.0005*on,1.2)':d=${DURATION}*30:s=1080x1920,fade=t=in:st=0:d=0.5,fade=t=out:st=$FADE_OUT_START:d=0.5" \
        -r 30 \
        "$OUTPUT_VIDEO" \
        -y
}

# Select method based on filename or default
if [[ "$OUTPUT_VIDEO" == *"static"* ]]; then
    create_static
elif [[ "$OUTPUT_VIDEO" == *"zoom-in"* ]]; then
    create_zoom_in
elif [[ "$OUTPUT_VIDEO" == *"zoom-out"* ]]; then
    create_zoom_out
elif [[ "$OUTPUT_VIDEO" == *"pan"* ]]; then
    create_pan
elif [[ "$OUTPUT_VIDEO" == *"fade"* ]]; then
    create_fade_zoom
else
    # Default: fade + zoom (most popular for reels)
    create_fade_zoom
fi

if [ $? -eq 0 ]; then
    echo "========================================="
    echo "✅ Success! Created: $OUTPUT_VIDEO"
    echo "Duration: ${DURATION}s"
    echo "Resolution: 1080x1920 (9:16 - Instagram/TikTok format)"
    echo ""
    echo "To preview: open $OUTPUT_VIDEO"
else
    echo "❌ Error creating video"
    exit 1
fi
