#!/bin/bash
# Deploy Docling service to Google Cloud Run

set -e

# Configuration
PROJECT_ID="strategyp2g"
SERVICE_NAME="docling-menu-extractor"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -t ${IMAGE_NAME} .

echo "Pushing image to Google Container Registry..."
docker push ${IMAGE_NAME}

echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --allow-unauthenticated \
  --set-env-vars HF_HOME=/tmp/hf,HUGGINGFACE_HUB_CACHE=/tmp/hf/hub

if [[ -n "${HF_TOKEN:-}" ]]; then
  echo "Deploying with HF_TOKEN from local environment"
  gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --update-env-vars HF_TOKEN=${HF_TOKEN},HUGGINGFACE_HUB_TOKEN=${HF_TOKEN}
else
  echo "WARNING: HF_TOKEN is not set locally. Docling model downloads may be rate limited."
fi

echo "Deployment complete!"
echo "Get service URL with: gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'"
