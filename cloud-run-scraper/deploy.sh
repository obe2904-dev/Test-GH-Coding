#!/bin/bash

# Configuration
PROJECT_ID="strategyp2g"
SERVICE_NAME="scraper"
REGION="europe-west1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Generate API key if not set
if [ -z "$API_KEY" ]; then
  echo "Generating API key..."
  API_KEY=$(openssl rand -base64 32)
  echo "API_KEY=${API_KEY}"
  echo ""
fi

echo "Building Docker image..."
docker build -t ${IMAGE_NAME} .

echo "Pushing to Container Registry..."
docker push ${IMAGE_NAME}

echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --set-env-vars API_KEY="${API_KEY}" \
  --memory 2Gi \
  --cpu 1 \
  --timeout 30s \
  --project ${PROJECT_ID}

echo ""
echo "Deployment complete!"
echo "Service URL: https://${SERVICE_NAME}-$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --format='value(status.url)' | cut -d/ -f3)"
echo ""
echo "Add these to Supabase Edge Function secrets:"
echo "CLOUD_RUN_SCRAPER_URL=<service-url-from-above>"
echo "CLOUD_RUN_API_KEY=${API_KEY}"
