#!/bin/bash

set -e

# Configuration
AWS_PROFILE="kiro-eks-workshop"
AWS_REGION="us-west-2"
ECR_REGISTRY=""
FRONTEND_REPO="flappy-kiro-frontend"
BACKEND_REPO="flappy-kiro-backend"
PLATFORM="linux/amd64"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get AWS Account ID
log "Getting AWS Account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

log "Using ECR Registry: $ECR_REGISTRY"
log "Building for platform: $PLATFORM"

# Create ECR repositories if they don't exist
create_ecr_repo() {
    local repo_name=$1
    log "Creating ECR repository: $repo_name"
    
    if aws ecr describe-repositories --repository-names $repo_name --profile $AWS_PROFILE --region $AWS_REGION >/dev/null 2>&1; then
        warn "Repository $repo_name already exists"
    else
        aws ecr create-repository \
            --repository-name $repo_name \
            --profile $AWS_PROFILE \
            --region $AWS_REGION \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
        log "Created repository: $repo_name"
    fi
}

# Login to ECR
log "Logging in to ECR..."
aws ecr get-login-password --profile $AWS_PROFILE --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_REGISTRY

# Create repositories
create_ecr_repo $FRONTEND_REPO
create_ecr_repo $BACKEND_REPO

# Generate timestamp for tagging
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Build and push frontend
log "Building frontend image for $PLATFORM..."
cd frontend

# Build with explicit platform targeting
docker buildx build \
    --platform $PLATFORM \
    -t $FRONTEND_REPO:latest \
    -t $FRONTEND_REPO:$TIMESTAMP \
    -t $ECR_REGISTRY/$FRONTEND_REPO:latest \
    -t $ECR_REGISTRY/$FRONTEND_REPO:$TIMESTAMP \
    --load \
    .

log "Pushing frontend image..."
docker push $ECR_REGISTRY/$FRONTEND_REPO:latest
docker push $ECR_REGISTRY/$FRONTEND_REPO:$TIMESTAMP

cd ..

# Build and push backend
log "Building backend image for $PLATFORM..."
cd backend

# Build with explicit platform targeting
docker buildx build \
    --platform $PLATFORM \
    -t $BACKEND_REPO:latest \
    -t $BACKEND_REPO:$TIMESTAMP \
    -t $ECR_REGISTRY/$BACKEND_REPO:latest \
    -t $ECR_REGISTRY/$BACKEND_REPO:$TIMESTAMP \
    --load \
    .

log "Pushing backend image..."
docker push $ECR_REGISTRY/$BACKEND_REPO:latest
docker push $ECR_REGISTRY/$BACKEND_REPO:$TIMESTAMP

cd ..

# Update Kubernetes manifests with image URIs
log "Updating Kubernetes manifests..."
sed -i.bak "s|FRONTEND_IMAGE_PLACEHOLDER|$ECR_REGISTRY/$FRONTEND_REPO:latest|g" k8s/frontend-deployment.yaml
sed -i.bak "s|BACKEND_IMAGE_PLACEHOLDER|$ECR_REGISTRY/$BACKEND_REPO:latest|g" k8s/backend-deployment.yaml

log "Build and push completed successfully!"
log "Frontend image: $ECR_REGISTRY/$FRONTEND_REPO:latest"
log "Backend image: $ECR_REGISTRY/$BACKEND_REPO:latest"
log "Platform: $PLATFORM"
log "Timestamp: $TIMESTAMP"

# Clean up backup files
rm -f k8s/*.bak

# Verify images
log "Verifying pushed images..."
aws ecr describe-images --repository-name $FRONTEND_REPO --profile $AWS_PROFILE --region $AWS_REGION --query 'imageDetails[0].imageTags' --output table
aws ecr describe-images --repository-name $BACKEND_REPO --profile $AWS_PROFILE --region $AWS_REGION --query 'imageDetails[0].imageTags' --output table