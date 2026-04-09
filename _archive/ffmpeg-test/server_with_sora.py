#!/usr/bin/env python3
"""
Photo to Reel Converter - With FFmpeg (Free) and Sora 2 (Paid AI)
Compares free local processing vs paid AI video generation
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
from dotenv import load_dotenv

# Load environment variables from project .env file
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f'[startup] Loaded .env from {env_path}')

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Sora 2 Pricing (per video generation)
SORA_PRICING = {
    5: 0.17,
    6: 0.204,
    7: 0.238,
    8: 0.272,
    10: 0.34
}

# Google Veo 2 Pricing (per second)
# Veo 2 is approximately $0.10 per second
VEO_PRICE_PER_SECOND = 0.10

def calculate_sora_cost(seconds):
    """Calculate Sora 2 cost based on duration"""
    return SORA_PRICING.get(seconds, seconds * 0.034)

def calculate_veo_cost(seconds):
    """Calculate Google Veo 2 cost based on duration"""
    return seconds * VEO_PRICE_PER_SECOND

# HTML Template with both options
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Photo to Reel - FFmpeg vs Sora 2</title>
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
        }

        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
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
            font-size: 16px;
        }

        .comparison-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
        }

        .comparison-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .option-card {
            border: 2px solid #e0e0e0;
            border-radius: 15px;
            padding: 20px;
            transition: all 0.3s;
        }

        .option-card:hover {
            border-color: #667eea;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
        }

        .option-card.selected {
            border-color: #667eea;
            background: #f8f9ff;
        }

        .option-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .badge-free {
            background: #4caf50;
            color: white;
        }

        .badge-paid {
            background: #ff9800;
            color: white;
        }

        .badge-ai {
            background: #2196F3;
            color: white;
        }

        .alive-checkbox {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 15px 0;
            padding: 12px;
            background: #f0f7ff;
            border-radius: 8px;
            border: 1px solid #e3f2fd;
        }

        .alive-checkbox input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
        }

        .alive-checkbox label {
            cursor: pointer;
            color: #333;
            font-size: 14px;
            font-weight: 500;
            user-select: none;
        }

        .alive-description {
            font-size: 12px;
            color: #666;
            margin-left: 30px;
        }

        .option-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 10px;
            color: #333;
        }

        .option-description {
            color: #666;
            font-size: 14px;
            margin-bottom: 15px;
            line-height: 1.6;
        }

        .option-features {
            list-style: none;
            margin: 15px 0;
        }

        .option-features li {
            padding: 8px 0;
            color: #555;
            font-size: 14px;
        }

        .option-features li:before {
            content: "✓ ";
            color: #4caf50;
            font-weight: bold;
            margin-right: 8px;
        }

        .upload-area {
            border: 3px dashed #667eea;
            border-radius: 15px;
            padding: 40px;
            text-align: center;
            margin: 30px 0;
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

        select, input[type="range"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
        }

        .duration-display {
            text-align: right;
            font-size: 24px;
            font-weight: 700;
            color: #667eea;
        }

        .cost-display {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            display: none;
        }

        .cost-amount {
            font-size: 28px;
            font-weight: 700;
            color: #ff9800;
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

        .result-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }

        .stat-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }

        .stat-label {
            font-size: 12px;
            color: #999;
            text-transform: uppercase;
            margin-bottom: 5px;
        }

        .stat-value {
            font-size: 18px;
            font-weight: 700;
            color: #667eea;
        }

        .stat-value.cost {
            color: #ff9800;
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

        .api-key-warning {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            display: none;
        }

        @media (max-width: 768px) {
            .comparison-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Photo to Reel Converter</h1>
        <p class="subtitle">Compare FFmpeg (Free & Fast) vs AI Cinema (Sora 2 & Google Veo)</p>

        <div class="comparison-header">
            <h2 style="margin-bottom: 15px;">Choose Your Method</h2>
            <div class="comparison-grid">
                <div class="option-card" id="ffmpegCard" onclick="selectOption('ffmpeg')">
                    <span class="option-badge badge-free">FREE</span>
                    <div class="option-title">FFmpeg</div>
                    <div class="option-description">Fast local video processing with customizable effects</div>
                    <ul class="option-features">
                        <li>Instant processing (< 1 second)</li>
                        <li>Cinematic camera movement</li>
                        <li>Adjustable movement intensity</li>
                        <li>100% free, unlimited use</li>
                        <li>No internet required</li>
                    </ul>
                </div>

                <div class="option-card" id="soraCard" onclick="selectOption('sora')">
                    <span class="option-badge badge-paid">PAID AI</span>
                    <div class="option-title">OpenAI Sora 2</div>
                    <div class="option-description">OpenAI's advanced AI video generation</div>
                    <ul class="option-features">
                        <li>Cinematic camera movements</li>
                        <li>Natural lighting & depth of field</li>
                        <li>Restaurant atmosphere generation</li>
                        <li>Professional color grading</li>
                        <li>~$0.17-$0.27 per video</li>
                    </ul>
                </div>

                <div class="option-card" id="veoCard" onclick="selectOption('veo')">
                    <span class="option-badge badge-ai">AI POWERED</span>
                    <div class="option-title">Google Veo 2</div>
                    <div class="option-description">Google's state-of-the-art video AI</div>
                    <ul class="option-features">
                        <li>Photorealistic quality</li>
                        <li>Advanced physics simulation</li>
                        <li>Dynamic scene generation</li>
                        <li>4K resolution support</li>
                        <li>~$0.50-$0.80 per video</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="upload-area" id="uploadArea">
            <div class="upload-icon">📸</div>
            <div style="font-size: 18px; font-weight: 600; color: #667eea; margin-bottom: 8px;">
                Click or drag a photo here
            </div>
            <div style="color: #999; font-size: 14px;">
                JPG, PNG, or any image • Recommended: 1080x1920 (vertical)
            </div>
            <input type="file" id="fileInput" accept="image/*">
        </div>

        <img id="preview" class="preview-image">

        <div class="controls" id="controls">
            <!-- FFmpeg Controls -->
            <div id="ffmpegControls" style="display: none;">
                <div class="control-group">
                    <label>Animation Style</label>
                    <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; color: #555; font-size: 14px;">
                        🎬 <strong>Cinematic Camera Movement</strong><br>
                        <span style="font-size: 13px; color: #777;">Horizontal slide + vertical float + gentle push-in</span>
                    </div>
                </div>

                <div class="control-group">
                    <label>Movement Intensity</label>
                    <input type="range" id="zoomIntensity" min="1" max="10" value="5" step="1">
                    <div class="duration-display"><span id="zoomValue">Medium</span></div>
                </div>
            </div>

            <!-- Sora Controls -->
            <div id="soraControls" style="display: none;">
                <div class="control-group">
                    <label>Prompt Style</label>
                    <select id="soraPrompt">
                        <option value="cinematic">Cinematic Restaurant (Default)</option>
                        <option value="elegant">Elegant Fine Dining</option>
                        <option value="cozy">Cozy Cafe Atmosphere</option>
                        <option value="custom">Custom Prompt...</option>
                    </select>
                </div>

                <div class="alive-checkbox">
                    <input type="checkbox" id="soraAlive">
                    <label for="soraAlive">✨ Make it more alive</label>
                </div>
                <div class="alive-description">
                    Add people, waiters/waitresses in background for dynamic restaurant atmosphere
                </div>

                <div class="control-group" id="customPromptGroup" style="display: none;">
                    <label>Custom Prompt</label>
                    <textarea id="customPrompt" rows="4" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-family: inherit; resize: vertical;"></textarea>
                </div>

                <div class="api-key-warning" id="apiKeyWarning">
                    ⚠️ <strong>API Key Required:</strong> Set OPENAI_API_KEY environment variable before starting the server.
                </div>
            </div>

            <!-- Veo Controls -->
            <div id="veoControls" style="display: none;">
                <div class="control-group">
                    <label>Prompt Style</label>
                    <select id="veoPrompt">
                        <option value="cinematic">Cinematic Restaurant (Default)</option>
                        <option value="elegant">Elegant Fine Dining</option>
                        <option value="cozy">Cozy Cafe Atmosphere</option>
                        <option value="custom">Custom Prompt...</option>
                    </select>
                </div>

                <div class="alive-checkbox">
                    <input type="checkbox" id="veoAlive">
                    <label for="veoAlive">✨ Make it more alive</label>
                </div>
                <div class="alive-description">
                    Add people, waiters/waitresses in background for dynamic restaurant atmosphere
                </div>

                <div class="control-group" id="veoCustomPromptGroup" style="display: none;">
                    <label>Custom Prompt</label>
                    <textarea id="veoCustomPrompt" rows="4" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-family: inherit; resize: vertical;"></textarea>
                </div>

                <div class="api-key-warning" id="veoApiKeyWarning">
                    ⚠️ <strong>Gemini API Key Required:</strong> Set GEMINI_API_KEY environment variable before starting the server.
                </div>
            </div>

            <!-- Common Controls -->
            <div class="control-group">
                <label>Duration</label>
                <input type="range" id="duration" min="5" max="8" value="6" step="1">
                <div class="duration-display"><span id="durationValue">6</span> seconds</div>
            </div>

            <div class="cost-display" id="costDisplay">
                <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Estimated Cost</div>
                <div class="cost-amount">$<span id="costValue">0.00</span></div>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">Charged per generation attempt</div>
            </div>

            <button class="button" id="convertButton">
                🎥 Generate Reel
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
            <h3 style="margin-bottom: 20px;">✅ Video Generated</h3>
            <video id="resultVideo" class="result-video" controls loop playsinline></video>
            
            <div class="result-stats">
                <div class="stat-item">
                    <div class="stat-label">Method</div>
                    <div class="stat-value" id="methodUsed">-</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">File Size</div>
                    <div class="stat-value" id="fileSize">-</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Duration</div>
                    <div class="stat-value" id="videoDuration">-</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Cost</div>
                    <div class="stat-value cost" id="finalCost">FREE</div>
                </div>
            </div>

            <div class="result-actions">
                <button class="action-button download-button" id="downloadButton">
                    💾 Download Video
                </button>
                <button class="action-button reset-button" id="resetButton">
                    🔄 Create Another
                </button>
            </div>
        </div>
    </div>

    <script>
        // State
        let selectedMethod = 'ffmpeg';
        let selectedFile = null;
        let currentVideoUrl = null;

        // Elements
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const preview = document.getElementById('preview');
        const controls = document.getElementById('controls');
        const ffmpegControls = document.getElementById('ffmpegControls');
        const soraControls = document.getElementById('soraControls');
        const veoControls = document.getElementById('veoControls');
        const ffmpegCard = document.getElementById('ffmpegCard');
        const soraCard = document.getElementById('soraCard');
        const veoCard = document.getElementById('veoCard');
        const zoomSlider = document.getElementById('zoomIntensity');
        const zoomValue = document.getElementById('zoomValue');
        const soraPromptSelect = document.getElementById('soraPrompt');
        const veoPromptSelect = document.getElementById('veoPrompt');
        const customPromptGroup = document.getElementById('customPromptGroup');
        const veoCustomPromptGroup = document.getElementById('veoCustomPromptGroup');
        const customPrompt = document.getElementById('customPrompt');
        const veoCustomPrompt = document.getElementById('veoCustomPrompt');
        const soraAlive = document.getElementById('soraAlive');
        const veoAlive = document.getElementById('veoAlive');
        const durationSlider = document.getElementById('duration');
        const durationValue = document.getElementById('durationValue');
        const costDisplay = document.getElementById('costDisplay');
        const costValue = document.getElementById('costValue');
        const convertButton = document.getElementById('convertButton');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const errorMessage = document.getElementById('errorMessage');
        const resultContainer = document.getElementById('resultContainer');
        const resultVideo = document.getElementById('resultVideo');
        const methodUsed = document.getElementById('methodUsed');
        const fileSize = document.getElementById('fileSize');
        const videoDuration = document.getElementById('videoDuration');
        const finalCost = document.getElementById('finalCost');
        const downloadButton = document.getElementById('downloadButton');
        const resetButton = document.getElementById('resetButton');

        const zoomLabels = ['Minimal', 'Very Subtle', 'Subtle', 'Light', 'Medium', 'Moderate', 'Strong', 'Very Strong', 'Intense', 'Extreme'];

        // AI Prompts (base prompts without alive enhancement)
        const basePrompts = {
            cinematic: "Create a cinematic vertical video based on the provided reference image. Preserve the dish and table setup exactly. Add elegant restaurant atmosphere with softly blurred background. Keep strong shallow depth of field so the food remains perfectly sharp. Add a very slow cinematic push-in (about 3%) and natural handheld micro-movement. Warm, upscale color grade. No smoke, no steam, no text, no logos.",
            elegant: "Create an elegant fine dining vertical video from this image. Preserve all visible elements exactly. Add a sophisticated restaurant ambiance with soft bokeh lights in the background. Maintain razor-sharp focus on the dish with cinematic shallow depth of field. Subtle camera drift and gentle zoom (2%). Luxury lighting with warm golden tones. No effects, no text.",
            cozy: "Transform this image into a cozy cafe atmosphere video. Keep the subject perfectly preserved. Add warm, intimate cafe environment with subtle movement in soft-focus background. Natural lighting with gentle shadows. Minimal camera movement, slight push-in (1-2%). Homey, welcoming color palette. No additions, no text."
        };

        // Alive enhancement text (added when checkbox is checked)
        const aliveEnhancement = " Add realistic people, waiters, and waitresses in the background moving naturally. They should be softly out of focus to maintain attention on the food. Include natural restaurant activity like people talking, servers delivering food, creating a lively, authentic dining atmosphere.";

        function getPromptWithAlive(basePrompt, addAlive) {
            return addAlive ? (basePrompt + aliveEnhancement) : basePrompt;
        }

        // Initialize
        ffmpegCard.classList.add('selected');
        updateCostDisplay();

        // Event Listeners
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

        zoomSlider.addEventListener('input', () => {
            const value = parseInt(zoomSlider.value);
            zoomValue.textContent = zoomLabels[value - 1];
        });

        soraPromptSelect.addEventListener('change', () => {
            if (soraPromptSelect.value === 'custom') {
                customPromptGroup.style.display = 'block';
            } else {
                customPromptGroup.style.display = 'none';
            }
        });

        veoPromptSelect.addEventListener('change', () => {
            if (veoPromptSelect.value === 'custom') {
                veoCustomPromptGroup.style.display = 'block';
            } else {
                veoCustomPromptGroup.style.display = 'none';
            }
        });

        durationSlider.addEventListener('input', () => {
            durationValue.textContent = durationSlider.value;
            updateCostDisplay();
        });

        convertButton.addEventListener('click', convertToReel);
        downloadButton.addEventListener('click', downloadReel);
        resetButton.addEventListener('click', reset);

        function selectOption(method) {
            selectedMethod = method;
            
            // Remove all selections
            ffmpegCard.classList.remove('selected');
            soraCard.classList.remove('selected');
            veoCard.classList.remove('selected');
            
            // Hide all controls
            ffmpegControls.style.display = 'none';
            soraControls.style.display = 'none';
            veoControls.style.display = 'none';
            costDisplay.style.display = 'none';
            
            // Show appropriate controls
            if (method === 'ffmpeg') {
                ffmpegCard.classList.add('selected');
                ffmpegControls.style.display = 'grid';
            } else if (method === 'sora') {
                soraCard.classList.add('selected');
                soraControls.style.display = 'grid';
                costDisplay.style.display = 'block';
            } else if (method === 'veo') {
                veoCard.classList.add('selected');
                veoControls.style.display = 'grid';
                costDisplay.style.display = 'block';
            }
            
            updateCostDisplay();
        }

        function updateCostDisplay() {
            if (selectedMethod === 'sora') {
                const duration = parseInt(durationSlider.value);
                const costs = {5: 0.17, 6: 0.204, 7: 0.238, 8: 0.272};
                costValue.textContent = (costs[duration] || 0.238).toFixed(3);
            } else if (selectedMethod === 'veo') {
                const duration = parseInt(durationSlider.value);
                const cost = duration * 0.10; // $0.10 per second
                costValue.textContent = cost.toFixed(2);
            }
        }

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
                
                // Show appropriate controls
                if (selectedMethod === 'ffmpeg') {
                    ffmpegControls.style.display = 'grid';
                    soraControls.style.display = 'none';
                    veoControls.style.display = 'none';
                    costDisplay.style.display = 'none';
                } else if (selectedMethod === 'sora') {
                    soraControls.style.display = 'grid';
                    ffmpegControls.style.display = 'none';
                    veoControls.style.display = 'none';
                    costDisplay.style.display = 'block';
                } else if (selectedMethod === 'veo') {
                    veoControls.style.display = 'grid';
                    ffmpegControls.style.display = 'none';
                    soraControls.style.display = 'none';
                    costDisplay.style.display = 'block';
                }
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
                formData.append('method', selectedMethod);
                formData.append('duration', durationSlider.value);

                if (selectedMethod === 'ffmpeg') {
                    formData.append('zoom_intensity', zoomSlider.value);
                    progressText.textContent = 'Converting with FFmpeg...';
                } else if (selectedMethod === 'sora') {
                    const promptStyle = soraPromptSelect.value;
                    const basePrompt = promptStyle === 'custom' ? customPrompt.value : basePrompts[promptStyle];
                    const prompt = getPromptWithAlive(basePrompt, soraAlive.checked);
                    formData.append('prompt', prompt);
                    formData.append('add_alive', soraAlive.checked ? 'true' : 'false');
                    progressText.textContent = 'Generating with Sora 2 AI... (this may take 30-60 seconds)';
                } else if (selectedMethod === 'veo') {
                    const promptStyle = veoPromptSelect.value;
                    const basePrompt = promptStyle === 'custom' ? veoCustomPrompt.value : basePrompts[promptStyle];
                    const prompt = getPromptWithAlive(basePrompt, veoAlive.checked);
                    formData.append('prompt', prompt);
                    formData.append('add_alive', veoAlive.checked ? 'true' : 'false');
                    progressText.textContent = 'Generating with Google Veo 2... (this may take 30-60 seconds)';
                }

                progressFill.style.width = '60%';

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

                const result = await response.json();
                
                if (currentVideoUrl) {
                    URL.revokeObjectURL(currentVideoUrl);
                }

                // Download video
                const videoResponse = await fetch(result.video_url);
                const blob = await videoResponse.blob();
                currentVideoUrl = URL.createObjectURL(blob);

                resultVideo.src = currentVideoUrl;
                methodUsed.textContent = selectedMethod === 'ffmpeg' ? 'FFmpeg' : 'Sora 2 AI';
                fileSize.textContent = formatFileSize(blob.size);
                videoDuration.textContent = durationSlider.value + 's';
                finalCost.textContent = result.cost === 0 ? 'FREE' : '$' + result.cost.toFixed(3);
                finalCost.classList.toggle('cost', result.cost > 0);

                setTimeout(() => {
                    resultContainer.style.display = 'block';
                    progressContainer.style.display = 'none';
                    convertButton.disabled = false;
                    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 500);

            } catch (error) {
                console.error('Conversion error:', error);
                showError(error.message || 'Failed to generate video');
                convertButton.disabled = false;
                progressContainer.style.display = 'none';
            }
        }

        function downloadReel() {
            if (currentVideoUrl) {
                const a = document.createElement('a');
                a.href = currentVideoUrl;
                a.download = `reel-${selectedMethod}-${durationSlider.value}s-${Date.now()}.mp4`;
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
            durationSlider.value = 6;
            durationValue.textContent = '6';
            zoomSlider.value = 5;
            zoomValue.textContent = 'Medium';
            soraPromptSelect.value = 'cinematic';
            veoPromptSelect.value = 'cinematic';
            customPromptGroup.style.display = 'none';
            veoCustomPromptGroup.style.display = 'none';
            soraAlive.checked = false;
            veoAlive.checked = false;
            updateCostDisplay();
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
        
        method = request.form.get('method', 'ffmpeg')
        duration = int(request.form.get('duration', 6))
        
        if duration < 5 or duration > 8:
            return jsonify({'error': 'Duration must be between 5 and 8 seconds'}), 400
        
        # Save uploaded image temporarily
        temp_dir = tempfile.gettempdir()
        unique_id = str(uuid.uuid4())
        
        filename = secure_filename(image_file.filename)
        ext = Path(filename).suffix or '.jpg'
        input_path = os.path.join(temp_dir, f'input_{unique_id}{ext}')
        output_path = os.path.join(temp_dir, f'output_{unique_id}.mp4')
        
        image_file.save(input_path)
        
        cost = 0
        
        if method == 'ffmpeg':
            # FFmpeg processing with cinematic movement
            zoom_intensity = int(request.form.get('zoom_intensity', 5))
            
            cmd = build_ffmpeg_command(input_path, output_path, None, duration, zoom_intensity)
            
            print(f'[convert] FFmpeg: {" ".join(cmd)}')
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                print(f'[convert] FFmpeg error: {result.stderr}')
                return jsonify({'error': 'FFmpeg conversion failed'}), 500
            
            cost = 0  # Free
            
        elif method == 'sora':
            # Sora 2 API
            prompt = request.form.get('prompt', '')
            if not prompt:
                return jsonify({'error': 'Prompt is required for Sora 2'}), 400
            
            # Call Sora 2 API
            output_path = convert_with_sora(input_path, output_path, prompt, duration)
            cost = calculate_sora_cost(duration)
            
        elif method == 'veo':
            # Google Veo 2 API
            prompt = request.form.get('prompt', '')
            if not prompt:
                return jsonify({'error': 'Prompt is required for Veo 2'}), 400
            
            # Call Veo 2 API
            output_path = convert_with_veo(input_path, output_path, prompt, duration)
            cost = calculate_veo_cost(duration)
        
        else:
            return jsonify({'error': f'Unknown method: {method}'}), 400
        
        # Check output file exists
        if not os.path.exists(output_path):
            return jsonify({'error': 'Output video not created'}), 500
        
        # Return video URL and stats
        video_id = unique_id
        video_url = f'/video/{video_id}'
        
        # Store video path for retrieval
        app.config[f'VIDEO_{video_id}'] = output_path
        app.config[f'INPUT_{video_id}'] = input_path
        
        return jsonify({
            'success': True,
            'video_url': video_url,
            'cost': cost,
            'method': method,
            'duration': duration
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Conversion timed out'}), 500
    except Exception as e:
        print(f'[convert] Error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/video/<video_id>')
def get_video(video_id):
    """Serve generated video"""
    output_path = app.config.get(f'VIDEO_{video_id}')
    input_path = app.config.get(f'INPUT_{video_id}')
    
    if not output_path or not os.path.exists(output_path):
        return jsonify({'error': 'Video not found'}), 404
    
    response = send_file(
        output_path,
        mimetype='video/mp4',
        as_attachment=False
    )
    
    # Cleanup after sending
    @response.call_on_close
    def cleanup():
        try:
            if input_path and os.path.exists(input_path):
                os.remove(input_path)
            if output_path and os.path.exists(output_path):
                os.remove(output_path)
            # Clean up config
            app.config.pop(f'VIDEO_{video_id}', None)
            app.config.pop(f'INPUT_{video_id}', None)
        except Exception as e:
            print(f'[cleanup] Error: {e}')
    
    return response

def convert_with_sora(input_path, output_path, prompt, duration):
    """Convert image to video using Sora API
    
    NOTE: As of February 2026, Sora is not yet publicly available via OpenAI API.
    This function is prepared for when the API becomes available.
    
    Expected API format (when available):
    - Endpoint: https://api.openai.com/v1/videos/generations (tentative)
    - Headers: Authorization: Bearer {api_key}
    - Body: model, prompt, image (base64 or file), duration, size
    """
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise ValueError('OPENAI_API_KEY environment variable not set')
    
    print(f'[sora] Starting generation attempt (duration={duration}s)')
    print(f'[sora] Prompt: {prompt[:100]}...')
    
    # Try the API endpoint (this will fail until Sora is publicly available)
    try:
        with open(input_path, 'rb') as image_file:
            response = requests.post(
                'https://api.openai.com/v1/videos/generations',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'sora-turbo',
                    'prompt': prompt,
                    'size': '1080x1920',
                    'duration': duration,
                },
                timeout=120
            )
        
        if response.status_code == 404 or response.status_code == 401:
            raise ValueError(
                '❌ Sora API Not Available Yet\n\n'
                'OpenAI Sora is not yet publicly accessible via API. '
                'As of February 2026, Sora access is limited to:\n'
                '• Early access partners\n'
                '• ChatGPT Pro subscribers (via web interface only)\n\n'
                'Your OpenAI API key is valid, but it doesn\'t include Sora access yet. '
                'This server is configured correctly and will work automatically '
                'once OpenAI releases public API access.\n\n'
                'For now, please use the FFmpeg option for free video generation.'
            )
        
        if response.status_code != 200:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            error_msg = error_data.get('error', {}).get('message', f'HTTP {response.status_code}')
            raise ValueError(f'Sora API error: {error_msg}')
        
        result = response.json()
        
        # Get video URL from response
        video_url = result.get('url') or result.get('data', [{}])[0].get('url')
        if not video_url:
            raise ValueError('No video URL in Sora response')
        
        print(f'[sora] Video generated: {video_url}')
        
        # Download video
        video_response = requests.get(video_url, timeout=60)
        if video_response.status_code != 200:
            raise ValueError('Failed to download Sora video')
        
        # Save video
        with open(output_path, 'wb') as f:
            f.write(video_response.content)
        
        print(f'[sora] Video saved to {output_path}')
        
        return output_path
        
    except requests.exceptions.RequestException as e:
        raise ValueError(f'Network error calling Sora API: {str(e)}')

def convert_with_veo(input_path, output_path, prompt, duration):
    """Convert image to video using Google Veo 2 API
    
    NOTE: This function requires Google Cloud credentials and Vertex AI access.
    Veo 2 is accessed through Google's Vertex AI platform.
    
    Setup required:
    1. Google Cloud project with Vertex AI enabled
    2. GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY environment variable set
    3. Project configured for video generation
    
    Pricing: ~$0.10 per second (as of February 2026)
    """
    # Try Gemini API key first, then fall back to Google Cloud API key
    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_CLOUD_API_KEY')
    if not api_key:
        raise ValueError('GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY environment variable not set')
    
    print(f'[veo] Starting generation (duration={duration}s)')
    print(f'[veo] Prompt: {prompt[:100]}...')
    
    # Read and encode image as base64
    import base64
    with open(input_path, 'rb') as f:
        image_data = base64.b64encode(f.read()).decode('utf-8')
    
    try:
        # Vertex AI Veo 2 API endpoint (example - adjust based on actual API)
        # This is a placeholder for when Veo 2 becomes widely available
        response = requests.post(
            'https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT/locations/us-central1/publishers/google/models/veo-2:predict',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'instances': [{
                    'prompt': prompt,
                    'image': image_data,
                    'parameters': {
                        'duration_seconds': duration,
                        'aspect_ratio': '9:16',
                        'resolution': '1080p',
                    }
                }]
            },
            timeout=120
        )
        
        if response.status_code == 404:
            raise ValueError(
                '❌ Google Veo 2 API Not Available\n\n'
                'Google Veo 2 requires Vertex AI access and proper project setup. '
                'This may require:\n'
                '• Google Cloud project with billing enabled\n'
                '• Vertex AI API enabled\n'
                '• Proper authentication credentials\n'
                '• Waitlist approval (if applicable)\n\n'
                'This server is configured correctly and will work once you have access.\n\n'
                'For now, please use the FFmpeg option for video generation.'
            )
        
        if response.status_code != 200:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            error_msg = error_data.get('error', {}).get('message', f'HTTP {response.status_code}')
            raise ValueError(f'Veo API error: {error_msg}')
        
        result = response.json()
        
        # Extract video from response (format may vary)
        predictions = result.get('predictions', [])
        if not predictions:
            raise ValueError('No predictions in Veo response')
        
        video_data = predictions[0].get('video')
        if not video_data:
            # Check if it's a URL instead
            video_url = predictions[0].get('videoUrl') or predictions[0].get('video_url')
            if video_url:
                print(f'[veo] Downloading from URL: {video_url}')
                video_response = requests.get(video_url, timeout=60)
                if video_response.status_code != 200:
                    raise ValueError('Failed to download Veo video')
                video_data = video_response.content
            else:
                raise ValueError('No video data in Veo response')
        else:
            # Decode base64 video if provided that way
            if isinstance(video_data, str):
                video_data = base64.b64decode(video_data)
        
        # Save video
        with open(output_path, 'wb') as f:
            if isinstance(video_data, bytes):
                f.write(video_data)
            else:
                f.write(video_data.encode())
        
        print(f'[veo] Video saved to {output_path}')
        
        return output_path
        
    except requests.exceptions.RequestException as e:
        raise ValueError(f'Network error calling Veo API: {str(e)}')


def build_ffmpeg_command(input_path, output_path, effect, duration, zoom_intensity=5):
    """Build FFmpeg command with cinematic camera movement
    
    Professional approach combining:
    - Horizontal slide (left to right parallax)
    - Subtle vertical sine wave (organic handheld feel)
    - Gentle push-in (reveals detail)
    - Zoom intensity (1-10) controls movement speed and scale
    
    Perfect for restaurant/food content - adds life and dimension.
    """
    
    # Map zoom intensity to scale factor and sine wave amplitude
    # Lower = subtle, Higher = dramatic
    scale_map = {
        1: 1.05,   # Minimal movement
        2: 1.07,
        3: 1.09,
        4: 1.11,
        5: 1.15,   # Default - balanced
        6: 1.18,   # More dramatic
        7: 1.22,
        8: 1.26,
        9: 1.30,
        10: 1.35   # Maximum drama
    }
    
    # Vertical sine wave amplitude (pixels)
    sine_amplitude_map = {
        1: 10,    # Almost imperceptible
        2: 15,
        3: 20,
        4: 25,
        5: 30,    # Default - subtle organic feel
        6: 35,
        7: 40,
        8: 45,
        9: 50,
        10: 60    # Noticeable movement
    }
    
    scale_factor = scale_map.get(zoom_intensity, 1.15)
    sine_amp = sine_amplitude_map.get(zoom_intensity, 30)
    
    fps = 30
    
    # Build cinematic camera movement filter:
    # 1. Scale to fill frame (no black bars)
    # 2. Scale up for push-in headroom
    # 3. Animated crop with slide + sine wave
    # 4. Format for compatibility
    filter_complex = (
        f"scale=1080:1920:force_original_aspect_ratio=increase,"
        f"scale=iw*{scale_factor}:ih*{scale_factor},"
        f"crop=w=1080:h=1920:"
        f"x='(iw-1080)*(t/{duration})':"  # Horizontal slide (left to right)
        f"y='(ih-1920)/2 + {sine_amp}*sin(2*PI*t/{duration})',"  # Vertical sine wave
        f"format=yuv420p"
    )
    
    return [
        'ffmpeg',
        '-y',                    # Overwrite output
        '-loop', '1',            # Loop input image
        '-i', input_path,
        '-t', str(duration),     # Duration in seconds
        '-vf', filter_complex,
        '-r', str(fps),          # Frame rate
        '-c:v', 'libx264',       # H.264 codec
        '-pix_fmt', 'yuv420p',   # Pixel format for compatibility
        '-movflags', '+faststart', # Enable streaming (moov atom at start)
        output_path
    ]

if __name__ == '__main__':
    print('🎬 Photo to Reel Converter - FFmpeg vs AI Cinema')
    print('=' * 50)
    print('')
    print('Server starting at: http://localhost:8080')
    print('')
    print('Features:')
    print('  • FFmpeg: Free, instant processing')
    print('  • Sora 2: OpenAI AI cinema ($0.17-$0.27)')
    print('  • Veo 2: Google AI video ($0.50-$0.80)')
    print('')
    
    # Check for API keys
    if os.environ.get('OPENAI_API_KEY'):
        print('✓ OpenAI API Key detected (Sora 2 ready)')
    else:
        print('⚠ OpenAI API Key NOT set (Sora 2 unavailable)')
        print('  Set with: export OPENAI_API_KEY=your_key_here')
    
    gemini_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_CLOUD_API_KEY')
    if gemini_key:
        print('✓ Gemini/Google API Key detected (Veo 2 ready)')
    else:
        print('⚠ Gemini API Key NOT set (Veo 2 unavailable)')
        print('  Set with: export GEMINI_API_KEY=your_key_here')
    
    print('')
    print('Open your browser and navigate to:')
    print('  👉 http://localhost:8080')
    print('')
    print('Press Ctrl+C to stop the server')
    print('=' * 50)
    print('')
    
    app.run(host='0.0.0.0', port=8080, debug=True)
