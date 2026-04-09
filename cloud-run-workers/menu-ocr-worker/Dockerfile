FROM python:3.11-slim

# Install system dependencies for Tesseract and image processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-dan \
    libtesseract-dev \
    libpoppler-cpp-dev \
    libffi-dev \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

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
