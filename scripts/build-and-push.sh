#!/bin/bash

set -e

# Configuration
AWS_PROFILE="kiro-eks-workshop"
AWS_REGION="us-west-2"
ECR_REGISTRY=""
FRONTEND_REPO="flappy-kiro-frontend"
BACKEND_REPO="flappy-kiro-backend"

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

# Build and push frontend
log "Building frontend image..."
cd frontend
docker build -t $FRONTEND_REPO:latest .
docker tag $FRONTEND_REPO:latest $ECR_REGISTRY/$FRONTEND_REPO:latest
docker tag $FRONTEND_REPO:latest $ECR_REGISTRY/$FRONTEND_REPO:$(date +%Y%m%d-%H%M%S)

log "Pushing frontend image..."
docker push $ECR_REGISTRY/$FRONTEND_REPO:latest
docker push $ECR_REGISTRY/$FRONTEND_REPO:$(date +%Y%m%d-%H%M%S)

cd ..

# Build and push backend
log "Building backend image..."
cd backend
docker build -t $BACKEND_REPO:latest .
docker tag $BACKEND_REPO:latest $ECR_REGISTRY/$BACKEND_REPO:latest
docker tag $BACKEND_REPO:latest $ECR_REGISTRY/$BACKEND_REPO:$(date +%Y%m%d-%H%M%S)

log "Pushing backend image..."
docker push $ECR_REGISTRY/$BACKEND_REPO:latest
docker push $ECR_REGISTRY/$BACKEND_REPO:$(date +%Y%m%d-%H%M%S)

cd ..

# Update Kubernetes manifests with image URIs
log "Updating Kubernetes manifests..."
sed -i.bak "s|FRONTEND_IMAGE_PLACEHOLDER|$ECR_REGISTRY/$FRONTEND_REPO:latest|g" k8s/frontend-deployment.yaml
sed -i.bak "s|BACKEND_IMAGE_PLACEHOLDER|$ECR_REGISTRY/$BACKEND_REPO:latest|g" k8s/backend-deployment.yaml

log "Build and push completed successfully!"
log "Frontend image: $ECR_REGISTRY/$FRONTEND_REPO:latest"
log "Backend image: $ECR_REGISTRY/$BACKEND_REPO:latest"

# Clean up backup files
rm -f k8s/*.bak