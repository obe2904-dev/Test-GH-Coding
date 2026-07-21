# Docling Cloud Run Service for PDF Menu Extraction
FROM python:3.11-slim

# Install system dependencies for Docling
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port for Cloud Run
ENV PORT=8080
EXPOSE 8080

# Run the API server
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
