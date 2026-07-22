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

# Check for Supabase credentials
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "⚠️  WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set"
  echo "Set these environment variables before deploying for async scraping to work"
  echo ""
fi

echo "Building Docker image..."
docker buildx build --platform linux/amd64 -t ${IMAGE_NAME} --load .

echo "Pushing to Container Registry..."
docker push ${IMAGE_NAME}

echo "Deploying to Cloud Run..."

# Build env vars string
ENV_VARS="API_KEY=${API_KEY}"
if [ -n "$SUPABASE_URL" ]; then
  ENV_VARS="${ENV_VARS},SUPABASE_URL=${SUPABASE_URL}"
fi
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  ENV_VARS="${ENV_VARS},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
fi

gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --set-env-vars "${ENV_VARS}" \
  --memory 2Gi \
  --cpu 1 \
  --timeout 180s \
  --project ${PROJECT_ID}

echo ""
echo "Deployment complete!"
echo "Service URL: https://${SERVICE_NAME}-$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --format='value(status.url)' | cut -d/ -f3)"
echo ""
echo "Add these to Supabase Edge Function secrets:"
echo "CLOUD_RUN_SCRAPER_URL=<service-url-from-above>"
echo "CLOUD_RUN_API_KEY=${API_KEY}"
