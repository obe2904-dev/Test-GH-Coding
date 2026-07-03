# Photo to Reel Converter

Convert static images into engaging 5-8 second video reels using ffmpeg.

## Requirements

- ffmpeg installed (✅ already installed via Homebrew)

## Usage

```bash
# Make script executable
chmod +x photo-to-reel.sh

# Basic usage (6 seconds, default fade+zoom effect)
./photo-to-reel.sh input.jpg output.mp4

# Specify duration (5-8 seconds recommended)
./photo-to-reel.sh input.jpg output.mp4 7

# Use specific effects by naming output file
./photo-to-reel.sh input.jpg output-zoom-in.mp4
./photo-to-reel.sh input.jpg output-zoom-out.mp4
./photo-to-reel.sh input.jpg output-pan.mp4
./photo-to-reel.sh input.jpg output-fade.mp4
./photo-to-reel.sh input.jpg output-static.mp4
```

## Available Effects

1. **Fade + Zoom** (default) - Smooth fade in/out with subtle zoom
   - Best for: General purpose, professional look
   - File hint: `output-fade.mp4`

2. **Zoom In** - Ken Burns style slow zoom in
   - Best for: Drawing attention to detail
   - File hint: `output-zoom-in.mp4`

3. **Zoom Out** - Start zoomed, slowly zoom out
   - Best for: Revealing the full image
   - File hint: `output-zoom-out.mp4`

4. **Pan** - Horizontal left-to-right pan
   - Best for: Wide images, landscapes
   - File hint: `output-pan.mp4`

5. **Static** - No effects, just display
   - Best for: Simple, clean presentation
   - File hint: `output-static.mp4`

## Output Format

- Resolution: 1080x1920 (9:16 vertical format)
- Frame rate: 30fps
- Codec: H.264 (widely compatible)
- Format: MP4
- Optimized for: Instagram Reels, TikTok, YouTube Shorts

## Testing

A test script is included to demonstrate all effects:

```bash
./test-all-effects.sh
```

This will create sample videos using all 5 effects.

## Command-Line Direct Usage

You can also use ffmpeg directly:

```bash
# Simple 6-second static video
ffmpeg -loop 1 -i input.jpg -c:v libx264 -t 6 -pix_fmt yuv420p \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -r 30 output.mp4 -y

# Zoom in effect (7 seconds)
ffmpeg -loop 1 -i input.jpg -c:v libx264 -t 7 -pix_fmt yuv420p \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.5)':d=210:s=1080x1920" \
  -r 30 output.mp4 -y
```

## Tips

- Use high-resolution images (at least 1080px on shortest side)
- 6-7 seconds is optimal for social media engagement
- Zoom effects work best with centered subjects
- Pan effects require images wider than 1080px
- Always preview before posting!
