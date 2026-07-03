#!/usr/bin/env python3
"""
Photo to Reel Converter - Local Web Server
Runs a web interface for converting photos to reels using FFmpeg (free) or Sora 2 (paid)
"""

from flask import Flask, request, jsonify, send_file, render_template_string
from werkzeug.utils import secure_filename
import subprocess
import os
import tempfile
import uuid
from pathlib import Path
import requests
import json
import time

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Sora 2 Pricing (per video)
# Based on OpenAI's pricing: https://openai.com/api/pricing/
SORA_PRICING = {
    5: 0.17,   # 5 seconds: $0.17
    6: 0.204,  # 6 seconds: $0.204 (interpolated)
    7: 0.238,  # 7 seconds: $0.238 (interpolated)
    8: 0.272,  # 8 seconds: $0.272 (interpolated)
    10: 0.34   # 10 seconds: $0.34
}

def calculate_sora_cost(seconds):
    """Calculate Sora 2 cost based on duration"""
    return SORA_PRICING.get(seconds, seconds * 0.034)  # ~$0.034 per second

# HTML Template
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Photo to Reel Converter</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 900px;
            width: 100%;
            padding: 40px;
        }

        h1 {
            font-size: 32px;
            color: #333;
            margin-bottom: 10px;
        }

        .subtitle {
            color: #666;
            margin-bottom: 20px;
        }

        .info-box {
            background: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .upload-area {
            border: 3px dashed #667eea;
            border-radius: 15px;
            padding: 40px;
            text-align: center;
            margin-bottom: 30px;
            cursor: pointer;
            transition: all 0.3s;
            background: #f8f9ff;
        }

        .upload-area:hover {
            border-color: #764ba2;
            background: #f0f2ff;
        }

        .upload-area.dragover {
            border-color: #764ba2;
            background: #e8eaff;
            transform: scale(1.02);
        }

        .upload-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }

        input[type="file"] {
            display: none;
        }

        .preview-image {
            max-width: 100%;
            max-height: 400px;
            border-radius: 10px;
            margin: 20px 0;
            display: none;
        }

        .controls {
            display: grid;
            gap: 20px;
            margin: 20px 0;
            display: none;
        }

        .control-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        label {
            font-weight: 600;
            color: #333;
            font-size: 14px;
            text-transform: uppercase;
        }

        select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
        }

        input[type="range"] {
            width: 100%;
            cursor: pointer;
        }

        .duration-display {
            text-align: right;
            font-size: 24px;
            font-weight: 700;
            color: #667eea;
        }

        .effect-description {
            font-size: 13px;
            color: #666;
            font-style: italic;
        }

        .button {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        .button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }

        .button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .progress-container {
            margin-top: 20px;
            display: none;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            width: 0%;
            transition: width 0.3s;
        }

        .progress-text {
            text-align: center;
            color: #667eea;
            font-weight: 600;
        }

        .result-container {
            margin-top: 30px;
            display: none;
            padding: 30px;
            background: #f8f9ff;
            border-radius: 15px;
        }

        .result-video {
            width: 100%;
            max-height: 600px;
            border-radius: 10px;
            margin-bottom: 20px;
        }

        .result-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .action-button {
            padding: 15px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        .download-button {
            background: #667eea;
            color: white;
        }

        .download-button:hover {
            background: #5568d3;
        }

        .reset-button {
            background: #e0e0e0;
            color: #333;
        }

        .reset-button:hover {
            background: #d0d0d0;
        }

        .error-message {
            background: #ffe0e0;
            color: #d00;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            display: none;
        }

        .specs {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .spec-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }

        .spec-label {
            font-size: 12px;
            color: #999;
            text-transform: uppercase;
            margin-bottom: 5px;
        }

        .spec-value {
            font-size: 18px;
            font-weight: 700;
            color: #667eea;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Photo to Reel Converter</h1>
        <p class="subtitle">Convert your photos into engaging 5-8 second video reels</p>

        <div class="info-box">
            <strong>✨ Fully Functional!</strong><br>
            Upload your photo, select settings, and convert - no terminal required!<br>
            Processing happens instantly on your local machine using FFmpeg.
        </div>

        <div class="upload-area" id="uploadArea">
            <div class="upload-icon">📸</div>
            <div style="font-size: 18px; font-weight: 600; color: #667eea; margin-bottom: 8px;">
                Click or drag a photo here
            </div>
            <div style="color: #999; font-size: 14px;">
                JPG, PNG, or any image format • Recommended: 1920px or higher
            </div>
            <input type="file" id="fileInput" accept="image/*">
        </div>

        <img id="preview" class="preview-image">

        <div class="controls" id="controls">
            <div class="control-group">
                <label>Effect Style</label>
                <select id="effect">
                    <option value="fade">Fade + Zoom (Recommended)</option>
                    <option value="zoom-in">Zoom In</option>
                    <option value="zoom-out">Zoom Out</option>
                    <option value="pan">Pan (Left to Right)</option>
                    <option value="static">Static (No Animation)</option>
                </select>
                <div class="effect-description" id="effectDescription">
                    Smooth fade in/out with subtle zoom - professional look for any image
                </div>
            </div>

            <div class="control-group">
                <label>Duration</label>
                <input type="range" id="duration" min="5" max="8" value="6" step="1">
                <div class="duration-display"><span id="durationValue">6</span> seconds</div>
            </div>

            <div class="control-group" id="zoomControl" style="display: none;">
                <label>Zoom Intensity</label>
                <input type="range" id="zoomIntensity" min="1" max="10" value="5" step="1">
                <div class="duration-display"><span id="zoomValue">Medium</span></div>
            </div>

            <button class="button" id="convertButton">
                🎥 Convert to Reel
            </button>
        </div>

        <div class="progress-container" id="progressContainer">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="progress-text" id="progressText">Processing...</div>
        </div>

        <div class="error-message" id="errorMessage"></div>

        <div class="result-container" id="resultContainer">
            <video id="resultVideo" class="result-video" controls autoplay loop></video>
            
            <div class="specs">
                <div class="spec-item">
                    <div class="spec-label">Resolution</div>
                    <div class="spec-value">1080x1920</div>
                </div>
                <div class="spec-item">
                    <div class="spec-label">Format</div>
                    <div class="spec-value">MP4</div>
                </div>
                <div class="spec-item">
                    <div class="spec-label">Frame Rate</div>
                    <div class="spec-value">30 FPS</div>
                </div>
                <div class="spec-item">
                    <div class="spec-label">File Size</div>
                    <div class="spec-value" id="fileSize">~40KB</div>
                </div>
            </div>

            <div class="result-actions">
                <button class="action-button download-button" id="downloadButton">
                    ⬇️ Download Reel
                </button>
                <button class="action-button reset-button" id="resetButton">
                    🔄 Convert Another
                </button>
            </div>
        </div>
    </div>

    <script>
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const preview = document.getElementById('preview');
        const controls = document.getElementById('controls');
        const effectSelect = document.getElementById('effect');
        const effectDescription = document.getElementById('effectDescription');
        const durationSlider = document.getElementById('duration');
        const durationValue = document.getElementById('durationValue');
        const zoomControl = document.getElementById('zoomControl');
        const zoomSlider = document.getElementById('zoomIntensity');
        const zoomValue = document.getElementById('zoomValue');
        const convertButton = document.getElementById('convertButton');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const errorMessage = document.getElementById('errorMessage');
        const resultContainer = document.getElementById('resultContainer');
        const resultVideo = document.getElementById('resultVideo');
        const fileSize = document.getElementById('fileSize');
        const downloadButton = document.getElementById('downloadButton');
        const resetButton = document.getElementById('resetButton');

        let selectedFile = null;
        let currentVideoUrl = null;

        const effectDescriptions = {
            'fade': 'Smooth fade in/out with subtle zoom - professional look for any image',
            'zoom-in': 'Ken Burns style slow zoom in - perfect for highlighting details',
            'zoom-out': 'Start zoomed, slowly zoom out - reveals the full image',
            'pan': 'Horizontal left-to-right pan - works best with wide images',
            'static': 'No animation - clean and simple presentation'
        };

        const zoomLabels = ['Minimal', 'Very Subtle', 'Subtle', 'Light', 'Medium', 'Moderate', 'Strong', 'Very Strong', 'Intense', 'Extreme'];

        // Upload interactions
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });

        effectSelect.addEventListener('change', () => {
            effectDescription.textContent = effectDescriptions[effectSelect.value];
            const effect = effectSelect.value;
            if (effect === 'zoom-in' || effect === 'zoom-out' || effect === 'fade') {
                zoomControl.style.display = 'flex';
            } else {
                zoomControl.style.display = 'none';
            }
        });

        durationSlider.addEventListener('input', () => {
            durationValue.textContent = durationSlider.value;
        });

        zoomSlider.addEventListener('input', () => {
            const value = parseInt(zoomSlider.value);
            zoomValue.textContent = zoomLabels[value - 1];
        });

        convertButton.addEventListener('click', convertToReel);
        downloadButton.addEventListener('click', downloadReel);
        resetButton.addEventListener('click', reset);

        function handleFile(file) {
            if (!file.type.startsWith('image/')) {
                showError('Please select an image file');
                return;
            }

            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
                controls.style.display = 'grid';
                resultContainer.style.display = 'none';
                errorMessage.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }

        async function convertToReel() {
            if (!selectedFile) return;

            convertButton.disabled = true;
            progressContainer.style.display = 'block';
            errorMessage.style.display = 'none';
            progressFill.style.width = '30%';
            progressText.textContent = 'Uploading image...';

            try {
                const formData = new FormData();
                formData.append('image', selectedFile);
                formData.append('effect', effectSelect.value);
                formData.append('duration', durationSlider.value);
                formData.append('zoom_intensity', zoomSlider.value);

                progressFill.style.width = '60%';
                progressText.textContent = 'Converting with FFmpeg...';

                const response = await fetch('/convert', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Conversion failed');
                }

                progressFill.style.width = '100%';
                progressText.textContent = 'Complete! ✅';

                const blob = await response.blob();
                const videoUrl = URL.createObjectURL(blob);
                
                if (currentVideoUrl) {
                    URL.revokeObjectURL(currentVideoUrl);
                }
                currentVideoUrl = videoUrl;

                resultVideo.src = videoUrl;
                fileSize.textContent = formatFileSize(blob.size);

                setTimeout(() => {
                    resultContainer.style.display = 'block';
                    progressContainer.style.display = 'none';
                    convertButton.disabled = false;
                    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 500);

            } catch (error) {
                console.error('Conversion error:', error);
                showError(error.message || 'Failed to convert image. Make sure FFmpeg is installed.');
                convertButton.disabled = false;
                progressContainer.style.display = 'none';
            }
        }

        function downloadReel() {
            if (currentVideoUrl) {
                const a = document.createElement('a');
                a.href = currentVideoUrl;
                a.download = `reel-${effectSelect.value}-${durationSlider.value}s-${Date.now()}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }

        function reset() {
            selectedFile = null;
            if (currentVideoUrl) {
                URL.revokeObjectURL(currentVideoUrl);
                currentVideoUrl = null;
            }
            preview.style.display = 'none';
            controls.style.display = 'none';
            resultContainer.style.display = 'none';
            progressContainer.style.display = 'none';
            errorMessage.style.display = 'none';
            fileInput.value = '';
            convertButton.disabled = false;
            effectSelect.value = 'fade';
            durationSlider.value = 6;
            durationValue.textContent = '6';
            zoomSlider.value = 5;
            zoomValue.textContent = 'Medium';
            zoomControl.style.display = 'flex';
            effectDescription.textContent = effectDescriptions['fade'];
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }

        function formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/convert', methods=['POST'])
def convert():
    try:
        # Validate request
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No image selected'}), 400
        
        effect = request.form.get('effect', 'fade')
        duration = int(request.form.get('duration', 6))
        zoom_intensity = int(request.form.get('zoom_intensity', 5))
        
        if duration < 5 or duration > 8:
            return jsonify({'error': 'Duration must be between 5 and 8 seconds'}), 400
        
        if zoom_intensity < 1 or zoom_intensity > 10:
            zoom_intensity = 5
        
        # Save uploaded image temporarily
        temp_dir = tempfile.gettempdir()
        unique_id = str(uuid.uuid4())
        
        # Secure filename
        filename = secure_filename(image_file.filename)
        ext = Path(filename).suffix or '.jpg'
        input_path = os.path.join(temp_dir, f'input_{unique_id}{ext}')
        output_path = os.path.join(temp_dir, f'output_{unique_id}.mp4')
        
        image_file.save(input_path)
        
        # Build FFmpeg command
        cmd = build_ffmpeg_command(input_path, output_path, effect, duration, zoom_intensity)
        
        print(f'[convert] Executing FFmpeg: {" ".join(cmd)}')
        
        # Execute FFmpeg
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f'[convert] FFmpeg error: {result.stderr}')
            return jsonify({'error': 'FFmpeg conversion failed'}), 500
        
        # Check output file exists
        if not os.path.exists(output_path):
            return jsonify({'error': 'Output video not created'}), 500
        
        # Send video file
        response = send_file(
            output_path,
            mimetype='video/mp4',
            as_attachment=False,
            download_name=f'reel-{effect}-{duration}s.mp4'
        )
        
        # Cleanup files after sending (Flask handles this automatically)
        @response.call_on_close
        def cleanup():
            try:
                if os.path.exists(input_path):
                    os.remove(input_path)
                if os.path.exists(output_path):
                    os.remove(output_path)
            except Exception as e:
                print(f'[convert] Cleanup error: {e}')
        
        return response
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Conversion timed out'}), 500
    except Exception as e:
        print(f'[convert] Error: {e}')
        return jsonify({'error': str(e)}), 500

def build_ffmpeg_command(input_path, output_path, effect, duration, zoom_intensity=5):
    """Build FFmpeg command based on effect type
    
    Args:
        zoom_intensity: 1-10 scale (1=minimal, 5=medium, 10=extreme)
    """
    # Map zoom intensity (1-10) to zoom parameters
    # For zoom-in: zoom speed
    zoom_speed_map = {
        1: 0.0003, 2: 0.0005, 3: 0.0008, 4: 0.0010, 5: 0.0015,
        6: 0.0020, 7: 0.0030, 8: 0.0040, 9: 0.0055, 10: 0.0075
    }
    # For zoom max: final zoom level
    zoom_max_map = {
        1: 1.05, 2: 1.1, 3: 1.15, 4: 1.25, 5: 1.35,
        6: 1.5, 7: 1.7, 8: 1.9, 9: 2.2, 10: 2.5
    }
    
    zoom_speed = zoom_speed_map.get(zoom_intensity, 0.0015)
    zoom_max = zoom_max_map.get(zoom_intensity, 1.35)
    
    base_cmd = [
        'ffmpeg',
        '-loop', '1',
        '-i', input_path,
        '-c:v', 'libx264',
        '-t', str(duration),
        '-pix_fmt', 'yuv420p',
        '-r', '30',
    ]
    
    # Build filter based on effect
    if effect == 'static':
        filter_complex = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2'
    
    elif effect == 'zoom-in':
        filter_complex = f'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,zoompan=z=\'min(zoom+{zoom_speed},{zoom_max})\':d={duration * 30}:s=1080x1920'
    
    elif effect == 'zoom-out':
        # Calculate initial size based on zoom max
        initial_scale = int(1080 * zoom_max)
        initial_scale_h = int(1920 * zoom_max)
        filter_complex = f'scale={initial_scale}:{initial_scale_h}:force_original_aspect_ratio=decrease,pad={initial_scale}:{initial_scale_h}:(ow-iw)/2:(oh-ih)/2,zoompan=z=\'if(lte(zoom,1.0),{zoom_max},max(1.0,zoom-{zoom_speed})\':d={duration * 30}:s=1080x1920:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\''
    
    elif effect == 'pan':
        filter_complex = f'scale=1620:1920:force_original_aspect_ratio=decrease,pad=1620:1920:(ow-iw)/2:(oh-ih)/2,crop=1080:1920:x=\'t/{duration}*540\':y=0'
    
    else:  # fade (default)
        fade_out_start = duration - 0.5
        fade_zoom_max = 1.0 + (zoom_intensity * 0.03)  # 1.03 to 1.30
        fade_zoom_speed = zoom_intensity * 0.00012  # Subtle
        filter_complex = f'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,zoompan=z=\'min(1+{fade_zoom_speed}*on,{fade_zoom_max})\':d={duration * 30}:s=1080x1920,fade=t=in:st=0:d=0.5,fade=t=out:st={fade_out_start}:d=0.5'
    
    return [
        *base_cmd,
        '-vf', filter_complex,
        '-y',
        output_path
    ]

if __name__ == '__main__':
    print('🎬 Photo to Reel Converter Server')
    print('=' * 50)
    print('')
    print('Server starting at: http://localhost:8080')
    print('')
    print('Open your browser and navigate to:')
    print('  👉 http://localhost:8080')
    print('')
    print('Press Ctrl+C to stop the server')
    print('=' * 50)
    print('')
    
    app.run(host='0.0.0.0', port=8080, debug=True)
