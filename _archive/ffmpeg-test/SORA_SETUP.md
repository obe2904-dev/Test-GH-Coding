# Sora 2 Setup Guide

## ⚠️ Important: API Availability Status

**As of February 2026**, OpenAI Sora is **NOT yet publicly available** via API. 

Current Sora access is limited to:
- ✅ ChatGPT Pro subscribers (via web interface only)
- ✅ Early access partners
- ❌ Public API access (coming soon)

**This server is configured and ready** - it will work automatically once OpenAI releases public API access. For now, use the FFmpeg option for video generation.

---

## What's New?

Your test page now includes **both** FFmpeg (free) and Sora preparation:

- **FFmpeg**: Free, instant processing with 5 effects (✅ Works now)
- **Sora 2**: OpenAI's AI video generation (⏳ Waiting for API release)

## Features

### FFmpeg (Free) - ✅ Available Now
- ✅ Instant processing (< 1 second)
- ✅ 5 cinematic effects (fade, zoom-in, zoom-out, pan, static)
- ✅ Adjustable zoom intensity (1-10 scale)
- ✅ No internet required
- ✅ Unlimited use

### Sora 2 (Paid AI) - ⏳ Coming Soon
- ✨ Cinematic camera movements
- ✨ Natural lighting & depth of field
- ✨ Restaurant atmosphere generation
- ✨ Professional color grading
- 💰 ~$0.17-$0.27 per video (5-8 seconds)
- ⏳ **Waiting for OpenAI to release public API**

## Cost Tracking

The interface automatically calculates and displays:
- **Before generation**: Estimated cost
- **After generation**: Actual cost charged
- **Comparison**: FFmpeg shows "FREE" vs Sora shows actual dollars

## Setting Up Sora 2 (Ready for When API Launches)

### 1. Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy your key (starts with `sk-`)

### 2. Set the API Key

**Option A: Terminal (temporary - current session only)**
```bash
export OPENAI_API_KEY=sk-your_actual_key_here
```

**Option B: Add to your shell profile (permanent)**

Edit `~/.zshrc` (macOS default) or `~/.bashrc`:
```bash
echo 'export OPENAI_API_KEY=sk-your_actual_key_here' >> ~/.zshrc
source ~/.zshrc
```

### 3. Restart the Server

```bash
cd /Users/olebaek/Test\ P2G\ 1/ffmpeg-test
python3 server_with_sora.py
```

You should now see:
```
✓ OpenAI API Key detected
```

## Usage

### Starting the Server

```bash
cd /Users/olebaek/Test\ P2G\ 1/ffmpeg-test
python3 server_with_sora.py
```

Open: http://localhost:8080

### Stopping the Server

Press `Ctrl+C` in the terminal

## Interface Guide

1. **Choose Method**: Click FFmpeg or Sora 2 card at the top
2. **Upload Photo**: Drag or click to upload (1080x1920 recommended)
3. **Configure Settings**:
   - **FFmpeg**: Select effect, adjust zoom intensity
   - **Sora 2**: Choose prompt style (cinematic/elegant/cozy/custom)
4. **Set Duration**: 5-8 seconds
5. **Check Cost**: Auto-calculated for Sora 2
6. **Generate**: Click "Generate Reel"
7. **Download**: Preview and download your video

## Cost Examples

| Duration | Sora 2 Cost |
|----------|-------------|
| 5 seconds | $0.17 |
| 6 seconds | $0.20 |
| 7 seconds | $0.24 |
| 8 seconds | $0.27 |

**FFmpeg**: Always FREE ✅

## Sora 2 Prompts

### Cinematic Restaurant (Default)
Creates elegant restaurant atmosphere with:
- Softly blurred background guests
- Shallow depth of field
- Slow push-in (3%)
- Warm upscale color grade

### Elegant Fine Dining
Sophisticated ambiance with:
- Soft bokeh lights
- Razor-sharp focus on dish
- Subtle camera drift
- Luxury golden tones

### Cozy Cafe
Intimate atmosphere with:
- Warm cafe environment
- Natural lighting
- Minimal movement
- Homey welcoming palette

### Custom
Write your own prompt for specific needs

## Comparing Results

The interface makes it easy to test both:

1. Generate with FFmpeg → Download → Note quality
2. Reset and switch to Sora 2 → Generate same image
3. Compare side-by-side

**When to use FFmpeg:**
- Quick tests
- Budget-conscious
- Simple movements
- High volume generation

**When to use Sora 2:**
- Client presentations
- Final deliverables
- Complex cinematography
- Premium quality needed

## Troubleshooting

### "OpenAI API Key NOT set"
→ Follow setup steps above to add your key

### "Sora API error: Insufficient funds"
→ Add credits at https://platform.openai.com/settings/organization/billing

### "Video generation taking too long"
→ Sora 2 typically takes 30-60 seconds (normal)

### FFmpeg works but Sora doesn't
→ Check your API key is valid and has credits

## Files Created

- `server_with_sora.py`: New server with both options
- `server.py`: Original FFmpeg-only server (backup)
- `SORA_SETUP.md`: This guide

## API Key Security

⚠️ **Important**: Never commit your API key to GitHub!

Add to `.gitignore`:
```
.env
*.key
```

Store keys in environment variables, not in code.

## Pricing Notes

- Sora 2 pricing is per generation attempt
- Failed generations still incur charges
- Test with FFmpeg first, then use Sora for finals
- Bulk generation? Consider FFmpeg for cost savings

## Next Steps

1. ✅ Install server (done)
2. 🔑 Add OpenAI API key (if using Sora 2)
3. 🎬 Test both methods with sample images
4. 📊 Compare quality vs cost
5. 🚀 Integrate into your workflow

---

**Server URL**: http://localhost:8080

**Need Help?** Check the terminal output for detailed logs and error messages.
