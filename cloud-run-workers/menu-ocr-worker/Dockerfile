FROM python:3.11-slim

# Install system dependencies for Tesseract, image processing, and Playwright
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-dan \
    libtesseract-dev \
    libpoppler-cpp-dev \
    libffi-dev \
    libssl-dev \
    build-essential \
    # Playwright browser dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (Chromium only - dependencies already installed above)
RUN playwright install chromium

# Copy application code (all modules required by the modular structure)
COPY main.py .
COPY config.py .
COPY worker.py .
COPY extractors/ extractors/
COPY parsers/ parsers/
COPY utils/ utils/

# Set environment variables (will be overridden by Cloud Run)
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Run the worker
CMD ["python", "main.py"]
