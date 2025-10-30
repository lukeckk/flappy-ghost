#!/bin/bash

set -e

# Configuration
AWS_PROFILE="kiro-eks-workshop"
AWS_REGION="us-west-2"
CLUSTER_NAME="eks-kiro-demo"

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

# Update kubeconfig
log "Updating kubeconfig for cluster: $CLUSTER_NAME"
aws eks update-kubeconfig --name $CLUSTER_NAME --profile $AWS_PROFILE --region $AWS_REGION

# Check cluster connectivity
log "Checking cluster connectivity..."
kubectl get nodes

# Install AWS Load Balancer Controller if not present
log "Checking for AWS Load Balancer Controller..."
if ! kubectl get deployment -n kube-system aws-load-balancer-controller >/dev/null 2>&1; then
    warn "AWS Load Balancer Controller not found. Installing..."
    
    # Create IAM role for AWS Load Balancer Controller
    log "Creating IAM role for AWS Load Balancer Controller..."
    eksctl create iamserviceaccount \
        --cluster=$CLUSTER_NAME \
        --namespace=kube-system \
        --name=aws-load-balancer-controller \
        --role-name AmazonEKSLoadBalancerControllerRole \
        --attach-policy-arn=arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --approve
    
    # Install AWS Load Balancer Controller using Helm
    log "Installing AWS Load Balancer Controller..."
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
    
    helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
        -n kube-system \
        --set clusterName=$CLUSTER_NAME \
        --set serviceAccount.create=false \
        --set serviceAccount.name=aws-load-balancer-controller \
        --set region=$AWS_REGION \
        --set vpcId=$(aws eks describe-cluster --name $CLUSTER_NAME --profile $AWS_PROFILE --region $AWS_REGION --query "cluster.resourcesVpcConfig.vpcId" --output text)
else
    log "AWS Load Balancer Controller already installed"
fi

# Deploy application
log "Deploying Flappy Kiro application..."

# Apply namespace
kubectl apply -f k8s/namespace.yaml

# Apply backend resources
kubectl apply -f k8s/backend-deployment.yaml

# Apply frontend resources  
kubectl apply -f k8s/frontend-deployment.yaml

# Apply ingress
kubectl apply -f k8s/ingress.yaml

# Wait for deployments to be ready
log "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/flappy-kiro-backend -n flappy-kiro
kubectl wait --for=condition=available --timeout=300s deployment/flappy-kiro-frontend -n flappy-kiro

# Get ingress information
log "Getting ingress information..."
kubectl get ingress -n flappy-kiro

log "Deployment completed successfully!"
log "Check the AWS console for the ALB endpoint or run:"
log "kubectl get ingress -n flappy-kiro -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}'"