# Quick Start: Photo to Reel Converter

✅ **ffmpeg installed and tested successfully!**

## 🚀 How to Use With Your Own Photos

### 1. Basic Usage (Default 6-second fade+zoom effect)

```bash
cd /Users/olebaek/Test\ P2G\ 1/ffmpeg-test
./photo-to-reel.sh /path/to/your/photo.jpg my-reel.mp4
```

### 2. Specify Duration (5-8 seconds recommended)

```bash
# 5-second reel
./photo-to-reel.sh photo.jpg reel-5s.mp4 5

# 7-second reel
./photo-to-reel.sh photo.jpg reel-7s.mp4 7

# 8-second reel
./photo-to-reel.sh photo.jpg reel-8s.mp4 8
```

### 3. Choose Different Effects

```bash
# Static (no animation)
./photo-to-reel.sh photo.jpg output-static.mp4

# Zoom in (Ken Burns)
./photo-to-reel.sh photo.jpg output-zoom-in.mp4

# Zoom out
./photo-to-reel.sh photo.jpg output-zoom-out.mp4

# Pan (left to right)
./photo-to-reel.sh photo.jpg output-pan.mp4

# Fade + Zoom (default, recommended)
./photo-to-reel.sh photo.jpg output-fade.mp4
```

## 📱 Output Specifications

- **Resolution**: 1080x1920 (9:16 vertical - perfect for Instagram Reels, TikTok, YouTube Shorts)
- **Frame Rate**: 30fps
- **Codec**: H.264 (universally compatible)
- **Format**: MP4
- **File Size**: ~40KB for 6 seconds (very efficient!)

## 💡 Tips for Best Results

### Image Requirements
- **Minimum resolution**: 1080px on the shortest side
- **Recommended**: 1920px or higher for best quality
- **Format**: JPG, PNG, or any image format ffmpeg supports
- **Aspect ratio**: Works with any aspect ratio (will be fitted to 9:16)

### Effect Selection Guide

| Effect | Best For | Use Case |
|--------|----------|----------|
| **Fade + Zoom** | General purpose | Professional look, works with any image |
| **Zoom In** | Detail focus | Food close-ups, product details |
| **Zoom Out** | Scene reveal | Landscapes, interiors, wide shots |
| **Pan** | Wide images | Panoramas, horizontal compositions |
| **Static** | Clean & simple | Text overlays, minimalist content |

### Duration Guidelines
- **5 seconds**: Quick, punchy content
- **6 seconds**: Sweet spot for engagement
- **7 seconds**: Story-driven content
- **8 seconds**: Maximum for single image reels

## 🎨 Example Workflows

### For Restaurants/Cafés
```bash
# Food photo with subtle zoom
./photo-to-reel.sh burger-photo.jpg burger-reel.mp4 6

# Interior shot with pan
./photo-to-reel.sh interior-wide.jpg cafe-interior.mp4 7

# Signature dish with zoom-in
./photo-to-reel.sh signature-dish.jpg featured-dish-zoom-in.mp4 5
```

### Batch Processing Multiple Photos
```bash
# Process all JPGs in a folder
for img in /path/to/photos/*.jpg; do
  filename=$(basename "$img" .jpg)
  ./photo-to-reel.sh "$img" "${filename}-reel.mp4" 6
done
```

## 🔧 Direct ffmpeg Commands

If you prefer to use ffmpeg directly:

```bash
# Simple static 6-second reel
ffmpeg -loop 1 -i photo.jpg -c:v libx264 -t 6 -pix_fmt yuv420p \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -r 30 output.mp4 -y

# Zoom-in effect (7 seconds)
ffmpeg -loop 1 -i photo.jpg -c:v libx264 -t 7 -pix_fmt yuv420p \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.5)':d=210:s=1080x1920" \
  -r 30 output.mp4 -y
```

## ✅ What We've Tested

- ✅ ffmpeg 8.0.1 installed via Homebrew
- ✅ 5 different effects tested and working
- ✅ 1080x1920 vertical format (Instagram/TikTok compatible)
- ✅ Variable duration (5-8 seconds tested)
- ✅ Efficient file sizes (~40KB for 6s)
- ✅ 30fps smooth playback

## 🎯 Next Steps

1. Copy your food/business photos to the ffmpeg-test directory
2. Test different effects to see what works best
3. Choose your preferred duration (6-7 seconds is optimal)
4. Export for social media!

## 📦 Files Included

- `photo-to-reel.sh` - Main conversion script
- `test-all-effects.sh` - Test all 5 effects
- `README.md` - Full documentation
- `QUICK_START.md` - This file
- Example outputs in `output-*.mp4`

## 🆘 Troubleshooting

**Issue**: "command not found: ffmpeg"
- **Solution**: Run `brew install ffmpeg`

**Issue**: Video looks stretched or cropped
- **Solution**: Ensure input image is at least 1080px on shortest side

**Issue**: Pan effect shows black bars
- **Solution**: Use images wider than 1620px for pan effect

**Issue**: Want different zoom speed
- **Solution**: Edit the `z='min(zoom+0.0015,1.5)'` value in the script (increase 0.0015 for faster zoom)

## 📞 Integration with P2G System

This tool can be integrated into your Post2Go system for:
- Automated reel generation from business photos
- AI-generated content with video enhancement
- Batch processing of product/menu images
- Scheduled reel posting

Ready to automate? Let me know!
