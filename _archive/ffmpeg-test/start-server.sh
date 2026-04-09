#!/bin/bash

# Photo to Reel Converter - Server Launcher
# Starts a local web server for converting photos to reels

echo "🎬 Photo to Reel Converter - Starting Server..."
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    echo "Please install Python 3 to run the server"
    exit 1
fi

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed"
    echo "Please run: brew install ffmpeg"
    exit 1
fi

# Check if Flask is installed, if not, install it
if ! python3 -c "import flask" &> /dev/null; then
    echo "📦 Installing Flask (required for web server)..."
    pip3 install flask
    echo ""
fi

echo "✅ All dependencies ready"
echo ""
echo "🚀 Starting server on http://localhost:5000"
echo ""
echo "The browser will open automatically..."
echo "If not, open: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start server and open browser
python3 server.py &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Open browser
open http://localhost:5000

# Wait for user to stop
wait $SERVER_PID
